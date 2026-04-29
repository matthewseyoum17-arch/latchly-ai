#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  AUDIT_CONCURRENCY,
  DIAGNOSTIC_INTERVAL,
  LEADS_DIR,
  LOCAL_SHARE_MAX,
  LOCAL_SHARE_MIN,
  MAX_AUDIT_ATTEMPTS,
  MAX_RUN_MINUTES,
  MIN_DAILY_LEADS,
  NO_WEBSITE_TARGET,
  NO_WEBSITE_MAX_SHARE,
  POOR_WEBSITE_TARGET,
  QUALIFIED_SCORE,
  TARGET_DAILY_LEADS,
  WAVE_LOW_YIELD_MIN_ATTEMPTS,
  WAVE_LOW_YIELD_MIN_RATE,
} = require('./config');
const { auditLead, createAuditSession } = require('./audit');
const { buildDigest, sendDigest, writeDigestFiles } = require('./digest');
const { discoverCandidates, orderCandidatesForAudit } = require('./discovery');
const { createStorage } = require('./storage');
const { businessKey, currentHourET, ensureDir, loadEnv, todayInET } = require('./utils');
const { scoreLead } = require('./scoring');
const { enforcePremiumGate, enforceStandardGate } = require('./quality-gate');

async function main() {
  loadEnv();
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.dryRun || process.env.DRY_RUN === 'true') {
    process.env.DRY_RUN = 'true';
    process.env.SKIP_EMAIL = '1';
    process.env.LATCHLY_LEADS_SKIP_DB = '1';
  }
  ensureDir(LEADS_DIR);

  const date = todayInET();
  const targetLeads = cli.target || TARGET_DAILY_LEADS;
  const minimumLeads = cli.target || MIN_DAILY_LEADS;
  const tierMode = cli.tier || process.env.LATCHLY_TIER || 'both';
  let storage = null;
  let stats = null;

  try {
    if (process.env.LATCHLY_REQUIRE_8AM_ET === '1' && currentHourET() !== 8) {
      console.log(JSON.stringify({ skipped: true, reason: 'not_8am_et', hourET: currentHourET() }));
      return;
    }

    storage = createStorage();
    await storage.init();
    const deliveredKeys = await storage.deliveredKeys();
    const premiumSeeking = tierMode === 'premium' || tierMode === 'both';

    const candidateLimit = parseInt(process.env.LATCHLY_CANDIDATE_LIMIT || String(targetLeads * 8), 10);
    const candidates = orderCandidatesForAudit(
      await discoverCandidates({ limit: candidateLimit, deliveredKeys, preferPaid: premiumSeeking }),
      { preferWebsiteLeads: premiumSeeking },
    );
    const verbose = process.env.LATCHLY_VERBOSE === '1';
    if (verbose) console.log(`[discovery] candidates=${candidates.length}`);
    const diagnosticsPath = diagnosticsEnabled()
      ? path.join(LEADS_DIR, `diagnostics-${date}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)
      : '';

    const {
      qualified,
      rejections,
      auditAttempts,
      audited,
      stopReason,
      waveStats,
      diagnostics,
    } = await auditAndScoreCandidates(candidates, deliveredKeys, {
      verbose,
      auditConcurrency: AUDIT_CONCURRENCY,
      maxAuditAttempts: MAX_AUDIT_ATTEMPTS,
      maxRunMs: MAX_RUN_MINUTES * 60 * 1000,
      maxQualified: targetLeads * 3,
      targetLeads,
      requireQualifiedMix: true,
      preferWebsiteLeads: premiumSeeking,
      diagnosticsPath,
      diagnosticInterval: DIAGNOSTIC_INTERVAL,
    });

    const tiered = selectTieredLeads(qualified, targetLeads, { tierMode });
    const selected = tiered.leads;
    const selection = summarizeSelection(qualified, selected, targetLeads);
    stats = {
      date,
      target: targetLeads,
      minimum: minimumLeads,
      tierMode,
      candidates: candidates.length,
      auditAttempts,
      audited,
      qualified: qualified.length,
      delivered: selected.length,
      rejected: rejections.length,
      localDelivered: selected.filter(lead => lead.isLocalMarket).length,
      maxAuditAttempts: MAX_AUDIT_ATTEMPTS,
      maxRunMinutes: MAX_RUN_MINUTES,
      stopReason,
      diagnosticsPath,
      waveStats,
      diagnostics,
      candidateOpportunityCounts: countBy(candidates, lead => lead.sourceOpportunity || 'unknown'),
      ...selection,
      premiumQualified: tiered.premiumQualified,
      premiumDelivered: tiered.premiumDelivered,
      standardDelivered: tiered.standardDelivered,
      premiumGateIssues: tiered.premiumGate.issues,
      topRejectionReasons: topReasons(rejections),
      topRejectionsBySource: topReasonsBySource(rejections),
    };

    const qualityGate = enforceStandardGate(selected, stats, { minimum: minimumLeads, qualifiedScore: QUALIFIED_SCORE });
    stats.qualityGate = qualityGate.issues;
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
    // dry_run on the run record = real dry run (no leads written), not just SKIP_EMAIL.
    stats.status = 'completed';
    await storage.recordRun(stats, { ...sendResult, dryRun: process.env.DRY_RUN === 'true' });

    console.log(JSON.stringify({ ...stats, files, email: sendResult }, null, 2));
  } catch (err) {
    await recordFailedRun(storage, stats, err, { date, targetLeads, minimumLeads, tierMode });
    throw err;
  }
}

function parseCliArgs(args = []) {
  const out = {
    tier: '',
    target: 0,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--tier') {
      out.tier = normalizeTierMode(args[++i]);
      continue;
    }
    if (arg.startsWith('--tier=')) {
      out.tier = normalizeTierMode(arg.slice('--tier='.length));
      continue;
    }
    if (arg === '--target') {
      out.target = normalizePositiveInt(args[++i]);
      continue;
    }
    if (arg.startsWith('--target=')) {
      out.target = normalizePositiveInt(arg.slice('--target='.length));
    }
  }
  return out;
}

function normalizeTierMode(value) {
  const mode = String(value || '').toLowerCase();
  if (['premium', 'standard', 'both'].includes(mode)) return mode;
  if (mode) throw new Error(`Invalid --tier value "${value}". Use premium, standard, or both.`);
  return '';
}

function normalizePositiveInt(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --target value "${value}".`);
  return parsed;
}

