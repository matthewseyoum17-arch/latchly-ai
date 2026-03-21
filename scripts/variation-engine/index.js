/**
 * Variation Engine — Main Orchestrator
 *
 * Chooses the strongest family for each lead using:
 * - niche-aware business signals
 * - generated-demo quality rubric
 * - deterministic tie-breaking
 */

const { hashStr, detectNiche, extractBusinessSignals } = require('./shared/utils');
const { scoreGeneratedDemo } = require('./rubric');

const familyModules = {
  luxury: require('./families/luxury'),
  trust: require('./families/trust'),
  emergency: require('./families/emergency'),
  modern: require('./families/modern'),
  regional: require('./families/regional'),
  craft: require('./families/craft'),
};

const familyList = Object.values(familyModules);
const familyNames = Object.keys(familyModules);

const nicheBaseAffinity = {
  hvac: { trust: 4, modern: 4, emergency: 3, regional: 3, luxury: 1, craft: 1 },
  plumbing: { trust: 5, emergency: 5, modern: 3, regional: 3, luxury: 1, craft: 1 },
  roofing: { regional: 5, trust: 4, emergency: 4, craft: 3, luxury: 2, modern: 2 },
};

function getSignalBonus(familyName, signals, niche) {
  let bonus = 0;

  if (familyName === 'emergency') {
    if (signals.emergencyHeavy) bonus += 8;
    if (niche === 'plumbing' || niche === 'roofing') bonus += 1;
    if (signals.premiumHeavy) bonus -= 2;
  }

  if (familyName === 'trust') {
    if (signals.trustHeavy) bonus += 8;
    if (signals.emergencyHeavy) bonus += 1;
    if (signals.premiumHeavy) bonus -= 1;
  }

  if (familyName === 'regional') {
    if (signals.authorityHeavy) bonus += 7;
    if (niche === 'roofing') bonus += 1;
    if (signals.trustHeavy) bonus -= 1;
  }

  if (familyName === 'modern') {
    if (signals.modernHeavy) bonus += 7;
    if (niche === 'hvac') bonus += 1;
    if (signals.trustHeavy) bonus -= 1;
  }

  if (familyName === 'luxury') {
    if (signals.premiumHeavy) bonus += 8;
    if (signals.emergencyHeavy) bonus -= 3;
    if (signals.trustHeavy) bonus -= 1;
  }

  if (familyName === 'craft') {
    if (signals.craftHeavy) bonus += 8;
    if (signals.premiumHeavy) bonus += 2;
    if (signals.emergencyHeavy) bonus -= 3;
  }

  return bonus;
}

function rankFamiliesForLead(lead) {
  const niche = detectNiche(lead.niche);
  const signals = extractBusinessSignals(lead);
  const baseAffinity = nicheBaseAffinity[niche] || nicheBaseAffinity.hvac;

  return familyList
    .map(family => {
      const html = family.generate(lead, niche);
      const rubric = scoreGeneratedDemo(html, lead, family.name);
      const baseBonus = baseAffinity[family.name] || 0;
      const signalBonus = getSignalBonus(family.name, signals, niche);
      const deterministicTieBreaker = (hashStr(`${lead.business_name || ''}:${family.name}`) % 7) / 10;
      const hardFailPenalty = rubric.hardFails.length ? -35 : 0;
      const sub90Penalty = rubric.total < 90 ? -8 : 0;
      const finalScore = rubric.total + baseBonus + signalBonus + deterministicTieBreaker + hardFailPenalty + sub90Penalty;

      return {
        family: family.name,
        label: family.label,
        html,
        rubric,
        baseBonus,
        signalBonus,
        hardFailPenalty,
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function selectFamily(lead, opts = {}) {
  if (opts.family && familyModules[opts.family]) {
    return familyModules[opts.family];
  }
  const top = rankFamiliesForLead(lead)[0];
  return familyModules[top.family];
}

function generate(lead, opts = {}) {
  const niche = detectNiche(lead.niche);

  if (opts.family && familyModules[opts.family]) {
    const family = familyModules[opts.family];
    const html = family.generate(lead, niche);
    const rubric = scoreGeneratedDemo(html, lead, family.name);
    return {
      html,
      family: family.name,
      label: family.label,
      score: rubric.total,
      rubric,
    };
  }

  const ranked = rankFamiliesForLead(lead);
  const best = ranked[0];

  return {
    html: best.html,
    family: best.family,
    label: best.label,
    score: best.rubric.total,
    rubric: best.rubric,
    ranking: ranked.map(entry => ({
      family: entry.family,
      label: entry.label,
      score: entry.rubric.total,
      finalScore: Number(entry.finalScore.toFixed(1)),
      hardFails: entry.rubric.hardFails,
      warnings: entry.rubric.warnings,
      baseBonus: entry.baseBonus,
      signalBonus: entry.signalBonus,
    })),
  };
}

function generateAll(lead) {
  const niche = detectNiche(lead.niche);
  return familyList.map(family => {
    const html = family.generate(lead, niche);
    const rubric = scoreGeneratedDemo(html, lead, family.name);
    return {
      html,
      family: family.name,
      label: family.label,
      score: rubric.total,
      rubric,
    };
  });
}

function listFamilies() {
  return familyList.map(f => ({ name: f.name, label: f.label }));
}

module.exports = {
  generate,
  generateAll,
  selectFamily,
  rankFamiliesForLead,
  listFamilies,
  familyNames,
};
