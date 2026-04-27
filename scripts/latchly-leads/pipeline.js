#!/usr/bin/env node
const {
  LEADS_DIR,
  LOCAL_SHARE_MAX,
  LOCAL_SHARE_MIN,
  MIN_DAILY_LEADS,
  NO_WEBSITE_TARGET,
  NO_WEBSITE_MAX_SHARE,
  POOR_WEBSITE_TARGET,
  QUALIFIED_SCORE,
  TARGET_DAILY_LEADS,
} = require('./config');
const { auditLead } = require('./audit');
const { buildDigest, sendDigest, writeDigestFiles } = require('./digest');
const { discoverCandidates } = require('./discovery');
const { createStorage } = require('./storage');
const { businessKey, currentHourET, ensureDir, loadEnv, todayInET } = require('./utils');
const { scoreLead } = require('./scoring');
const { runQualityGate } = require('./quality-gate');

async function main() {
  loadEnv();
  ensureDir(LEADS_DIR);

  if (process.env.LATCHLY_REQUIRE_8AM_ET === '1' && currentHourET() !== 8) {
    console.log(JSON.stringify({ skipped: true, reason: 'not_8am_et', hourET: currentHourET() }));
    return;
  }

  const date = todayInET();
  const storage = createStorage();
  await storage.init();
  const deliveredKeys = await storage.deliveredKeys();

  const candidateLimit = parseInt(process.env.LATCHLY_CANDIDATE_LIMIT || String(TARGET_DAILY_LEADS * 8), 10);
  const candidates = await discoverCandidates({ limit: candidateLimit, deliveredKeys });
  const verbose = process.env.LATCHLY_VERBOSE === '1';
  if (verbose) console.log(`[discovery] candidates=${candidates.length}`);

  const qualified = [];
  const rejections = [];
  let auditAttempts = 0;
  let audited = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (qualified.length >= TARGET_DAILY_LEADS * 2) break;
    if (deliveredKeys.has(businessKey(candidate))) continue;

    let audit = {};
    try {
      auditAttempts++;
      audit = await auditLead(candidate);
      if (audit.status === 'audited') audited++;
    } catch (err) {
      if (verbose) console.log(`[${i + 1}/${candidates.length}] ${candidate.businessName} -> audit error: ${err.message}`);
      rejections.push({ reason: `audit failed: ${err.message}`, businessName: candidate.businessName });
      continue;
    }

    // Promising gate — Stage 1 already decided whether this real-site
    // candidate is worth Stage 2 + scoring. Skip non-promising real sites.
    if (audit.promising === false) {
      if (verbose) console.log(`[${i + 1}/${candidates.length}] NOT-PROMISING (${audit.promisingReason || 'unknown'}) ws=${audit.status} stage=${audit.auditStage || '-'} | ${candidate.businessName}`);
      rejections.push({
        reason: `not promising: ${audit.promisingReason || 'unknown'}`,
        businessName: candidate.businessName,
      });
      continue;
    }

    const enrichedCandidate = {
      ...candidate,
      contactName: candidate.contactName || audit.contactName || '',
      contactTitle: candidate.contactTitle || audit.contactTitle || '',
      phone: candidate.phone || audit.phone || '',
    };
    const scored = scoreLead(enrichedCandidate, audit);
    const lead = {
      ...enrichedCandidate,
      phone: scored.phone,
      website: scored.website,
      score: scored.score,
      reasons: scored.reasons,
      blockers: scored.blockers,
      decisionMaker: scored.decisionMaker,
      pitch: scored.pitch,
      isLocalMarket: scored.isLocalMarket,
      websiteStatus: scored.websiteStatus,
      leadType: scored.leadType,
      audit: summarizeAudit(audit),
    };

    if (scored.qualified && scored.score >= QUALIFIED_SCORE) {
      qualified.push(lead);
    } else {
      rejections.push({
        reason: scored.blockers[0] || scored.reasons[0] || `score below ${QUALIFIED_SCORE}`,
        businessName: candidate.businessName,
        score: scored.score,
      });
    }

    if (verbose) {
      const flag = scored.qualified && scored.score >= QUALIFIED_SCORE ? 'QUAL' : 'rej ';
      const sc = Number(scored.score || 0).toFixed(1);
      const stage = audit.auditStage || '-';
      console.log(`[${i + 1}/${candidates.length}] ${flag} score=${sc} ws=${audit.status} stage=${stage} | qualified=${qualified.length}/${TARGET_DAILY_LEADS * 2} | ${candidate.businessName}`);
    }
  }

  const selected = selectDailyLeads(qualified, Math.max(TARGET_DAILY_LEADS, qualified.length));
  const selection = summarizeSelection(qualified, selected, TARGET_DAILY_LEADS);
  const stats = {
    date,
    target: TARGET_DAILY_LEADS,
    minimum: MIN_DAILY_LEADS,
    candidates: candidates.length,
    auditAttempts,
    audited,
    qualified: qualified.length,
    delivered: selected.length,
    rejected: rejections.length,
    localDelivered: selected.filter(lead => lead.isLocalMarket).length,
    ...selection,
    topRejectionReasons: topReasons(rejections),
  };

  const qualityGate = runQualityGate(selected, stats, { minimum: MIN_DAILY_LEADS, qualifiedScore: QUALIFIED_SCORE });
  if (!qualityGate.ok) {
    const message = qualityGate.issues
      .filter(issue => issue.severity === 'reject')
      .map(issue => `${issue.code}: ${issue.message}`)
      .join('; ');
    throw new Error(`Lead quality gate rejected batch: ${message}`);
  }
  const qualitySelected = qualityGate.leads;
  stats.delivered = qualitySelected.length;
  stats.localDelivered = qualitySelected.filter(lead => lead.isLocalMarket).length;
  stats.qualityGate = qualityGate.issues;
  if (qualityGate.underTarget || qualitySelected.length < MIN_DAILY_LEADS) {
    stats.underTargetReason = qualityGate.issues.find(issue => issue.code === 'under_target')?.message
      || `Only ${qualitySelected.length} score ${QUALIFIED_SCORE}+ leads met the phone, independent home-service, evidence, and dedupe gates.`;
  }
  stats.selectionNotes = selectionNotes(stats);

  const digest = buildDigest(qualitySelected, stats);
  const files = await writeDigestFiles(digest, qualitySelected, stats);
  await storage.upsertLeads(qualitySelected, { date, stats });
  const sendResult = await sendDigest(digest, { dryRun: process.env.DRY_RUN === 'true' || process.env.SKIP_EMAIL === '1' });

  if (sendResult.sent) {
    await storage.markDelivered(qualitySelected, { date, emailId: sendResult.id });
  }
  await storage.recordRun(stats, sendResult);

  console.log(JSON.stringify({ ...stats, files, email: sendResult }, null, 2));
}

