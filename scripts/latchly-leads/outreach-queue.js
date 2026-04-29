/**
 * scripts/latchly-leads/outreach-queue.js
 *
 * Composes Day-0 cold emails for qualified leads and queues them with a
 * per-lead local-tz send time (7-9am next morning). Sends are decoupled —
 * the Vercel cron at /api/cron/latchly-outreach drains the queue.
 *
 * The pipeline calls queueDayZeroBatch(leads, enrichmentByKey, ...).
 * queueDayZeroForLead is exposed for the manual "send-now" override route.
 */

const { composeColdEmailForLead } = require('./cold-email-engine');

// Copied from scripts/openclaw-outreach.js — single source of truth lives there;
// keep this in sync if states are added.
const STATE_TZ = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles',
  NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
  NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver', DC: 'America/New_York',
};

const DEFAULT_TZ = 'America/New_York';

/**
 * Compute the next 7-9am local-tz UTC timestamp for a lead.
 * If we are already past 9am local today, target tomorrow's 7-9am window.
 * Adds a uniformly-random 0-7200s within the 2h window.
 */
function nextLocalSendWindow(stateAbbr, now = new Date(), opts = {}) {
  const tz = STATE_TZ[(stateAbbr || '').toUpperCase()] || DEFAULT_TZ;
  if (opts.testNow) {
    return new Date(now.getTime() + 60 * 1000);
  }

  // Get current local hour in `tz`
  const localParts = getLocalDateParts(now, tz);
  const localHour = localParts.hour;
  const localMinute = localParts.minute;
  const minuteOfDay = localHour * 60 + localMinute;

  // Build a target Date that resolves to exactly local 07:00 in `tz`,
  // either today (if we're before 09:00 local) or tomorrow.
  const baseTodayLocal7 = localDateAtHour(localParts, 7, tz);
  let targetUtc = baseTodayLocal7;
  if (minuteOfDay >= 9 * 60) {
    // Already past 9am local — target tomorrow
    const tomorrow = { ...localParts };
    advanceLocalDay(tomorrow);
    targetUtc = localDateAtHour(tomorrow, 7, tz);
  }
  // Add 0-7200 random seconds (covers 7:00 → 9:00 local)
  const jitterSeconds = Math.floor(Math.random() * 7201);
  return new Date(targetUtc.getTime() + jitterSeconds * 1000);
}

function getLocalDateParts(now, tz) {
  // en-US "M/D/YYYY, H:MM:SS AM/PM" — easier to parse from formatToParts
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => Number(parts.find(p => p.type === type)?.value || 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function advanceLocalDay(parts) {
  // Naive day rollover. Good enough since we're only using ymd to build a new Date.
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  dt.setUTCDate(dt.getUTCDate() + 1);
  parts.year = dt.getUTCFullYear();
  parts.month = dt.getUTCMonth() + 1;
  parts.day = dt.getUTCDate();
}

function localDateAtHour({ year, month, day }, hour, tz) {
  // Find the UTC instant whose local-time-in-tz equals { year, month, day, hour:00:00 }.
  // We use the offset that `tz` uses on the target local day, then construct
  // UTC = local - offset. Adjusting only minute-of-day (the previous approach)
  // breaks when the UTC guess lands on the previous local day in standard-time
  // western zones, where the correction silently moves to yesterday's 7am.
  const offsetMinutes = tzOffsetMinutes(tz, year, month, day, hour);
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - offsetMinutes * 60 * 1000);
}

function tzOffsetMinutes(tz, year, month, day, hour) {
  // Use a reference UTC noon on the target local day so we read the offset
  // that's in effect for that day (DST-aware). We must verify the formatted
  // local date matches; if it doesn't, retry from the offset of the noon
  // formatted in the target zone.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refUtc = new Date(Date.UTC(year, month - 1, day, 12 + attempt * 6, 0, 0));
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(refUtc);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) continue;
    const sign = m[1] === '-' ? -1 : 1;
    const offsetMinutes = sign * (Number(m[2]) * 60 + Number(m[3] || 0));
    // Verify: build candidate UTC and confirm tz formats it back to (year, month, day, hour).
    const candidate = new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - offsetMinutes * 60 * 1000);
    const local = getLocalDateParts(candidate, tz);
    if (local.year === year && local.month === month && local.day === day && local.hour === hour) {
      return offsetMinutes;
    }
  }
  // Fallback: assume UTC if Intl misbehaves
  return 0;
}

