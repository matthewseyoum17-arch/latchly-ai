#!/usr/bin/env node
/**
 * scripts/dev/sync-cold-email-skill.js
 *
 * Verifies the cold-email Claude Code skill at
 * ~/.claude/skills/cold-email-latchly/SKILL.md is in sync with the runtime
 * SYSTEM_PROMPT in scripts/latchly-leads/cold-email-engine.js.
 *
 * The two files are not byte-identical (skill is markdown, engine is a
 * single concatenated string), but they MUST share the same banned-phrase
 * and banned-framing rules. This script asserts that.
 *
 * Run from CI:
 *   node scripts/dev/sync-cold-email-skill.js
 *
 * Exits non-zero on drift so CI fails when only one side is updated.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { COLD_EMAIL_RULES } = require('../latchly-leads/cold-email-engine');

const SKILL_PATH = path.join(os.homedir(), '.claude/skills/cold-email-latchly/SKILL.md');

function main() {
  if (!fs.existsSync(SKILL_PATH)) {
    console.error(`✗ skill not found: ${SKILL_PATH}`);
    console.error('  ensure cold-email-latchly skill is installed before running this check.');
    process.exit(1);
  }

  const skillBody = fs.readFileSync(SKILL_PATH, 'utf8').toLowerCase();

  const missingPhrases = COLD_EMAIL_RULES.bannedPhrases.filter(
    p => !skillBody.includes(p.toLowerCase()),
  );
  const missingFramings = COLD_EMAIL_RULES.bannedFramings.filter(
    f => !skillBody.includes(f.toLowerCase().split(' ').slice(0, 3).join(' ')),
  );

  // Phase C: also verify the per-lead variation pools appear in the skill
  // so interactive Claude follows the same archetype set as the runtime.
  const missingVoices = (COLD_EMAIL_RULES.voicePool || []).filter(
    v => !skillBody.includes(String(v.name || v.key).toLowerCase()),
  );
  const missingOpeners = (COLD_EMAIL_RULES.openerPool || []).filter(
    o => !skillBody.includes(String(o.key).replace(/-/g, '[- ]').toLowerCase()) && !skillBody.includes(String(o.key).toLowerCase()),
  );
  const missingSignoffs = (COLD_EMAIL_RULES.signoffPool || []).filter(
    s => !skillBody.includes(String(s.format || '').toLowerCase()),
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
      `engine voice archetypes missing from skill:\n  - ${missingVoices.map(v => v.name || v.key).join('\n  - ')}`,
    );
  }
  if (missingOpeners.length) {
    issues.push(
      `engine opener archetypes missing from skill:\n  - ${missingOpeners.map(o => o.key).join('\n  - ')}`,
    );
  }
  if (missingSignoffs.length) {
    issues.push(
      `engine sign-off forms missing from skill:\n  - ${missingSignoffs.map(s => s.format).join('\n  - ')}`,
    );
  }

  if (issues.length) {
    console.error('✗ cold-email skill ↔ engine drift:\n');
    for (const issue of issues) console.error(issue + '\n');
    console.error('Update SKILL.md to reference the same items as cold-email-engine.js.');
    process.exit(1);
  }

  console.log('✓ cold-email skill in sync with engine');
  console.log(`  banned phrases checked: ${COLD_EMAIL_RULES.bannedPhrases.length}`);
  console.log(`  banned framings checked: ${COLD_EMAIL_RULES.bannedFramings.length}`);
  console.log(`  voice archetypes checked: ${(COLD_EMAIL_RULES.voicePool || []).length}`);
  console.log(`  opener archetypes checked: ${(COLD_EMAIL_RULES.openerPool || []).length}`);
  console.log(`  sign-off forms checked: ${(COLD_EMAIL_RULES.signoffPool || []).length}`);
  process.exit(0);
}

if (require.main === module) main();