async function recordFailedRun(storage, stats, err, context = {}) {
  const error = err instanceof Error ? err : new Error(String(err || 'Unknown pipeline failure'));
  const writer = storage || createStorage();
  const failureStats = {
    date: stats?.date || context.date || todayInET(),
    target: stats?.target || context.targetLeads || TARGET_DAILY_LEADS,
    minimum: stats?.minimum || context.minimumLeads || MIN_DAILY_LEADS,
    tierMode: stats?.tierMode || context.tierMode || process.env.LATCHLY_TIER || 'both',
    candidates: 0,
    auditAttempts: 0,
    audited: 0,
    qualified: 0,
    delivered: 0,
    rejected: 0,
    localDelivered: 0,
    ...stats,
    status: 'failed',
    failureReason: error.message,
    failureName: error.name,
    underTargetReason: stats?.underTargetReason || error.message,
  };

  try {
    if (!storage) await writer.init();
    await writer.recordRun(failureStats, {
      sent: false,
      dryRun: process.env.DRY_RUN === 'true',
      error: error.message,
    });
  } catch (recordError) {
    console.error('Failed to record Latchly lead run failure:', recordError);
  }
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
      nicheCap: limits.relaxedNicheCap,
    });
  }

  if (selected.length < target) {
    takeLeads(selected, used, sorted, target - selected.length, {
      ...limits,
      bucketMax: target,
      nicheCap: limits.relaxedNicheCap,
    });
  }

  if (selected.length < target) {
    takeLeads(selected, used, sorted, target - selected.length, {
      ...limits,
      localMax: target,
      bucketMax: target,
      nicheCap: limits.relaxedNicheCap,
    });
  }

  return selected.sort(sortLeads).slice(0, target);
}