async function queueDayZeroForLead(lead, enrichment, opts = {}) {
  const reasons = {};

  if (!lead?.email) return { ok: false, reason: 'no_email' };
  if (!lead?.demoUrl) return { ok: false, reason: 'no_demo' };

  const status = lead.outreachStatus || lead.outreach_status || 'none';
  if (['queued', 'day_zero_sent', 'unsubscribed'].includes(status)) {
    return { ok: false, reason: 'already_queued_or_sent', status };
  }

  let composed;
  try {
    composed = await composeColdEmailForLead(lead, enrichment || {}, lead.demoUrl, {
      anthropic: opts.anthropic,
      fromEmail: opts.fromEmail,
      siteBase: opts.siteBase,
      model: opts.model,
    });
  } catch (err) {
    return { ok: false, reason: 'compose_failed', error: err.message };
  }

  let { subject, body, plainText } = composed;
  if (opts.testEmail) {
    subject = `[TEST] ${subject}`;
  }

  const scheduledFor = nextLocalSendWindow(lead.state, new Date(), {
    testNow: opts.testNow,
  });

  // Apply test-email override AFTER scheduling so the actual queue row points
  // at the test inbox but keeps the lead's tz-correct schedule.
  const queueEmail = opts.testEmail || lead.email;

  if (opts.dryRun) {
    return {
      ok: true,
      dryRun: true,
      subject,
      bodyPreview: body.slice(0, 200),
      scheduledFor: scheduledFor.toISOString(),
      email: queueEmail,
    };
  }

  // Persist via storage helper. The lead.email column on the row stays as the
  // original lead's email; if testEmail override is on, we update it too.
  const businessKey = lead.businessKey || lead.business_key;
  if (!businessKey) return { ok: false, reason: 'no_business_key' };

  if (opts.storage?.queueOutreach) {
    await opts.storage.queueOutreach(businessKey, {
      subject,
      body: plainText || body,
      bodyPreview: body.slice(0, 400),
      scheduledFor,
    });
    if (opts.testEmail && opts.storage?.updateEmailForKey) {
      await opts.storage.updateEmailForKey(businessKey, opts.testEmail);
    }
  }

  return {
    ok: true,
    scheduledFor: scheduledFor.toISOString(),
    subject,
    hash: composed.hash,
  };
}

async function queueDayZeroBatch(leads, enrichmentByKey = {}, opts = {}) {
  const stats = {
    queued: 0,
    skipped: { no_email: 0, no_demo: 0, already_queued_or_sent: 0, compose_failed: 0, other: 0 },
    errors: opts.errors || [],
  };

  for (const lead of leads) {
    const key = lead.businessKey || lead.business_key;
    const enrichment = key ? enrichmentByKey[key] || {} : {};
    try {
      const r = await queueDayZeroForLead(lead, enrichment, opts);
      if (r.ok) {
        stats.queued += 1;
      } else if (stats.skipped[r.reason] != null) {
        stats.skipped[r.reason] += 1;
      } else {
        stats.skipped.other += 1;
        stats.errors.push({ key, reason: r.reason, error: r.error });
      }
    } catch (err) {
      stats.skipped.other += 1;
      stats.errors.push({ key, error: err?.message || String(err) });
    }
  }
  return stats;
}

module.exports = {
  STATE_TZ,
  nextLocalSendWindow,
  queueDayZeroForLead,
  queueDayZeroBatch,
};
