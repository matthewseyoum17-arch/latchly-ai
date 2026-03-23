import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

// ── Warm-up ramp ────────────────────────────────────────────────────────────

function getMaxEmails(): number {
  const hardMax = parseInt(process.env.MAX_EMAILS || "20", 10);
  const warmupStart = process.env.WARMUP_START;
  if (!warmupStart) return hardMax;

  const start = new Date(warmupStart);
  const now = new Date();
  const daysSince = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince < 0) return 0;
  if (daysSince < 7) return 5;
  if (daysSince < 14) return 10;
  if (daysSince < 21) return 20;
  return hardMax;
}

// ── Timezone check ──────────────────────────────────────────────────────────

const STATE_TZ: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix",
  AR: "America/Chicago", CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York", DE: "America/New_York", FL: "America/New_York",
  GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Boise",
  IL: "America/Chicago", IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago",
  ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/Detroit", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York",
  NM: "America/Denver", NY: "America/New_York", NC: "America/New_York",
  ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago",
  TX: "America/Chicago", UT: "America/Denver", VT: "America/New_York",
  VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver", DC: "America/New_York",
};

function isLocalSendWindow(state: string): boolean {
  const tz = STATE_TZ[(state || "").toUpperCase()];
  if (!tz) return true;
  const now = new Date();
  const localTime = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const h = localTime.getHours();
  const m = localTime.getMinutes();
  const minuteOfDay = h * 60 + m;
  return minuteOfDay >= 420 && minuteOfDay <= 570; // 7:00–9:30 AM local
}

// ── Email templates ─────────────────────────────────────────────────────────

interface Prospect {
  id: number;
  business_name: string;
  owner_name: string | null;
  email: string;
  city: string | null;
  state: string | null;
  demo_slug: string | null;
  demo_url: string | null;
  outreach_step: number;
  last_outreach_at: string | null;
  closer_responses: number;
  escalated: boolean;
  bounce_type: string | null;
  unsubscribed: boolean;
}