function selectTieredLeads(qualified, target, options = {}) {
  const tierMode = options.tierMode || 'both';
  const premiumGate = tierMode === 'standard'
    ? { leads: [], rejected: [], issues: [] }
    : enforcePremiumGate(qualified, {}, { minimum: 0 });
  const premiumPool = premiumGate.leads;
  const selectedPremium = tierMode === 'standard'
    ? []
    : selectDailyLeads(premiumPool, Math.min(target, premiumPool.length))
        .map(lead => ({ ...lead, tier: 'premium' }));

  const used = new Set(selectedPremium.map(lead => businessKey(lead)).filter(Boolean));
  const standardPool = tierMode === 'premium' || tierMode === 'both' || tierMode === 'standard'
    ? qualified
        .filter(lead => !used.has(businessKey(lead)))
        .map(lead => ({ ...lead, tier: 'standard' }))
    : [];
  const needed = Math.max(0, target - selectedPremium.length);
  const selectedStandard = needed
    ? selectDailyLeads(standardPool, Math.min(needed, standardPool.length))
        .map(lead => ({ ...lead, tier: 'standard' }))
    : [];
  const leads = [...selectedPremium, ...selectedStandard].sort(sortTieredLeads).slice(0, target);

  return {
    leads,
    premiumGate,
    premiumQualified: premiumPool.length,
    premiumDelivered: leads.filter(lead => lead.tier === 'premium').length,
    standardDelivered: leads.filter(lead => lead.tier !== 'premium').length,
  };
}