function selectDailyLeads(leads, target) {
  const sorted = [...leads].sort(sortLeads);
  const selected = [];
  const used = new Set();
  const limits = selectionLimits(sorted, target);
  const localSupply = sorted.filter(lead => lead.isLocalMarket).length;
  const desiredLocal = localSupply >= limits.localMin
    ? Math.min(limits.localMax, Math.max(limits.localMin, Math.round(target * 0.25)))
    : localSupply;

  takeLeads(selected, used, sorted.filter(lead => lead.isLocalMarket), desiredLocal, limits);

  for (const niche of diversityNiches(sorted, limits.minNiches)) {
    takeLeads(selected, used, sorted.filter(lead => normalizeNiche(lead.niche) === niche), 1, limits);
  }

  for (const bucket of ['noWebsite', 'poorWebsite']) {
    takeLeads(
      selected,
      used,
      sorted.filter(lead => leadBucket(lead) === bucket),
      Math.max(0, limits.bucketMin - selected.filter(lead => leadBucket(lead) === bucket).length),
      limits,
    );
  }

  takeLeads(selected, used, sorted, target - selected.length, limits);

  if (selected.length < target) {
    takeLeads(selected, used, sorted, target - selected.length, {
      ...limits,
      nicheCap: target,
    });
  }

  if (selected.length < target) {
    takeLeads(selected, used, sorted, target - selected.length, {
      ...limits,
      bucketMax: target,
      nicheCap: target,
    });
  }

  if (selected.length < target) {
    takeLeads(selected, used, sorted, target - selected.length, {
      ...limits,
      localMax: target,
      bucketMax: target,
      nicheCap: target,
    });
  }

  return selected.sort(sortLeads).slice(0, target);
}

function takeLeads(selected, used, leads, count, limits) {
  for (const lead of leads) {
    if (count <= 0) return;
    const key = businessKey(lead);
    if (!key || used.has(key)) continue;
    if (!withinSelectionLimits(selected, lead, limits)) continue;
    selected.push(lead);
    used.add(key);
    count--;
  }
}

function selectionLimits(leads, target) {
  const distinctNiches = new Set(leads.map(lead => normalizeNiche(lead.niche))).size;
  const configuredTotal = Math.max(0, NO_WEBSITE_TARGET) + Math.max(0, POOR_WEBSITE_TARGET);
  const noWebsiteTarget = configuredTotal > 0
    ? Math.round(target * (Math.max(0, NO_WEBSITE_TARGET) / configuredTotal))
    : Math.floor(target / 2);
  return {
    localMin: Math.ceil(target * LOCAL_SHARE_MIN),
    localMax: Math.ceil(target * LOCAL_SHARE_MAX),
    bucketMin: Math.floor(target * 0.4),
    bucketMax: Math.ceil(target * 0.6),
    // Hard ceiling on no-website share, NEVER relaxed by the fallback paths.
    // Set NO_WEBSITE_MAX_SHARE>=1 to disable.
    noWebsiteCeiling: Math.max(1, Math.floor(target * NO_WEBSITE_MAX_SHARE)),
    noWebsiteTarget,
    poorWebsiteTarget: target - noWebsiteTarget,
    nicheCap: distinctNiches >= 6 ? Math.ceil(target * 0.2) : Math.ceil(target * 0.3),
    minNiches: distinctNiches >= 6 ? 6 : distinctNiches,
  };
}

