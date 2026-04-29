const {
  CHAIN_PATTERNS,
  HOME_SERVICE_NICHES,
  LOCAL_MARKETS,
  QUALIFIED_SCORE,
} = require('./config');
const { normalizePhone, normalizeWebsite, stripHtml } = require('./utils');

const HIGH_TICKET = /roof|hvac|heating|cooling|air conditioning|restoration|foundation|remodel|construction|garage door|electrical|plumb/i;
const HOME_SERVICE_RE = new RegExp(HOME_SERVICE_NICHES.map(escapeRegExp).join('|'), 'i');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isChainBusiness(name) {
  return CHAIN_PATTERNS.some(pattern => pattern.test(String(name || '')));
}

function isHomeService(lead) {
  const text = `${lead.niche || ''} ${lead.businessName || ''}`;
  return HOME_SERVICE_RE.test(text)
    || /roof|hvac|plumb|electric|remodel|restoration|garage|pest|tree|landscap|pool|fence|concrete|paint|floor|gutter|septic|siding|insulation|handyman|pressure wash|junk/i.test(text);
}

function isLocalMarket(lead) {
  const city = String(lead.city || '').toLowerCase();
  const state = String(lead.state || '').toUpperCase();
  return LOCAL_MARKETS.some(market => market.city.toLowerCase() === city && market.state === state);
}

function pickDecisionMaker(lead) {
  const legacyDecisionMakerName = typeof lead.decisionMaker === 'string'
    ? lead.decisionMaker
    : '';
  const candidates = [
    { name: lead.decisionMaker?.name, title: lead.decisionMaker?.title, rank: normalizeDmConfidence(lead.decisionMaker?.confidence) * 100, confidence: lead.decisionMaker?.confidence },
    { name: lead.decisionMakerName, title: lead.decisionMakerTitle, rank: normalizeDmConfidence(lead.decisionMakerConfidence) * 100, confidence: lead.decisionMakerConfidence },
    { name: lead.ownerName, title: lead.ownerTitle || 'Owner', rank: 100 },
    { name: legacyDecisionMakerName, title: lead.title, rank: titleRank(lead.title) },
    { name: lead.contactName, title: lead.contactTitle, rank: titleRank(lead.contactTitle) },
  ].map(item => ({ ...item, name: cleanPersonName(item.name) }))
    .filter(item => item.name);

  if (!candidates.length) return { name: '', title: '', confidence: 0 };
  candidates.sort((a, b) => b.rank - a.rank);
  const best = candidates[0];
  return {
    name: best.name,
    title: best.title || '',
    confidence: best.confidence == null ? (best.rank >= 80 ? 10 : best.rank >= 55 ? 8 : 6) : best.confidence,
  };
}

function titleRank(title) {
  const value = String(title || '');
  if (/owner|founder|principal|president|ceo|co-owner/i.test(value)) return 100;
  if (/general manager|manager|operations|director|administrator/i.test(value)) return 75;
  if (/office|admin|coordinator|contact/i.test(value)) return 55;
  if (value) return 40;
  return 20;
}

