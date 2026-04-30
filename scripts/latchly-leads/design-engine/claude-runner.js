/**
 * scripts/latchly-leads/design-engine/claude-runner.js
 *
 * Spawn `claude -p` (the Claude Code CLI) as a child process, inheriting the
 * operator's Max-plan subscription so demo generation is free per call.
 *
 * Two invocation patterns:
 *
 *   1. runClaude({ prompt, expectFile }) — write a task brief inline in the
 *      prompt; the model writes its output to `expectFile`. We wait for the
 *      subprocess to exit and then read the file. Used for HTML candidates
 *      and polished versions where we need clean bytes back.
 *
 *   2. runClaudeJson({ prompt }) — model is asked to emit a JSON object
 *      between explicit fences. We parse from stdout. Used for the scan +
 *      content-fit scoring passes.
 *
 * `claude` must be on PATH. If absent, runClaude returns { ok: false,
 * reason: 'claude_cli_unavailable' } and the caller falls back to the
 * legacy template path. We never crash the pipeline because of CLI
 * absence — production environments without the CLI keep working off
 * the template.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes per pass
// Skill is required so the subprocess can invoke huashu-design /
// ui-ux-pro-max via the prompts in build-bespoke.js. Read/Write/Bash/
// WebFetch cover the rest of the design pass needs (read brief, write
// HTML, optional Bash for image processing, fetch real photos).
const DEFAULT_ALLOWED_TOOLS = 'Read,Write,Bash,WebFetch,Skill';
// Default to Haiku — cheaper per token and stays under the org rate limit.
// The bespoke flow can pass a stronger model via opts.model when needed.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// Anthropic enforces token rate limits (typically 30k input tokens/min on
// developer plans). When `claude -p` hits a 429, we back off and retry
// rather than fail the whole pipeline.
const RATE_LIMIT_BACKOFF_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 3;

let _cliCheck = null;

async function isClaudeCliAvailable() {
  if (_cliCheck != null) return _cliCheck;
  _cliCheck = await new Promise(resolve => {
    let proc;
    try {
      proc = spawn('claude', ['--version'], { timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      return resolve(false);
    }
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; try { proc.kill(); } catch {} resolve(false); }, 5000);
    proc.on('error', () => { clearTimeout(t); resolve(false); });
    proc.on('close', code => {
      clearTimeout(t);
      if (timedOut) return;
      resolve(code === 0);
    });
  });
  return _cliCheck;
}

/**
 * Spawn `claude -p` with the given prompt. Wait for exit, then read
 * expectFile (if provided) and return its bytes. Stdout is captured for
 * logging only.
 *
 * @param {Object} args
 * @param {string} args.prompt           — full prompt string passed to `claude -p`
 * @param {string} [args.expectFile]     — absolute path the model should write its output to
 * @param {string} [args.allowedTools]   — comma-separated CC tool list (default Read,Write,Bash,WebFetch)
 * @param {string} [args.model]          — model id (default claude-sonnet-4-6)
 * @param {number} [args.timeoutMs]      — kill after this; default 240_000
 * @param {string} [args.cwd]            — working dir for the subprocess
 * @param {Object} [args.env]            — additional env vars
 * @returns {Promise<{ ok: boolean, reason?: string, output?: string, stdout: string, stderr: string, exitCode: number | null }>}
 */
async function runClaude({ prompt, expectFile, allowedTools, model, timeoutMs, cwd, env } = {}) {
  if (!prompt) return { ok: false, reason: 'no_prompt', stdout: '', stderr: '', exitCode: null };
  if (!(await isClaudeCliAvailable())) {
    return { ok: false, reason: 'claude_cli_unavailable', stdout: '', stderr: '', exitCode: null };
  }

  let lastResult = null;
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const result = await runClaudeOnce({ prompt, expectFile, allowedTools, model, timeoutMs, cwd, env });
    if (result.ok) return result;
    lastResult = result;
    // Detect Anthropic rate-limit by parsing the captured stderr/stdout.
    const isRateLimit = /rate limit|\b429\b|input tokens per minute/i.test(`${result.stderr || ''}\n${result.stdout || ''}`);
    if (!isRateLimit) return result;
    if (attempt < MAX_RATE_LIMIT_RETRIES) {
      // eslint-disable-next-line no-console
      console.warn(`[claude-runner] rate-limited; backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
      await sleep(RATE_LIMIT_BACKOFF_MS);
      continue;
    }
  }
  return lastResult || { ok: false, reason: 'unknown', stdout: '', stderr: '', exitCode: null };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runClaudeOnce({ prompt, expectFile, allowedTools, model, timeoutMs, cwd, env } = {}) {
  const args = [
    '-p', prompt,
    '--allowed-tools', allowedTools || DEFAULT_ALLOWED_TOOLS,
    '--model', model || DEFAULT_MODEL,
    '--output-format', 'text',
  ];

  return new Promise(resolve => {
    let proc;
    try {
      proc = spawn('claude', args, {
        timeout: timeoutMs || DEFAULT_TIMEOUT_MS,
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...(env || {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({ ok: false, reason: `spawn_failed:${err.message}`, stdout: '', stderr: '', exitCode: null });
    }

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => {
      resolve({ ok: false, reason: `proc_error:${err.message}`, stdout, stderr, exitCode: null });
    });
    proc.on('close', code => {
      const exitCode = code ?? null;
      if (code !== 0) {
        return resolve({ ok: false, reason: `exit_${code}`, stdout, stderr, exitCode });
      }
      if (expectFile) {
        try {
          const output = fs.readFileSync(expectFile, 'utf8');
          if (!output.trim()) {
            return resolve({ ok: false, reason: 'output_file_empty', stdout, stderr, exitCode });
          }
          return resolve({ ok: true, output, stdout, stderr, exitCode });
        } catch (err) {
          return resolve({ ok: false, reason: `output_file_unreadable:${err.code || err.message}`, stdout, stderr, exitCode });
        }
      }
      resolve({ ok: true, output: stdout, stdout, stderr, exitCode });
    });
  });
}

/**
 * Same as runClaude but for JSON-only outputs. The model is expected to
 * write the JSON between literal fence markers `<<<JSON_START>>>` and
 * `<<<JSON_END>>>` so we can parse robustly even if the model adds
 * commentary around the payload.
 */
async function runClaudeJson(args) {
  const r = await runClaude(args);
  if (!r.ok) return r;
  const text = r.output || r.stdout || '';
  const fenced = text.match(/<<<JSON_START>>>([\s\S]*?)<<<JSON_END>>>/);
  let candidate = fenced ? fenced[1] : text;
  candidate = candidate.trim();
  if (!candidate) return { ...r, ok: false, reason: 'empty_json_output' };
  // Last-ditch: peel a code fence if present.
  candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(candidate);
    return { ...r, json: parsed };
  } catch (err) {
    return { ...r, ok: false, reason: `json_parse_failed:${err.message}` };
  }
}

/**
 * Make a fresh tmp dir for a single lead's design pass artifacts.
 * Returns { dir, cleanup }. Caller is responsible for invoking cleanup()
 * (or leaving it for inspection in dev).
 */
function makeTempDir(slug) {
  const stamp = Date.now().toString(36);
  const safeSlug = String(slug || 'lead').replace(/[^a-z0-9-]/gi, '-').slice(0, 60);
  const dir = path.join(os.tmpdir(), `latchly-design-${safeSlug}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    cleanup() { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}

module.exports = {
  runClaude,
  runClaudeJson,
  isClaudeCliAvailable,
  makeTempDir,
};
