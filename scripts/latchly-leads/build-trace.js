/**
 * scripts/latchly-leads/build-trace.js
 *
 * Per-lead build trace writer. Each lead's demo build emits one line of
 * JSON to `_temp/build-traces.jsonl` so we can inspect what each pass
 * produced (which directions were chosen, which candidates passed,
 * impeccable/AEO/fit scores, wall time, fallback reason on failure).
 *
 * Optional persistence: if the caller's storage adapter exposes
 * `attachBuildTrace(businessKey, trace)` the trace also lands on the
 * lead row in the CRM.
 *
 * Trace shape (free-form, but these fields are the contract callers rely
 * on for grepping):
 *   {
 *     slug, ts, businessKey, businessName,
 *     path: 'bespoke' | 'failed',
 *     fallbackReason: string | null,
 *     candidatesScored: [{ direction, ok, total, impeccable, aeo, fit, hardFail }],
 *     scanProfile: object | null,
 *     wallTimeMs: number | null,
 *     lintScore: number | null,
 *   }
 */

const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./utils');

const TRACE_DIR = path.join(process.cwd(), '_temp');
const TRACE_PATH = path.join(TRACE_DIR, 'build-traces.jsonl');

async function appendTrace(slug, trace = {}, opts = {}) {
  const line = JSON.stringify({
    slug,
    ts: new Date().toISOString(),
    ...trace,
  });

  try {
    ensureDir(TRACE_DIR);
    fs.appendFileSync(TRACE_PATH, line + '\n', 'utf8');
  } catch (err) {
    // File-write failure is non-fatal — the pipeline keeps going.
    // eslint-disable-next-line no-console
    console.warn(`[build-trace] write failed: ${err.message}`);
  }

  if (opts.storage?.attachBuildTrace && trace.businessKey) {
    try {
      await opts.storage.attachBuildTrace(trace.businessKey, trace);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[build-trace] storage.attachBuildTrace failed: ${err.message}`);
    }
  }
}

module.exports = { appendTrace, TRACE_PATH };
