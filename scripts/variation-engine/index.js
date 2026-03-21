/**
 * Variation Engine — Main Orchestrator
 *
 * Selects a design family for each lead based on deterministic hashing,
 * then generates a complete standalone HTML demo using that family's generator.
 *
 * Usage:
 *   const engine = require('./variation-engine');
 *   const html = engine.generate(lead);
 *   const html = engine.generate(lead, { family: 'emergency' }); // force family
 */

const { hashStr, detectNiche } = require('./shared/utils');

// Load all families
const familyModules = {
  luxury:    require('./families/luxury'),
  trust:     require('./families/trust'),
  emergency: require('./families/emergency'),
  modern:    require('./families/modern'),
  regional:  require('./families/regional'),
  craft:     require('./families/craft'),
};

const familyList = Object.values(familyModules);
const familyNames = Object.keys(familyModules);

/**
 * Select a family deterministically based on lead data.
 * Same lead always gets the same family.
 */
function selectFamily(lead) {
  const seed = hashStr(lead.business_name + (lead.city || '') + (lead.state || ''));
  return familyList[seed % familyList.length];
}

/**
 * Generate a demo HTML page for a lead.
 * @param {object} lead - Lead data (business_name, phone, city, state, niche, etc.)
 * @param {object} [opts] - Options
 * @param {string} [opts.family] - Force a specific family name
 * @returns {{ html: string, family: string }}
 */
function generate(lead, opts = {}) {
  const niche = detectNiche(lead.niche);
  let family;

  if (opts.family && familyModules[opts.family]) {
    family = familyModules[opts.family];
  } else {
    family = selectFamily(lead);
  }

  const html = family.generate(lead, niche);
  return { html, family: family.name };
}

/**
 * Generate demos for ALL families for a single lead (for preview).
 * @param {object} lead
 * @returns {Array<{ html: string, family: string, label: string }>}
 */
function generateAll(lead) {
  const niche = detectNiche(lead.niche);
  return familyList.map(f => ({
    html: f.generate(lead, niche),
    family: f.name,
    label: f.label,
  }));
}

/**
 * Get metadata about all available families.
 */
function listFamilies() {
  return familyList.map(f => ({ name: f.name, label: f.label }));
}

module.exports = { generate, generateAll, selectFamily, listFamilies, familyNames };