function extractHtmlSignals(html, url = '') {
  const h = String(html || '');
  const lower = h.toLowerCase();
  const visibleText = stripHtml(h);
  const signals = {
    htmlLength: h.length,
    visibleLength: visibleText.length,
    hasViewport: /<meta[^>]+name=["']viewport/i.test(h),
    hasResponsiveCss: /@media\s*\(|display:\s*(grid|flex)|bootstrap|tailwind|wix-thunderbolt|fluid-engine/i.test(h),
    hasForm: /<form\b/i.test(h),
    hasTel: /href=["']tel:/i.test(h),
    hasMailto: /href=["']mailto:/i.test(h),
    hasQuoteCta: /free quote|free estimate|get a quote|get an estimate|request service|schedule service|book now|call now|contact us/i.test(visibleText),
    hasReviews: /review|testimonial|rating|stars|customer feedback|what our customers say/i.test(visibleText),
    hasTrust: /licensed|insured|bonded|certified|warranty|guarantee|family owned|locally owned|years of experience/i.test(visibleText),
    hasSchema: /application\/ld\+json/i.test(h),
    hasCustomFonts: /fonts\.googleapis|typekit|fonts\.adobe|font-face/i.test(h),
    hasModernFramework: /next\.js|react|vue|svelte|webflow|wix-thunderbolt|fluid-engine/i.test(lower),
    tableLayout: (h.match(/<table\b/gi) || []).length >= 4,
    builder: detectBuilder(h),
    staleCopyrightYear: staleCopyrightYear(h),
    oldTech: /jquery[\/-]1\.|revslider|revolution slider|flash|\.swf|mootools|prototype\.js|<!--\s*\[if\s+(lt\s+)?IE/i.test(h),
    notHttps: !!url && !/^https:/i.test(url),
  };
  return signals;
}

function detectBuilder(html) {
  const h = String(html || '');
  if (/wix\.com|wixsite\.com|_wix/i.test(h)) return 'Wix';
  if (/squarespace\.com|squarespace-cdn/i.test(h)) return 'Squarespace';
  if (/godaddy\.com|secureserver\.net|websites\.godaddy/i.test(h)) return 'GoDaddy Website Builder';
  if (/weebly\.com|weeblycloud/i.test(h)) return 'Weebly';
  if (/sites\.google\.com/i.test(h)) return 'Google Sites';
  return '';
}

function staleCopyrightYear(html) {
  const match = String(html || '').match(/(?:copyright|©)\s*(?:\D{0,12})?(20\d{2}|19\d{2})/i);
  if (!match) return 0;
  const year = Number(match[1]);
  const current = new Date().getFullYear();
  return year > 0 && year <= current - 4 ? year : 0;
}

function scoreLead(lead, audit = {}) {
  const verified = audit.verifiedSignals || {};
  const phone = normalizePhone(lead.phone || verified.contactTruth?.phone?.value || audit.phone || '');
  const website = normalizeWebsite(lead.website || audit.finalUrl || '');
  const decisionMaker = pickDecisionMaker({
    ...lead,
    decisionMaker: lead.decisionMaker || audit.decisionMaker,
    decisionMakerName: lead.decisionMakerName || audit.decisionMaker?.name,
    decisionMakerTitle: lead.decisionMakerTitle || audit.decisionMaker?.title,
    decisionMakerConfidence: lead.decisionMakerConfidence || audit.decisionMaker?.confidence,
  });
  const reasons = [];
  const blockers = [];
  const homeService = isHomeService(lead);
  const localMarket = isLocalMarket(lead);
  let websiteStatus = website ? 'has_website' : 'no_website';
  let leadType = website ? 'website_review' : 'no_website_creation';
  let score = 1;

  if (!lead.businessName) {
    blockers.push('Missing business name');
  }
  if (isChainBusiness(lead.businessName)) {
    blockers.push('Chain/franchise/national brand pattern detected');
  }
  if (!homeService) {
    blockers.push('Not classified as a home service business');
  }
  if (!phone) {
    blockers.push('Missing phone number');
  }
  if (!lead.city || !lead.state) {
    blockers.push('Missing city/state market');
  }

  if (homeService) {
    score += 0.9;
    reasons.push('Independent home-service niche fit');
  }

  if (!website) {
    websiteStatus = 'no_website';
    leadType = 'no_website_creation';
    const noSiteVerified = verified.websiteTruth?.status === 'no_site'
      && Number(verified.websiteTruth?.confidence || 0) >= 0.8
      && hasEvidence(verified.websiteTruth);
    if (!noSiteVerified) {
      blockers.push('Missing verified no-website audit evidence');
    } else {
      score += 5.5;
      reasons.push('Verified no website found, making this a website creation opportunity');
    }
  } else {
    const signals = audit.signals || extractHtmlSignals(audit.html || '', website);
    const hasUsableAudit = hasUsableVerifiedWebsiteAudit(audit, signals);
    const findings = verified.websiteQuality?.negativeSignals?.length
      ? verified.websiteQuality.negativeSignals
      : (hasUsableAudit ? siteIssueFindings(signals).map(finding => ({
          ...finding,
          confidence: 0.7,
          url: audit.pagesChecked?.[0] || audit.finalUrl || website,
          source: audit.auditor || 'derived-html',
        })) : []);
    const concreteFindings = findings.filter(finding => finding.weight >= 0.6);
    const severeFindings = findings.filter(finding => finding.weight >= 0.9);
    const evidenceWeight = concreteFindings.reduce((sum, finding) => sum + finding.weight, 0);
    const issueReasons = unique([
      ...findings.map(finding => finding.reason),
      ...sourceIssueReasons(lead.sourceIssues),
    ]);

    if (!hasUsableAudit) {
      blockers.push('Website audit did not return verifiable page evidence');
    } else if (!verifiedEvidenceIntegrityOk(audit)) {
      blockers.push(`Website audit evidence is not verifiable: ${(verified.evidenceIntegrity?.issues || ['missing structured audit']).join('; ')}`);
    } else if (verified.websiteTruth?.status && !['real_business_website', 'parked_domain', 'directory_or_social_only'].includes(verified.websiteTruth.status)) {
      blockers.push(`Website truth is ${verified.websiteTruth.status}, not verified poor-site evidence`);
    } else {
      const concreteVerified = concreteFindings.filter(finding => Number(finding.confidence || 0) >= 0.7 && finding.url);
      const severeVerified = severeFindings.filter(finding => Number(finding.confidence || 0) >= 0.7 && finding.url);
      // Matches the loosened Stage 2 plausibility floor in audit.js. Either
      // path qualifies the lead as a poor-site redesign candidate.
      const qualifiesAsPoorSite =
        (evidenceWeight >= 2.8 && concreteVerified.length >= 3 && severeVerified.length >= 1)
        || (severeVerified.length >= 2 && evidenceWeight >= 2.5);
      if (qualifiesAsPoorSite) {
        websiteStatus = 'poor_website';
        leadType = 'poor_website_redesign';
        score += Math.min(5.8, 2.4 + (evidenceWeight * 0.55) + (severeVerified.length * 0.15));
        reasons.push(`Verified audit found ${concreteVerified.length} concrete redesign issues`);
      } else {
        blockers.push('Audited website lacks enough verified concrete bad-site evidence');
      }

      for (const reason of issueReasons) reasons.push(reason);

      if (hasStrongSiteSignals(signals)) {
        score = Math.min(score, 6.7);
        reasons.push('Strong modern site signals cap redesign urgency');
      } else if (positiveSiteSignalCount(signals) >= 6 && hardNegativeSignalCount(signals) <= 1) {
        score = Math.min(score, 7.3);
        reasons.push('Good site fundamentals reduce redesign urgency');
      } else if (signals.hasModernFramework && concreteFindings.length < 5) {
        score = Math.min(score, 7.1);
        reasons.push('Modern site signals reduce redesign urgency');
      }
    }
  }

  if (HIGH_TICKET.test(`${lead.niche || ''} ${lead.businessName || ''}`)) {
    score += 0.8;
    reasons.push('High-ticket home service niche');
  }
  if (decisionMaker.name) {
    score += normalizeDmConfidence(decisionMaker.confidence) >= 0.8 ? 0.7 : 0.4;
    reasons.push(`Decision-maker/contact available: ${decisionMaker.name}${decisionMaker.title ? ` (${decisionMaker.title})` : ''}`);
  }
  if (phone) {
    score += 0.5;
    reasons.push('Phone number available for direct follow-up');
  }
  if (localMarket) {
    score += 0.3;
    reasons.push('Gainesville/Tallahassee area fit for walk-in pitch');
  }
  if (lead.sourceScore && Number(lead.sourceScore) >= 9 && (leadType === 'no_website_creation' || leadType === 'poor_website_redesign')) {
    score += 0.3;
    reasons.push('Previously sourced as a strong fit lead');
  }

  if (!verifiedBusinessTruthOk(lead, verified)) {
    blockers.push('Business truth was not verified before scoring');
  }

  if (blockers.length) score = Math.min(score, 5.9);

  const rounded = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  const pitch = buildPitchRecommendation({ ...lead, phone, website }, audit, reasons, decisionMaker);

  const signalCount = computeSignalCount({ ...lead, phone, website, websiteStatus, leadType }, audit, decisionMaker);
  const websiteIssue = leadType === 'no_website_creation' || leadType === 'poor_website_redesign';
  const dmConfidence = normalizeDmConfidence(decisionMaker.confidence);

  return {
    score: rounded,
    qualified: rounded >= QUALIFIED_SCORE && blockers.length === 0 && websiteIssue,
    reasons: unique(reasons).slice(0, 8),
    blockers,
    decisionMaker: { ...decisionMaker, confidence: dmConfidence },
    pitch,
    isLocalMarket: localMarket,
    phone,
    website,
    websiteStatus,
    leadType,
    signalCount,
    websiteIssue,
    decisionMakerConfidence: dmConfidence,
  };
}

// Counts concrete, discrete facts about a lead. Premium tier requires >=3.
// Take the max of audit-derived counts and flag-derived counts. The previous
// implementation short-circuited on `audit.signalCount === 0`, which is the
// value buildSignalSummary produces when an audit is skipped/unreachable —
// the result was every lead persisting signal_count=0 even when it had a
// phone, lat/lng, business hours, etc. that the flag fallback would have
// counted.
function computeSignalCount(lead, audit = {}, decisionMaker = {}) {
  const auditCount = Number(audit.signalCount);
  const summary = audit.verifiedSignals?.signalSummary;
  const summaryCount = Number(summary?.count);
  const flags = [
    Boolean(lead.phone && /\d{3}/.test(String(lead.phone))),
    Boolean((lead.email || lead.rawPayload?.email || lead.rawPayload?.Email || '').includes('@')),
    hasSocialProfile(lead, audit),
    googleBusinessPhotoCount(lead) >= 3,
    hasRecentReview(lead),
    Boolean(decisionMaker.name && normalizeDmConfidence(decisionMaker.confidence) >= 0.6),
    hasBusinessHours(lead),
    hasLatLng(lead),
  ];
  const flagCount = flags.filter(Boolean).length;
  return Math.max(
    Number.isFinite(auditCount) ? auditCount : 0,
    Number.isFinite(summaryCount) ? summaryCount : 0,
    flagCount,
  );
}

// pickDecisionMaker uses an integer scale (10/8/6/0). Normalize all confidence
// inputs to 0..1 so the premium gate can compare consistently.
function normalizeDmConfidence(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= 1) return num;
  if (num <= 10) return num / 10;
  return 1;
}

function hasSocialProfile(lead, audit) {
  const values = [
    lead.facebook,
    lead.instagram,
    lead.linkedin,
    lead.social,
    lead.socialUrl,
    lead.rawPayload?.facebook,
    lead.rawPayload?.instagram,
    ...(audit.links || []).map(link => link.href || ''),
  ];
  return values.some(value => /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com/i.test(String(value || '')));
}

function googleBusinessPhotoCount(lead) {
  const raw = lead.rawPayload || {};
  const value =
    lead.gbpPhotoCount
      || lead.googlePhotoCount
      || lead.photoCount
      || raw.gbpPhotoCount
      || raw.googlePhotoCount
      || raw.photo_count
      || raw.photos
      || raw.images
      || 0;
  if (Array.isArray(value)) return value.length;
  return Number(value || 0);
}

function hasRecentReview(lead) {
  const raw = lead.rawPayload || {};
  const latestReview = Array.isArray(raw.reviews) ? raw.reviews[0] : null;
  const value = lead.latestReviewDate
    || lead.recentReviewDate
    || lead.lastReviewDate
    || raw.latestReviewDate
    || raw.recentReviewDate
    || raw.last_review_date
    || latestReview?.date
    || latestReview?.iso_date;
  if (!value) return Boolean(lead.hasRecentReview || raw.hasRecentReview);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 60 * 24 * 60 * 60 * 1000;
}

function hasBusinessHours(lead) {
  const raw = lead.rawPayload || {};
  return Boolean(
    lead.businessHours
      || lead.hours
      || lead.openingHours
      || raw.businessHours
      || raw.hours
      || raw.opening_hours
      || raw.operating_hours
      || raw.open_state
  );
}

function hasLatLng(lead) {
  const raw = lead.rawPayload || {};
  const lat = lead.lat ?? lead.latitude ?? raw.lat ?? raw.latitude ?? raw.gps_coordinates?.latitude;
  const lng = lead.lng ?? lead.lon ?? lead.longitude ?? raw.lng ?? raw.lon ?? raw.longitude ?? raw.gps_coordinates?.longitude;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function cleanPersonName(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || /^[\[{]/.test(trimmed)) return '';
  return trimmed;
}

function sourceIssueReasons(sourceIssues) {
  return String(sourceIssues || '')
    .split(/;|\||\n/)
    .map(issue => issue.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function siteIssueReasons(signals) {
  return siteIssueFindings(signals).map(finding => finding.reason);
}

function siteIssueFindings(signals = {}) {
  const reasons = [];
  const add = (condition, reason, weight) => {
    if (condition) reasons.push({ reason, weight });
  };
  add(signals.visibleLength > 0 && signals.visibleLength < 3000, 'Very thin website content', signals.visibleLength < 1200 ? 1.2 : 0.9);
  add(!signals.hasViewport, 'No mobile viewport detected', 1.2);
  add(!signals.hasResponsiveCss, 'Weak responsive/mobile implementation signals', 0.9);
  add(!signals.hasQuoteCta, 'No clear quote, estimate, or service CTA', 0.8);
  add(!signals.hasForm, 'No visible contact or quote form', 0.6);
  add(!signals.hasTel, 'Phone number is not clearly clickable', 0.7);
  add(!signals.hasReviews, 'No visible reviews or testimonials', 0.5);
  add(!signals.hasTrust, 'Weak trust signals like license, warranty, or local ownership', 0.5);
  add(!signals.hasCustomFonts, 'Generic typography/branding', 0.2);
  add(signals.tableLayout, 'Old table-based layout signals', 1.1);
  add(!!signals.builder, `Template/builder site detected: ${signals.builder}`, 0.9);
  add(!!signals.staleCopyrightYear, `Stale copyright year: ${signals.staleCopyrightYear}`, 1);
  add(signals.oldTech, 'Outdated front-end technology detected', 1.2);
  add(signals.notHttps, 'Site is not using HTTPS', 1);
  return reasons;
}

function hasUsableWebsiteAudit(audit = {}, signals = {}) {
  if (audit.status && audit.status !== 'audited') return false;
  return Number(signals.htmlLength || 0) > 100 || Number(signals.visibleLength || 0) > 80;
}

function hasUsableVerifiedWebsiteAudit(audit = {}, signals = {}) {
  if (!hasUsableWebsiteAudit(audit, signals)) return false;
  const verified = audit.verifiedSignals || {};
  if (!verified.websiteTruth || !verified.websiteQuality) return false;
  if (!hasEvidence(verified.websiteTruth)) return false;
  return true;
}

function verifiedEvidenceIntegrityOk(audit = {}) {
  const verified = audit.verifiedSignals || {};
  if (!verified.evidenceIntegrity?.verifiable) return false;
  const negatives = verified.websiteQuality?.negativeSignals || [];
  return negatives
    .filter(signal => Number(signal.weight || 0) >= 0.6)
    .every(signal => signal.url && signal.source && Number(signal.confidence || 0) >= 0.7);
}

function verifiedBusinessTruthOk(lead, verified = {}) {
  const truth = verified.businessTruth;
  if (!truth) return false;
  if (truth.homeService?.value !== isHomeService(lead)) return false;
  if (truth.localMarket?.value !== isLocalMarket(lead)) return false;
  if (truth.chainRisk?.value !== isChainBusiness(lead.businessName)) return false;
  if (Number(truth.homeService?.confidence || 0) < 0.7) return false;
  if (Number(truth.chainRisk?.confidence || 0) < 0.7) return false;
  return true;
}

function hasEvidence(node = {}) {
  return Array.isArray(node.evidence) && node.evidence.some(item => item && item.source && Number(item.confidence || 0) >= 0.7);
}

function hasStrongSiteSignals(signals = {}) {
  const positives = [
    signals.visibleLength >= 3000,
    signals.hasViewport,
    signals.hasResponsiveCss,
    signals.hasForm,
    signals.hasTel || signals.hasQuoteCta,
    signals.hasReviews,
    signals.hasTrust,
    signals.hasSchema,
    signals.hasCustomFonts,
    signals.hasModernFramework,
  ].filter(Boolean).length;

  const negatives = [
    signals.tableLayout,
    signals.oldTech,
    signals.staleCopyrightYear,
    signals.notHttps,
  ].filter(Boolean).length;

  return positives >= 7 && negatives === 0;
}

function positiveSiteSignalCount(signals = {}) {
  return [
    signals.visibleLength >= 3000,
    signals.hasViewport,
    signals.hasResponsiveCss,
    signals.hasForm,
    signals.hasTel,
    signals.hasQuoteCta,
    signals.hasReviews,
    signals.hasTrust,
    signals.hasSchema,
    signals.hasCustomFonts,
    signals.hasModernFramework,
  ].filter(Boolean).length;
}

function hardNegativeSignalCount(signals = {}) {
  return [
    signals.tableLayout,
    signals.oldTech,
    signals.staleCopyrightYear,
    signals.notHttps,
    signals.visibleLength > 0 && signals.visibleLength < 1200,
    !signals.hasViewport,
    !signals.hasResponsiveCss,
  ].filter(Boolean).length;
}

function buildPitchRecommendation(lead, audit, reasons, decisionMaker) {
  const biz = lead.businessName || 'the business';
  const niche = lead.niche || 'home service';
  const hasWebsite = Boolean(lead.website);
  const contact = decisionMaker.name || 'the owner';
  const local = isLocalMarket(lead);
  const topReason = reasons.find(reason => !/Decision-maker|Phone number|High-ticket|area fit/.test(reason)) || reasons[0] || 'the current web presence has clear conversion gaps';

  if (!hasWebsite) {
    return {
      opener: `${contact}, I noticed ${biz} does not appear to have a real website for customers comparing ${niche} options online.`,
      angle: 'Lead with website creation: credibility, local search presence, mobile tap-to-call, and a simple quote/request flow.',
      why: 'A no-website business is likely losing trust before a customer ever calls, especially for urgent home service jobs.',
      nextAction: local ? 'Prioritize walk-in pitch with a one-page website preview concept.' : 'Call first, then offer to send a simple homepage concept.',
      caution: 'Frame it as helping them look more established online, not as criticism.',
    };
  }

  return {
    opener: `${contact}, I reviewed ${biz}'s site and the biggest opportunity I saw was: ${topReason}.`,
    angle: 'Lead with a custom website rebuild that makes the business look more credible and turns mobile visitors into calls or quote requests.',
    why: 'The site has visible trust or conversion gaps that can cost home service jobs when customers compare multiple contractors.',
    nextAction: local ? 'Use a walk-in pitch and show the specific site issue on a phone.' : 'Call with the specific issue first, then offer a redesign preview.',
    caution: 'Do not insult the current site. Position the rebuild as a way to win more of the traffic they already get.',
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  isChainBusiness,
  isHomeService,
  isLocalMarket,
  pickDecisionMaker,
  extractHtmlSignals,
  scoreLead,
  sourceIssueReasons,
  siteIssueReasons,
  siteIssueFindings,
  hasUsableWebsiteAudit,
  hasUsableVerifiedWebsiteAudit,
  verifiedEvidenceIntegrityOk,
  verifiedBusinessTruthOk,
  hasStrongSiteSignals,
  positiveSiteSignalCount,
  hardNegativeSignalCount,
  computeSignalCount,
  normalizeDmConfidence,
};