function unsubLink(email: string): string {
  const siteBase = process.env.SITE_BASE || "https://latchlyai.com";
  const token = Buffer.from(email).toString("base64url");
  return `${siteBase}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

function hashLead(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickVariant<T>(lead: Prospect, step: number, options: T[]): T {
  const seed = `${lead.demo_slug || lead.business_name || ""}|${lead.email || ""}|${step}`;
  return options[hashLead(seed) % options.length];
}

function buildEmail(lead: Prospect, step: number) {
  const siteBase = process.env.SITE_BASE || "https://latchlyai.com";
  const physAddr = process.env.PHYSICAL_ADDRESS || "Latchly · Austin, TX";
  const biz = lead.business_name;
  const city = lead.city || "";
  const firstName = lead.owner_name ? lead.owner_name.split(" ")[0] : "";
  const greeting = firstName ? `${firstName},` : "Hi,";
  const demoUrl = lead.demo_url || `${siteBase}/demo/${lead.demo_slug}`;
  const unsub = unsubLink(lead.email);
  const cityLine = city ? ` and the ${city} market` : "";
  const footer = `\n\n---\n${physAddr}\nUnsubscribe: ${unsub}`;

  if (step === 0) {
    const variant = pickVariant(lead, step, [
      {
        subject: `homepage concept for ${biz}`,
        opener: `I put together a custom homepage concept for ${biz}. Not a pitch deck — an actual working design built around your services${cityLine}.`,
        body: `The goal was to tighten up the conversion flow so more of your existing visitors turn into calls and booked jobs, especially on mobile and after hours. There’s also a built-in assistant to handle common questions when your team is off the clock.`,
        close: `No strings. If it sparks any ideas, I’m happy to walk you through it.`
      },
      {
        subject: `built this for ${biz}`,
        opener: `I spent a little time mocking up a live homepage concept for ${biz}. It’s tailored to the services you already offer${cityLine}.`,
        body: `Main idea was simple: make the site feel more current, make the next step clearer, and give you a better shot at turning traffic into real jobs without relying on people to call during business hours.`,
        close: `If it’s useful, I can show you what I changed and why.`
      },
      {
        subject: `quick site concept for ${biz}`,
        opener: `I built a quick homepage concept for ${biz} after looking through the current site${cityLine ? cityLine : ""}.`,
        body: `It’s meant to show what a cleaner, higher-converting version could look like — better structure, stronger mobile flow, and an after-hours assistant baked in.`,
        close: `Take a look when you have a minute. Happy to break it down if you want.`
      },
    ]);

    return {
      subject: variant.subject,
      text: `${greeting}\n\n${variant.opener}\n\n${variant.body}\n\n${demoUrl}\n\n${variant.close}\n\nMatthew\nLatchly${footer}`,
    };
  }

  if (step === 1) {
    return pickVariant(lead, step, [
      {
        subject: `Re: homepage concept for ${biz}`,
        text: `${greeting}\n\nWanted to make sure the ${biz} concept I sent over didn’t get buried.\n\nIt’s here if you want to take a quick look:\n${demoUrl}\n\nMatthew${footer}`,
      },
      {
        subject: `Re: built this for ${biz}`,
        text: `${greeting}\n\nFollowing up once on the homepage concept I put together for ${biz}.\n\nHere’s the link again:\n${demoUrl}\n\nMatthew${footer}`,
      },
      {
        subject: `Re: quick site concept for ${biz}`,
        text: `${greeting}\n\nJust resurfacing the concept I built for ${biz} in case it got missed.\n\n${demoUrl}\n\nMatthew${footer}`,
      },
    ]);
  }

  return pickVariant(lead, step, [
    {
      subject: `${biz} concept — last note`,
      text: `${greeting}\n\nI won’t keep bugging you about this. If a stronger web presence for ${biz} ever moves up the list, the concept I built is here:\n\n${demoUrl}\n\nAll the best,\n\nMatthew${footer}`,
    },
    {
      subject: `${biz} homepage concept`,
      text: `${greeting}\n\nLast note from me on this. Keeping the concept link here in case it’s useful later:\n\n${demoUrl}\n\nBest,\n\nMatthew${footer}`,
    },
  ]);
}

// ── Drip logic ──────────────────────────────────────────────────────────────

function getDripStep(lead: Prospect): number | null {
  const step = lead.outreach_step || 0;
  if (step >= 3) return null;
  if (lead.unsubscribed || lead.bounce_type) return null;
  if ((lead.closer_responses || 0) > 0 || lead.escalated) return null;

  const lastSent = lead.last_outreach_at ? new Date(lead.last_outreach_at) : null;
  const now = new Date();

  if (step === 0) return 0;
  if (step === 1 && lastSent) {
    const days = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 3) return 1;
  }
  if (step === 2 && lastSent) {
    const days = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 4) return 2;
  }
  return null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Weekday guard
  const etNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = etNow.getDay();
  if (day === 0 || day === 6) {
    return NextResponse.json({ skipped: true, reason: "Weekend" });
  }

  const maxEmails = getMaxEmails();
  if (maxEmails === 0) {
    return NextResponse.json({ skipped: true, reason: "Warm-up not started yet" });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromEmail = process.env.OUTREACH_FROM || "outreach@latchlyai.com";
  const replyTo = process.env.AGENTMAIL_INBOX_ID || fromEmail;

  // Load candidates — double the max to account for timezone filtering
  const leads = (await sql`
    SELECT id, business_name, owner_name, email, city, state,
           demo_slug, demo_url, outreach_step, last_outreach_at,
           closer_responses, escalated, bounce_type, unsubscribed
    FROM prospects
    WHERE status IN ('audited', 'outreach')
      AND unsubscribed = FALSE
      AND bounce_type IS NULL
      AND email IS NOT NULL
      AND outreach_step < 3
      AND sco_dispatched_at IS NULL
    ORDER BY combined_score DESC
    LIMIT ${maxEmails * 3}
  `) as Prospect[];

  let sent = 0;
  let skippedTz = 0;
  let skippedDrip = 0;
  const sentList: { business: string; step: number }[] = [];

  for (const lead of leads) {
    if (sent >= maxEmails) break;

    const step = getDripStep(lead);
    if (step === null) {
      skippedDrip++;
      continue;
    }

    if (!isLocalSendWindow(lead.state || "")) {
      skippedTz++;
      continue;
    }

    const email = buildEmail(lead, step);

    try {
      const { data, error } = await resend.emails.send({
        from: `Matthew from Latchly <${fromEmail}>`,
        replyTo: replyTo,
        to: lead.email,
        subject: email.subject,
        text: email.text,
        headers: { "X-Latchly-Step": String(step) },
      });

      if (error) continue;

      const newStep = (lead.outreach_step || 0) + 1;
      await sql`
        UPDATE prospects SET
          outreach_step = ${newStep},
          last_outreach_at = NOW(),
          last_resend_email_id = ${data?.id || null},
          status = 'outreach',
          updated_at = NOW()
        WHERE id = ${lead.id}
          AND outreach_step < ${newStep}
      `;

      sent++;
      sentList.push({ business: lead.business_name, step });

      // Rate limit: 2 seconds between sends
      await new Promise((r) => setTimeout(r, 2000));
    } catch {
      // Continue with next lead
    }
  }

  // Log to pipeline_runs
  try {
    await sql`INSERT INTO pipeline_runs
      (agent, emails_sent, metadata)
      VALUES ('outreach-cron', ${sent},
              ${JSON.stringify({ skipped_tz: skippedTz, skipped_drip: skippedDrip, max: maxEmails, sent: sentList })}::jsonb)`;
  } catch {
    // Non-critical
  }

  return NextResponse.json({
    success: true,
    sent,
    skippedTz,
    skippedDrip,
    maxEmails,
    warmupDay: process.env.WARMUP_START
      ? Math.floor((Date.now() - new Date(process.env.WARMUP_START).getTime()) / 86400000)
      : null,
  });
}