function leadBucket(lead) {
  if (lead.leadType === 'no_website_creation' || lead.websiteStatus === 'no_website' || !lead.website) {
    return 'noWebsite';
  }
  return 'poorWebsite';
}

function withinSelectionLimits(selected, lead, limits) {
  const bucket = leadBucket(lead);
  const niche = normalizeNiche(lead.niche);
  if (lead.isLocalMarket && selected.filter(item => item.isLocalMarket).length >= limits.localMax) return false;
  if (selected.filter(item => leadBucket(item) === bucket).length >= limits.bucketMax) return false;
  // Hard no-website ceiling — applies even in the relaxation paths.
  if (bucket === 'noWebsite' && limits.noWebsiteCeiling != null
      && selected.filter(item => leadBucket(item) === 'noWebsite').length >= limits.noWebsiteCeiling) return false;
  if (selected.filter(item => normalizeNiche(item.niche) === niche).length >= limits.nicheCap) return false;
  return true;
}

function summarizeSelection(qualified, selected, target) {
  const limits = selectionLimits(qualified, target);
  const qualifiedNoWebsite = qualified.filter(lead => leadBucket(lead) === 'noWebsite').length;
  const qualifiedPoorWebsite = qualified.filter(lead => leadBucket(lead) === 'poorWebsite').length;
  const deliveredNoWebsite = selected.filter(lead => leadBucket(lead) === 'noWebsite').length;
  const deliveredPoorWebsite = selected.filter(lead => leadBucket(lead) === 'poorWebsite').length;
  const localQualified = qualified.filter(lead => lead.isLocalMarket).length;
  return {
    noWebsiteTarget: limits.noWebsiteTarget,
    poorWebsiteTarget: limits.poorWebsiteTarget,
    siteBucketMin: limits.bucketMin,
    siteBucketMax: limits.bucketMax,
    noWebsiteQualified: qualifiedNoWebsite,
    poorWebsiteQualified: qualifiedPoorWebsite,
    noWebsiteDelivered: deliveredNoWebsite,
    poorWebsiteDelivered: deliveredPoorWebsite,
    noWebsiteShortage: Math.max(0, limits.bucketMin - qualifiedNoWebsite),
    poorWebsiteShortage: Math.max(0, limits.bucketMin - qualifiedPoorWebsite),
    localQualified,
    localTargetMin: Math.ceil(target * LOCAL_SHARE_MIN),
    localTargetMax: Math.ceil(target * LOCAL_SHARE_MAX),
    localShortage: Math.max(0, Math.ceil(target * LOCAL_SHARE_MIN) - localQualified),
    nicheCap: limits.nicheCap,
    nicheCounts: countBy(selected, lead => lead.niche || 'unknown'),
    sourceCounts: countBy(selected, lead => lead.sourceName || 'unknown'),
    scoreDistribution: countBy(selected, lead => String(lead.score || 0)),
    websiteStatusCounts: countBy(selected, lead => leadBucket(lead)),
  };
}

function selectionNotes(stats) {
  const notes = [];
  if (stats.noWebsiteShortage) {
    notes.push(`No-website bucket short by ${stats.noWebsiteShortage}; filled remaining slots with best qualified leads.`);
  }
  if (stats.poorWebsiteShortage) {
    notes.push(`Poor-website bucket short by ${stats.poorWebsiteShortage}; filled remaining slots with best qualified leads.`);
  }
  if (stats.localShortage) {
    notes.push(`Local Gainesville/Tallahassee supply short by ${stats.localShortage}.`);
  }
  return notes;
}

function sortLeads(a, b) {
  return (b.score || 0) - (a.score || 0)
    || Number(b.isLocalMarket) - Number(a.isLocalMarket)
    || String(a.niche || '').localeCompare(String(b.niche || ''))
    || String(a.businessName || '').localeCompare(String(b.businessName || ''));
}

function normalizeNiche(value) {
  return String(value || 'unknown').trim().toLowerCase();
}

function diversityNiches(leads, minNiches) {
  const bestByNiche = new Map();
  for (const lead of leads) {
    const niche = normalizeNiche(lead.niche);
    if (!bestByNiche.has(niche)) bestByNiche.set(niche, lead);
  }
  return [...bestByNiche.values()]
    .sort(sortLeads)
    .slice(0, minNiches)
    .map(lead => normalizeNiche(lead.niche));
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topReasons(rejections) {
  const counts = new Map();
  for (const rejection of rejections) {
    const key = rejection.reason || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason} (${count})`);
}

function summarizeAudit(audit) {
  return {
    status: audit.status,
    finalUrl: audit.finalUrl,
    auditor: audit.auditor,
    pagesChecked: audit.pagesChecked,
    signals: audit.signals,
    verifiedSignals: audit.verifiedSignals,
  };
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  main,
  selectDailyLeads,
  summarizeSelection,
  leadBucket,
  selectionLimits,
};
