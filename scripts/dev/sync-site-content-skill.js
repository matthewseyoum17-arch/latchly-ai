#!/usr/bin/env node
/**
 * scripts/dev/sync-site-content-skill.js
 *
 * Verifies the site-content-latchly Claude Code skill at
 * ~/.claude/skills/site-content-latchly/SKILL.md is in sync with the runtime
 * SITE_COPY_RULES in scripts/latchly-leads/site-content-engine.js.
 *
 * Same pattern as sync-cold-email-skill.js: skill markdown and engine JS
 * aren't byte-identical (markdown vs concatenated string), but they MUST
 * share banned-phrase, banned-framing, voice, headline-structure, and
 * about-opener pools. Drift fails CI.
 *
 * Run from CI:
 *   node scripts/dev/sync-site-content-skill.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { SITE_COPY_RULES } = require('../latchly-leads/site-content-engine');

const SKILL_PATH = path.join(os.homedir(), '.claude/skills/site-content-latchly/SKILL.md');

function main() {
  if (!fs.existsSync(SKILL_PATH)) {
    console.error(`✗ skill not found: ${SKILL_PATH}`);
    console.error('  ensure site-content-latchly skill is installed before running this check.');
    process.exit(1);
  }

  const skillBody = fs.readFileSync(SKILL_PATH, 'utf8').toLowerCase();

  const missingPhrases = SITE_COPY_RULES.bannedPhrases.filter(
    p => !skillBody.includes(p.toLowerCase()),
  );
  const missingFramings = SITE_COPY_RULES.bannedFramings.filter(
    f => !skillBody.includes(f.toLowerCase().split(' ').slice(0, 3).join(' ')),
  );
  const missingVoices = (SITE_COPY_RULES.voicePool || []).filter(
    v => !skillBody.includes(String(v.key).toLowerCase()),
  );
  const missingHeadlines = (SITE_COPY_RULES.headlinePool || []).filter(
    h => !skillBody.includes(String(h.key).toLowerCase().replace(/-/g, ' ')) && !skillBody.includes(String(h.key).toLowerCase()),
  );
  const missingOpeners = (SITE_COPY_RULES.aboutOpenerPool || []).filter(
    o => !skillBody.includes(String(o.key).toLowerCase().replace(/-/g, ' ')) && !skillBody.includes(String(o.key).toLowerCase()),
  );

  const issues = [];
  if (missingPhrases.length) {
    issues.push(
      `engine bans these phrases that the skill does NOT mention:\n  - ${missingPhrases.join('\n  - ')}`,
    );
  }
  if (missingFramings.length) {
    issues.push(
      `engine bans these framings that the skill does NOT mention:\n  - ${missingFramings.join('\n  - ')}`,
    );
  }
  if (missingVoices.length) {
    issues.push(
      `engine voice archetypes missing from skill:\n  - ${missingVoices.map(v => v.key).join('\n  - ')}`,
    );
  }
  if (missingHeadlines.length) {
    issues.push(
      `engine headline structures missing from skill:\n  - ${missingHeadlines.map(h => h.key).join('\n  - ')}`,
    );
  }
  if (missingOpeners.length) {
    issues.push(
      `engine about-paragraph openers missing from skill:\n  - ${missingOpeners.map(o => o.key).join('\n  - ')}`,
    );
  }

  if (issues.length) {
    console.error('✗ site-content skill ↔ engine drift:\n');
    for (const issue of issues) console.error(issue + '\n');
    console.error('Update SKILL.md to reference the same items as site-content-engine.js.');
    process.exit(1);
  }

  console.log('✓ site-content skill in sync with engine');
  console.log(`  banned phrases checked: ${SITE_COPY_RULES.bannedPhrases.length}`);
  console.log(`  banned framings checked: ${SITE_COPY_RULES.bannedFramings.length}`);
  console.log(`  voice archetypes checked: ${(SITE_COPY_RULES.voicePool || []).length}`);
  console.log(`  headline structures checked: ${(SITE_COPY_RULES.headlinePool || []).length}`);
  console.log(`  about-paragraph openers checked: ${(SITE_COPY_RULES.aboutOpenerPool || []).length}`);
  process.exit(0);
}

if (require.main === module) main();
