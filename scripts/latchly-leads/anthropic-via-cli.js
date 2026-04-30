/**
 * scripts/latchly-leads/anthropic-via-cli.js
 *
 * Drop-in replacement for the Anthropic SDK client that routes through
 * `claude -p` (the Claude Code CLI) instead of the dev API. The CLI
 * subprocess inherits the operator's Max-plan auth, so calls are
 * flat-rate — no per-token billing.
 *
 * Returns an object shaped like `new Anthropic({})` so any caller that
 * uses `client.messages.create({...})` keeps working unchanged.
 *
 * Caveats:
 *   - `temperature` is silently dropped. The CLI doesn't expose a temp
 *     flag. Variation-seed pools in our engines carry the diversity
 *     budget instead.
 *   - `max_tokens` is also dropped. The CLI uses model defaults.
 *   - Each call spawns a subprocess (~5-15s overhead) so this is much
 *     slower than the SDK. Fine for one-at-a-time enrichment, painful
 *     for high-throughput batch.
 *   - We require the model to wrap its JSON between
 *     <<<JSON_START>>>...<<<JSON_END>>> fences so we can parse robustly.
 *     Callers that pass a `system` instruction telling the model to
 *     "Return JSON only" still work — we append the fence directive on
 *     top.
 */

const { runClaude } = require('./design-engine/claude-runner');

const FENCE_DIRECTIVE = [
  '',
  'IMPORTANT — output format:',
  'Wrap your JSON response between these literal fence markers, exactly:',
  '<<<JSON_START>>>',
  '{your JSON object}',
  '<<<JSON_END>>>',
  'Output nothing else outside the fences. No commentary, no code fences, no markdown.',
].join('\n');

/**
 * Builds a single prompt string from the SDK-shape inputs.
 * `system` becomes a leading section; `messages[].content` is concatenated.
 */
function flattenToPrompt({ system, messages }) {
  const sysBlock = system ? `${system}\n\n` : '';
  const userBlocks = (messages || [])
    .map(m => {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        return m.content.map(b => b.text || '').filter(Boolean).join('\n');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
  return `${sysBlock}${userBlocks}${FENCE_DIRECTIVE}`;
}

/**
 * Strip our fence markers + any code fences out of the raw model text.
 * Returns the inner JSON string ready for JSON.parse.
 */
function extractJsonText(rawText) {
  const text = String(rawText || '');
  const fenced = text.match(/<<<JSON_START>>>([\s\S]*?)<<<JSON_END>>>/);
  let candidate = fenced ? fenced[1] : text;
  candidate = candidate.trim();
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  return candidate.trim();
}

/**
 * Shim a single `messages.create` call to a `claude -p` subprocess.
 * Returns an object shaped like the SDK response: `{ content: [{ text }] }`.
 * The text is the JSON candidate already unwrapped from the fences, so
 * downstream `parseStrictJson(text)` works without changes.
 */
async function messagesCreate(opts = {}) {
  const prompt = flattenToPrompt(opts);

  // Map the SDK model id to the CLI model id. The CLI accepts the same
  // model strings we already use in the SDK calls (haiku-4-5, opus-4-7).
  const model = opts.model || 'claude-haiku-4-5-20251001';

  // Effort: SDK has no equivalent. JSON-shaped composition (cold email,
  // site copy) doesn't need much reasoning — `low` is plenty. Opus
  // callers passing the model explicitly get xhigh by default since
  // they're doing creative work (design generation, scoring).
  const defaultEffort = /opus/i.test(model) ? 'xhigh' : 'low';
  const effort = opts.effort || defaultEffort;

  // 6-minute soft cap per call. The CLI subprocess startup + Haiku
  // response on a long SYSTEM_PROMPT routinely exceeds 2 min on a
  // 4GB chromebook; 6 min tolerates that without making us wait
  // forever on a wedged process.
  const timeoutMs = opts.timeoutMs || 6 * 60 * 1000;

  // Allowed tools: nothing creative needed for JSON-only composition.
  // Read is enough so the model can sanity-check files if it wants.
  const allowedTools = opts.allowedTools || 'Read';

  const result = await runClaude({
    prompt,
    model,
    effort,
    allowedTools,
    timeoutMs,
  });

  if (!result.ok) {
    const err = new Error(`anthropic_via_cli_failed: ${result.reason || 'unknown'}`);
    err.stderr = result.stderr;
    err.stdout = result.stdout;
    err.exitCode = result.exitCode;
    throw err;
  }

  const text = extractJsonText(result.output || result.stdout);
  if (!text) {
    throw new Error('anthropic_via_cli_failed: empty_output');
  }

  // Match the SDK response shape exactly so callers that read
  // `message.content[0].text` keep working.
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    role: 'assistant',
    model,
  };
}

/**
 * Build the SDK-compatible client object. Use this in place of
 * `new Anthropic({ apiKey })` when you want Max-plan auth.
 */
function createMaxPlanClient() {
  return {
    messages: {
      create: messagesCreate,
    },
  };
}

module.exports = { createMaxPlanClient, messagesCreate, flattenToPrompt, extractJsonText };