async function auditAndScoreCandidates(candidates, deliveredKeys = new Set(), options = {}) {
  const verbose = Boolean(options.verbose);
  const auditFn = options.auditLead || auditLead;
  const scoreFn = options.scoreLead || scoreLead;
  const auditConcurrency = normalizeAuditConcurrency(options.auditConcurrency || AUDIT_CONCURRENCY);
  const maxQualified = Number(options.maxQualified || TARGET_DAILY_LEADS * 2);
  const targetLeads = Number(options.targetLeads || TARGET_DAILY_LEADS);
  const requireQualifiedMix = Boolean(options.requireQualifiedMix);
  const qualifiedLimit = requireQualifiedMix ? maxQualified + targetLeads : maxQualified;
  const maxAuditAttempts = Number(options.maxAuditAttempts || MAX_AUDIT_ATTEMPTS);
  const maxRunMs = Number(options.maxRunMs || MAX_RUN_MINUTES * 60 * 1000);
  const startedAt = Date.now();
  const waves = buildAuditWaves(orderCandidatesForAudit(candidates, {
    preferWebsiteLeads: Boolean(options.preferWebsiteLeads),
  }), {
    preferWebsiteLeads: Boolean(options.preferWebsiteLeads),
  });
  const diagnostics = createDiagnosticsWriter(options.diagnosticsPath, {
    interval: options.diagnosticInterval || DIAGNOSTIC_INTERVAL,
  });
  const ownsAuditSession = !options.auditSession && !options.auditLead;
  const auditSession = options.auditSession || (ownsAuditSession ? createAuditSession() : null);
  const qualified = [];
  const rejections = [];
  const waveStats = [];
  let auditAttempts = 0;
  let audited = 0;
  let stopReason = '';

  try {
    for (const wave of waves) {
      if (qualifiedTargetMet(qualified, { maxQualified, targetLeads, requireQualifiedMix })) {
        stopReason = 'qualified_target_met';
        break;
      }
      if (auditAttempts >= maxAuditAttempts) {
        stopReason = 'max_audit_attempts';
        break;
      }
      if (Date.now() - startedAt >= maxRunMs) {
        stopReason = 'max_run_minutes';
        break;
      }

      const stats = {
        name: wave.name,
        candidates: wave.candidates.length,
        auditAttempts: 0,
        audited: 0,
        qualified: 0,
        rejected: 0,
        stopped: false,
        stopReason: '',
      };
      waveStats.push(stats);
      let nextIndex = 0;

      while (
        nextIndex < wave.candidates.length
        && qualified.length < qualifiedLimit
        && !qualifiedTargetMet(qualified, { maxQualified, targetLeads, requireQualifiedMix })
      ) {
        if (auditAttempts >= maxAuditAttempts) {
          stopReason = 'max_audit_attempts';
          stats.stopped = true;
          stats.stopReason = stopReason;
          break;
        }
        if (Date.now() - startedAt >= maxRunMs) {
          stopReason = 'max_run_minutes';
          stats.stopped = true;
          stats.stopReason = stopReason;
          break;
        }

        const batch = [];
        while (
          nextIndex < wave.candidates.length
          && batch.length < auditConcurrency
          && auditAttempts + batch.length < maxAuditAttempts
        ) {
          const candidate = wave.candidates[nextIndex];
          const index = wave.indexes[nextIndex];
          nextIndex++;
          if (deliveredKeys.has(businessKey(candidate))) continue;
          batch.push({ candidate, index, wave: wave.name });
        }
        if (!batch.length) continue;

        auditAttempts += batch.length;
        stats.auditAttempts += batch.length;
        const results = await Promise.all(batch.map(async entry => {
          const started = Date.now();
          try {
            const audit = await auditFn(entry.candidate, auditSession ? { auditSession } : {});
            return {
              ...entry,
              latencyMs: Date.now() - started,
              audit,
            };
          } catch (err) {
            return { ...entry, latencyMs: Date.now() - started, error: err };
          }
        }));
        const auditedInBatch = results.filter(result => !result.error && result.audit?.status === 'audited').length;
        audited += auditedInBatch;
        stats.audited += auditedInBatch;

        for (const result of results) {
          if (qualified.length >= qualifiedLimit || qualifiedTargetMet(qualified, { maxQualified, targetLeads, requireQualifiedMix })) break;

          const { candidate, index } = result;
          let rejectionReason = '';
          let scored = null;
          let audit = result.audit || {};
          if (result.error) {
            rejectionReason = `audit failed: ${result.error.message}`;
            if (verbose) console.log(`[${index + 1}/${candidates.length}] ${candidate.businessName} -> audit error: ${result.error.message}`);
            rejections.push(rejection(candidate, rejectionReason, { wave: wave.name }));
            stats.rejected++;
            diagnostics.record(progressEvent({
              candidate,
              wave: wave.name,
              index,
              total: candidates.length,
              latencyMs: result.latencyMs,
              audit,
              rejectionReason,
              auditAttempts,
              qualified: qualified.length,
            }));
            continue;
          }

          // Promising gate - Stage 1 already decided whether this real-site
          // candidate is worth Stage 2 + scoring. Skip non-promising real sites.
          if (audit.promising === false) {
            rejectionReason = `not promising: ${audit.promisingReason || 'unknown'}`;
            if (verbose) console.log(`[${index + 1}/${candidates.length}] NOT-PROMISING (${audit.promisingReason || 'unknown'}) ws=${audit.status} stage=${audit.auditStage || '-'} | ${candidate.businessName}`);
            rejections.push(rejection(candidate, rejectionReason, { wave: wave.name }));
            stats.rejected++;
            diagnostics.record(progressEvent({
              candidate,
              wave: wave.name,
              index,
              total: candidates.length,
              latencyMs: result.latencyMs,
              audit,
              rejectionReason,
              auditAttempts,
              qualified: qualified.length,
            }));
            continue;
          }

          const enrichedCandidate = {
            ...candidate,
            contactName: candidate.contactName || audit.contactName || '',
            contactTitle: candidate.contactTitle || audit.contactTitle || '',
            phone: candidate.phone || audit.phone || '',
            email: firstContactEmail(candidate, audit),
          };
          scored = scoreFn(enrichedCandidate, audit);
          const lead = {
            ...enrichedCandidate,
            phone: scored.phone,
            email: enrichedCandidate.email,
            website: scored.website,
            score: scored.score,
            reasons: scored.reasons,
            blockers: scored.blockers,
            decisionMaker: scored.decisionMaker,
            pitch: scored.pitch,
            isLocalMarket: scored.isLocalMarket,
            websiteStatus: scored.websiteStatus,
            leadType: scored.leadType,
            signalCount: scored.signalCount,
            websiteIssue: scored.websiteIssue,
            decisionMakerConfidence: scored.decisionMakerConfidence,
            audit: summarizeAudit(audit),
          };

          if (scored.qualified && scored.score >= QUALIFIED_SCORE) {
            qualified.push(lead);
            stats.qualified++;
          } else {
            // Prefer explicit blockers, then a real score-below message, and only fall
            // back to reasons[0] if neither applies. Without this guard, a positive
            // reason like "Independent home-service niche fit" would surface as the
            // rejection cause and bury the actual reason (sub-threshold score).
            const scoreNum = Number(scored.score || 0);
            rejectionReason = scored.blockers[0]
              || (scoreNum < QUALIFIED_SCORE
                ? `score ${scoreNum.toFixed(1)} below ${QUALIFIED_SCORE}`
                : scored.reasons[0] || `score below ${QUALIFIED_SCORE}`);
            rejections.push(rejection(candidate, rejectionReason, {
              score: scored.score,
              wave: wave.name,
            }));
            stats.rejected++;
          }

          diagnostics.record(progressEvent({
            candidate,
            wave: wave.name,
            index,
            total: candidates.length,
            latencyMs: result.latencyMs,
            audit,
            rejectionReason,
            score: scored?.score,
            auditAttempts,
            qualified: qualified.length,
          }));

          if (verbose) {
            const flag = scored.qualified && scored.score >= QUALIFIED_SCORE ? 'QUAL' : 'rej ';
            const sc = Number(scored.score || 0).toFixed(1);
            const stage = audit.auditStage || '-';
            console.log(`[${index + 1}/${candidates.length}] ${flag} score=${sc} ws=${audit.status} stage=${stage} wave=${wave.name} | qualified=${qualified.length}/${qualifiedLimit} | ${candidate.businessName}`);
          }
        }

        const waveStopReason = stopWaveReason(stats, wave, { targetLeads, requireQualifiedMix });
        if (waveStopReason) {
          stats.stopped = true;
          stats.stopReason = waveStopReason;
          break;
        }
      }

      diagnostics.flushProgress({
        type: 'wave_complete',
        wave: stats.name,
        stats,
        totalAuditAttempts: auditAttempts,
        totalQualified: qualified.length,
        qualifiedYield: auditAttempts ? Number((qualified.length / auditAttempts).toFixed(3)) : 0,
      });

      if (stopReason) break;
      if (stats.stopped && wave.name === 'website_rich_low_priority') {
        stopReason = stats.stopReason;
        continue;
      }
    }
  } finally {
    diagnostics.close({
      type: 'run_complete',
      auditAttempts,
      audited,
      qualified: qualified.length,
      rejected: rejections.length,
      stopReason: stopReason || (qualifiedTargetMet(qualified, { maxQualified, targetLeads, requireQualifiedMix }) ? 'qualified_target_met' : ''),
    });
    if (ownsAuditSession && auditSession) await auditSession.close();
  }

  return {
    qualified,
    rejections,
    auditAttempts,
    audited,
    stopReason: stopReason || (qualifiedTargetMet(qualified, { maxQualified, targetLeads, requireQualifiedMix }) ? 'qualified_target_met' : ''),
    waveStats,
    diagnostics: diagnostics.summary(),
  };
}

