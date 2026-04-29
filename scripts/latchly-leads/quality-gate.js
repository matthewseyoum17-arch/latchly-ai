#!/usr/bin/env node
const fs = require('fs');
const {
  MIN_DAILY_LEADS,
  PREMIUM_TIER,
  QUALIFIED_SCORE,
} = require('./config');

function runQualityGate(leads, stats = {}, options = {}) {
  return enforceStandardGate(leads, stats, options);
}

function enforceStandardGate(leads, stats = {}, options = {}) {
  const minimum = Number(options.minimum || stats.minimum || MIN_DAILY_LEADS);
  const qualifiedScore = Number(options.qualifiedScore || QUALIFIED_SCORE);
  const softFailDominanceUnderTarget = options.softFailDominanceUnderTarget !== false;
  const sorted = [...(leads || [])].sort(sortByScore);
  const issues = [];

  if (sorted.length < minimum) {
    issues.push({
      code: 'under_target',
      severity: 'under_target',
      message: `Only ${sorted.length} verified score ${qualifiedScore}+ leads remain; minimum is ${minimum}.`,
    });
  }

  const belowScore = sorted.filter(lead => Number(lead.score || 0) < qualifiedScore);
  if (belowScore.length) {
    issues.push({
      code: 'below_score_threshold',
      severity: 'reject',
      message: `${belowScore.length} selected leads are below score ${qualifiedScore}.`,
    });
  }

  const unverifiable = sorted
    .map(lead => ({ lead, verdict: hasVerifiableAudit(lead) }))
    .filter(item => !item.verdict.ok);
  if (unverifiable.length) {
    issues.push({
      code: 'unverifiable_audit_evidence',
      severity: 'reject',
      message: `${unverifiable.length} selected leads lack verifiable structured audit evidence.`,
      examples: unverifiable.slice(0, 5).map(item => ({
        businessName: item.lead.businessName || 'unknown',
        reasons: item.verdict.reasons,
      })),
    });
  }

  if (isFlatScoreDistribution(sorted)) {
    issues.push({
      code: 'flat_score_distribution',
      severity: 'reject',
      message: 'Selected batch has an unrealistically flat score distribution.',
    });
  }

  if (sorted.length && sorted.every(isGoodSiteLead)) {
    issues.push({
      code: 'all_good_sites',
      severity: 'reject',
      message: 'Selected batch contains only good/ordinary websites and no verified no-site or poor-site opportunities.',
    });
  }

  if (Number(stats.localQualified || 0) > 0 && sorted.filter(lead => lead.isLocalMarket).length === 0) {
    issues.push({
      code: 'zero_local_delivery',
      severity: 'reject',
      message: 'Local Gainesville/Tallahassee supply existed, but no local leads were selected.',
    });
  }

  const dominantNiche = dominantNicheIssue(sorted);
  if (dominantNiche) {
    // When supply is thin (under target), niche dominance is unavoidable —
    // downgrade to a warning so we still deliver what we have. Diversification
    // is a discovery-side problem, not a reason to throw the batch away.
    if (softFailDominanceUnderTarget && sorted.length < minimum) {
      dominantNiche.severity = 'under_target';
      dominantNiche.message += ' (downgraded to warning: under target supply)';
    }
    issues.push(dominantNiche);
  }

  return {
    ok: !issues.some(issue => issue.severity === 'reject'),
    underTarget: issues.some(issue => issue.code === 'under_target' || (issue.code === 'one_niche_dominance' && issue.severity === 'under_target')),
    issues,
    leads: sorted,
  };
}

function hasVerifiableAudit(lead) {
  const audit = lead.audit || {};
  const verified = audit.verifiedSignals || {};
  const reasons = [];
  const signalCount = Number(lead.signalCount ?? audit.signalCount ?? verified.signalSummary?.count ?? 0);
  const dmConfidence = normalizeDmConfidence(lead.decisionMakerConfidence ?? lead.decisionMaker?.confidence ?? audit.decisionMakerConfidence ?? verified.signalSummary?.decisionMakerConfidence ?? 0);
  if (!verified.evidenceIntegrity?.verifiable) reasons.push('Audit evidence integrity is not verifiable');
  if (Number(lead.score || 0) < QUALIFIED_SCORE) {
    return { ok: reasons.length === 0, reasons, signalCount, dmConfidence };
  }

  if (lead.leadType === 'no_website_creation' || lead.websiteStatus === 'no_website' || !lead.website) {
    const ok = verified.websiteTruth?.status === 'no_site'
      && Number(verified.websiteTruth?.confidence || 0) >= 0.8
      && Array.isArray(verified.websiteTruth?.evidence)
      && verified.websiteTruth.evidence.length > 0;
    if (!ok) reasons.push('Missing verified no-site evidence');
    return { ok: reasons.length === 0, reasons, signalCount, dmConfidence };
  }

  if (lead.leadType === 'poor_website_redesign' || lead.websiteStatus === 'poor_website') {
    const ok = hasVerifiedPoorSiteEvidence(verified);
    if (!ok) reasons.push('Missing verified poor-site evidence');
    return { ok: reasons.length === 0, reasons, signalCount, dmConfidence };
  }

  reasons.push('Lead has no verified no-website or poor-website opportunity');
  return { ok: false, reasons, signalCount, dmConfidence };
}

