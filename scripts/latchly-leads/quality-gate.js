#!/usr/bin/env node
const fs = require('fs');
const {
  MIN_DAILY_LEADS,
  QUALIFIED_SCORE,
} = require('./config');

function runQualityGate(leads, stats = {}, options = {}) {
  const minimum = Number(options.minimum || stats.minimum || MIN_DAILY_LEADS);
  const qualifiedScore = Number(options.qualifiedScore || QUALIFIED_SCORE);
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

  const unverifiable = sorted.filter(lead => !hasVerifiableAudit(lead));
  if (unverifiable.length) {
    issues.push({
      code: 'unverifiable_audit_evidence',
      severity: 'reject',
      message: `${unverifiable.length} selected leads lack verifiable structured audit evidence.`,
      examples: unverifiable.slice(0, 5).map(lead => lead.businessName || 'unknown'),
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
    if (sorted.length < minimum) {
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
  if (!verified.evidenceIntegrity?.verifiable) return false;
  if (Number(lead.score || 0) < QUALIFIED_SCORE) return true;

  if (lead.leadType === 'no_website_creation' || lead.websiteStatus === 'no_website' || !lead.website) {
    return verified.websiteTruth?.status === 'no_site'
      && Number(verified.websiteTruth?.confidence || 0) >= 0.8
      && Array.isArray(verified.websiteTruth?.evidence)
      && verified.websiteTruth.evidence.length > 0;
  }

  if (lead.leadType === 'poor_website_redesign' || lead.websiteStatus === 'poor_website') {
    const negatives = verified.websiteQuality?.negativeSignals || [];
    return verified.websiteTruth?.status === 'real_business_website'
      && negatives.filter(signal => signal.url && signal.source && signal.weight >= 0.6 && Number(signal.confidence || 0) >= 0.7).length >= 4;
  }

  return false;
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
  hasVerifiableAudit,
  isFlatScoreDistribution,
};