function normalizeAuditConcurrency(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildAuditWaves(candidates = [], options = {}) {
  const groups = (options.preferWebsiteLeads
    ? [
      { name: 'possible_poor_site', candidates: [], indexes: [] },
      { name: 'website_rich_low_priority', candidates: [], indexes: [] },
      { name: 'no_source_website', candidates: [], indexes: [] },
    ]
    : [
    { name: 'no_source_website', candidates: [], indexes: [] },
    { name: 'possible_poor_site', candidates: [], indexes: [] },
    { name: 'website_rich_low_priority', candidates: [], indexes: [] },
    ]);
  const byName = new Map(groups.map(group => [group.name, group]));
  candidates.forEach((candidate, index) => {
    const name = candidate.sourceOpportunity || (candidate.website ? 'possible_poor_site' : 'no_source_website');
    const group = byName.get(name) || byName.get('possible_poor_site');
    group.candidates.push(candidate);
    group.indexes.push(index);
  });
  return groups.filter(group => group.candidates.length);
}

function shouldStopWave(stats, wave, options = {}) {
  return Boolean(stopWaveReason(stats, wave, options));
}

function stopWaveReason(stats, wave, options = {}) {
  if (!stats) return '';
  if (options.requireQualifiedMix && wave.name === 'no_source_website') {
    const cap = Math.max(1, Number(options.targetLeads || TARGET_DAILY_LEADS));
    if (stats.qualified >= cap) return `bucket_saturated:${wave.name}:${stats.qualified}/${cap}`;
  }
  if (stats.auditAttempts < WAVE_LOW_YIELD_MIN_ATTEMPTS) return '';
  if (wave.name === 'no_source_website') return '';
  const yieldRate = stats.qualified / Math.max(1, stats.auditAttempts);
  return yieldRate < WAVE_LOW_YIELD_MIN_RATE ? lowYieldReason(stats) : '';
}

function lowYieldReason(stats) {
  const yieldRate = stats.auditAttempts ? stats.qualified / stats.auditAttempts : 0;
  return `low_yield:${stats.name}:${stats.qualified}/${stats.auditAttempts}:${yieldRate.toFixed(3)}`;
}

function qualifiedTargetMet(qualified, options = {}) {
  const maxQualified = Number(options.maxQualified || TARGET_DAILY_LEADS * 2);
  if (qualified.length < maxQualified) return false;
  if (!options.requireQualifiedMix) return true;
  return hasQualifiedMix(qualified, Number(options.targetLeads || TARGET_DAILY_LEADS));
}

function hasQualifiedMix(qualified, target) {
  const bucketMin = Math.max(1, Math.floor(target * 0.4));
  const noWebsite = qualified.filter(lead => leadBucket(lead) === 'noWebsite').length;
  const poorWebsite = qualified.filter(lead => leadBucket(lead) === 'poorWebsite').length;
  const nicheCount = new Set(qualified.map(lead => normalizeNiche(lead.niche))).size;
  const minNiches = target >= 20 ? 6 : Math.min(3, target);
  return noWebsite >= bucketMin && poorWebsite >= bucketMin && nicheCount >= minNiches;
}

function rejection(candidate, reason, extra = {}) {
  return {
    reason,
    businessName: candidate.businessName,
    sourceName: candidate.sourceName || '',
    sourceOpportunity: candidate.sourceOpportunity || '',
    niche: candidate.niche || '',
    city: candidate.city || '',
    state: candidate.state || '',
    ...extra,
  };
}

function diagnosticsEnabled() {
  return process.env.LATCHLY_DIAGNOSTICS !== '0';
}

function createDiagnosticsWriter(file, options = {}) {
  const interval = Number(options.interval || DIAGNOSTIC_INTERVAL);
  const recent = [];
  const summaryStats = {
    path: file || '',
    records: 0,
    progressWrites: 0,
    sourceCounts: {},
    rejectionCounts: {},
    stageCounts: {},
    latencyMs: { total: 0, max: 0 },
  };
  if (file) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, '');
  }

  const write = payload => {
    if (!file) return;
    fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`);
  };

  return {
    record(event) {
      summaryStats.records++;
      bump(summaryStats.sourceCounts, event.sourceName || 'unknown');
      if (event.rejectionReason) bump(summaryStats.rejectionCounts, event.rejectionReason);
      bump(summaryStats.stageCounts, event.auditStage || 'unknown');
      summaryStats.latencyMs.total += Number(event.latencyMs || 0);
      summaryStats.latencyMs.max = Math.max(summaryStats.latencyMs.max, Number(event.latencyMs || 0));
      recent.push(event);
      if (recent.length > interval) recent.shift();
      if (event.auditAttempts && event.auditAttempts % interval === 0) {
        summaryStats.progressWrites++;
        write({
          type: 'progress',
          auditAttempts: event.auditAttempts,
          qualified: event.qualified,
          qualifiedYield: event.qualifiedYield,
          recent,
          sourceCounts: summaryStats.sourceCounts,
          rejectionCounts: summaryStats.rejectionCounts,
          stageCounts: summaryStats.stageCounts,
        });
      }
    },
    flushProgress(payload) {
      write(payload);
    },
    close(payload) {
      write(payload);
    },
    summary() {
      const average = summaryStats.records
        ? Math.round(summaryStats.latencyMs.total / summaryStats.records)
        : 0;
      return {
        ...summaryStats,
        latencyMs: {
          average,
          max: summaryStats.latencyMs.max,
        },
      };
    },
  };
}

function progressEvent({ candidate, wave, index, total, latencyMs, audit, rejectionReason, score, auditAttempts, qualified }) {
  return {
    wave,
    index: index + 1,
    total,
    businessName: candidate.businessName,
    sourceName: candidate.sourceName || '',
    sourceOpportunity: candidate.sourceOpportunity || '',
    niche: candidate.niche || '',
    market: `${candidate.city || ''}, ${candidate.state || ''}`.trim().replace(/^,\s*/, ''),
    latencyMs,
    auditStage: audit.auditStage || audit.status || 'error',
    websiteStatus: audit.verifiedSignals?.websiteTruth?.status || audit.status || '',
    rejectionReason,
    score,
    auditAttempts,
    qualified,
    qualifiedYield: auditAttempts ? Number((qualified / auditAttempts).toFixed(3)) : 0,
  };
}

function firstContactEmail(lead = {}, audit = {}) {
  return [
    lead.email,
    lead.rawPayload?.email,
    lead.rawPayload?.Email,
    audit.email,
    ...(Array.isArray(audit.emails) ? audit.emails : []),
    ...(audit.verifiedSignals?.contactTruth?.emails || []).map(item => item?.value),
  ]
    .map(value => String(value || '').trim().toLowerCase())
    .find(value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) || '';
}

function bump(object, key) {
  object[key] = (object[key] || 0) + 1;
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
  const bucketMin = Math.floor(target * 0.4);
  const qualifiedPoorWebsite = leads.filter(lead => leadBucket(lead) === 'poorWebsite').length;
  return {
    localMin: Math.ceil(target * LOCAL_SHARE_MIN),
    localMax: Math.ceil(target * LOCAL_SHARE_MAX),
    bucketMin,
    bucketMax: Math.ceil(target * 0.6),
    // Prefer the configured no-site ceiling, but do not under-deliver when
    // verified poor-site supply is short and verified no-site supply exists.
    noWebsiteCeiling: qualifiedPoorWebsite >= bucketMin
      ? Math.max(1, Math.floor(target * NO_WEBSITE_MAX_SHARE))
      : target,
    noWebsiteTarget,
    poorWebsiteTarget: target - noWebsiteTarget,
    nicheCap: distinctNiches >= 6 ? Math.ceil(target * 0.2) : Math.ceil(target * 0.3),
    relaxedNicheCap: dominanceSafeNicheCap(target, distinctNiches),
    minNiches: distinctNiches >= 6 ? 6 : distinctNiches,
  };
}

function dominanceSafeNicheCap(target, distinctNiches) {
  if (distinctNiches <= 1) return target;
  return Math.max(1, Math.floor(target * 0.6));
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
  // No-website ceiling applies in every relaxation path, but the ceiling can
  // expand to target when poor-site qualified supply is short.
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

function sortTieredLeads(a, b) {
  return Number(b.tier === 'premium') - Number(a.tier === 'premium')
    || sortLeads(a, b);
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

function topReasonsBySource(rejections) {
  const counts = new Map();
  for (const rejection of rejections) {
    const key = `${rejection.sourceName || 'unknown'}|${rejection.sourceOpportunity || 'unknown'}|${rejection.reason || 'unknown'}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => {
      const [sourceName, sourceOpportunity, reason] = key.split('|');
      return { sourceName, sourceOpportunity, reason, count };
    });
}

function summarizeAudit(audit) {
  return {
    status: audit.status,
    finalUrl: audit.finalUrl,
    auditor: audit.auditor,
    pagesChecked: audit.pagesChecked,
    phone: audit.phone,
    emails: audit.emails,
    signals: audit.signals,
    verifiedSignals: audit.verifiedSignals,
    decisionMaker: audit.decisionMaker,
    signalCount: audit.signalCount,
    noWebsite: audit.noWebsite,
    poorWebsite: audit.poorWebsite,
    websiteIssue: audit.websiteIssue,
    decisionMakerConfidence: audit.decisionMakerConfidence,
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
  auditAndScoreCandidates,
  buildAuditWaves,
  hasQualifiedMix,
  selectDailyLeads,
  selectTieredLeads,
  qualifiedTargetMet,
  shouldStopWave,
  summarizeSelection,
  leadBucket,
  selectionLimits,
  firstContactEmail,
};