function hasVerifiedPoorSiteEvidence(verified = {}) {
  if (verified.websiteTruth?.status !== 'real_business_website') return false;
  const negatives = verified.websiteQuality?.negativeSignals || [];
  const concreteVerified = negatives.filter(signal =>
    signal.url
    && signal.source
    && Number(signal.weight || 0) >= 0.6
    && Number(signal.confidence || 0) >= 0.7
  );
  const severeVerified = concreteVerified.filter(signal => Number(signal.weight || 0) >= 0.9);
  const evidenceWeight = concreteVerified.reduce((sum, signal) => sum + Number(signal.weight || 0), 0);

  return (evidenceWeight >= 2.8 && concreteVerified.length >= 3 && severeVerified.length >= 1)
    || (severeVerified.length >= 2 && evidenceWeight >= 2.5);
}

function enforcePremiumGate(leads, stats = {}, options = {}) {
  const minimum = Number(options.minimum ?? stats.minimum ?? 0);
  const gate = options.premiumTier || PREMIUM_TIER;
  const sorted = [...(leads || [])].sort(sortByScore);
  const accepted = [];
  const rejected = [];

  for (const lead of sorted) {
    const auditVerdict = hasVerifiableAudit(lead);
    const reasons = [...auditVerdict.reasons];
    const signalCount = Number(lead.signalCount ?? auditVerdict.signalCount ?? 0);
    const dmConfidence = normalizeDmConfidence(
      lead.decisionMakerConfidence
        ?? lead.decisionMaker?.confidence
        ?? auditVerdict.dmConfidence
        ?? 0,
    );
    const websiteIssue = Boolean(
      lead.websiteIssue
        || lead.audit?.websiteIssue
        || lead.audit?.verifiedSignals?.signalSummary?.websiteIssue
        || lead.leadType === 'no_website_creation'
        || lead.leadType === 'poor_website_redesign'
        || lead.websiteStatus === 'no_website'
        || lead.websiteStatus === 'poor_website',
    );

    if (Number(lead.score || 0) < gate.minScore) reasons.push(`Score below premium floor ${gate.minScore}`);
    if (signalCount < gate.minSignalCount) reasons.push(`Signal count ${signalCount} below premium floor ${gate.minSignalCount}`);
    if (gate.requireWebsiteIssue && !websiteIssue) reasons.push('Missing no-website or poor-website opportunity');
    if (dmConfidence < gate.minDmConfidence) reasons.push(`Decision-maker confidence ${dmConfidence.toFixed(2)} below premium floor ${gate.minDmConfidence}`);

    if (reasons.length) {
      rejected.push({ lead, reasons, signalCount, dmConfidence, websiteIssue });
    } else {
      accepted.push({
        ...lead,
        tier: 'premium',
        signalCount,
        websiteIssue,
        decisionMakerConfidence: dmConfidence,
      });
    }
  }

  const issues = [];
  if (minimum && accepted.length < minimum) {
    issues.push({
      code: 'under_target',
      severity: 'under_target',
      message: `Only ${accepted.length} premium leads remain; target is ${minimum}.`,
    });
  }
  if (rejected.length) {
    issues.push({
      code: 'premium_gate_rejected',
      severity: 'reject',
      message: `${rejected.length} leads failed premium requirements.`,
      examples: rejected.slice(0, 5).map(item => ({
        businessName: item.lead.businessName || 'unknown',
        reasons: item.reasons,
      })),
    });
  }
  const dominantNiche = dominantNicheIssue(accepted);
  if (dominantNiche) issues.push(dominantNiche);

  return {
    ok: !issues.some(issue => issue.severity === 'reject'),
    underTarget: issues.some(issue => issue.code === 'under_target'),
    issues,
    leads: accepted,
    rejected,
  };
}

function isFlatScoreDistribution(leads) {
  if (leads.length < 10) return false;
  const scores = leads.map(lead => Number(lead.score || 0).toFixed(1));
  const unique = new Set(scores);
  if (unique.size === 1) return true;
  if (leads.length >= 50 && unique.size <= 2) return true;
  return false;
}

function isGoodSiteLead(lead) {
  return lead.website
    && lead.websiteStatus !== 'poor_website'
    && lead.leadType !== 'poor_website_redesign'
    && lead.websiteStatus !== 'no_website'
    && lead.leadType !== 'no_website_creation';
}

function dominantNicheIssue(leads) {
  if (leads.length < 10) return null;
  const counts = new Map();
  for (const lead of leads) {
    const niche = String(lead.niche || 'unknown').toLowerCase();
    counts.set(niche, (counts.get(niche) || 0) + 1);
  }
  const [niche, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const share = count / leads.length;
  if (counts.size === 1 || share > 0.6) {
    return {
      code: 'one_niche_dominance',
      severity: 'reject',
      message: `${niche || 'unknown'} represents ${Math.round(share * 100)}% of selected leads.`,
    };
  }
  return null;
}

function sortByScore(a, b) {
  return Number(b.score || 0) - Number(a.score || 0)
    || String(a.businessName || '').localeCompare(String(b.businessName || ''));
}

function normalizeDmConfidence(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= 1) return num;
  if (num <= 10) return num / 10;
  return 1;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/latchly-leads/quality-gate.js <daily-json-or-leads-json>');
    process.exit(2);
  }
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const leads = Array.isArray(payload) ? payload : payload.leads;
  const stats = Array.isArray(payload) ? {} : payload.stats || {};
  const result = runQualityGate(leads, stats);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok || (result.underTarget && process.env.LATCHLY_FAIL_UNDER_TARGET === '1')) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  runQualityGate,
  enforceStandardGate,
  enforcePremiumGate,
  hasVerifiableAudit,
  isFlatScoreDistribution,
};
