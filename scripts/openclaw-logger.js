/**
 * openclaw-logger.js — Structured logging for all OpenClaw agents
 *
 * Outputs JSON-structured logs with:
 *   - ISO timestamp
 *   - Agent name (scout, audit, demo-builder, outreach, closer, maintenance, pipeline)
 *   - Log level (info, warn, error)
 *   - Lead ID / business name for traceability
 *   - Event name for filtering
 *   - Arbitrary metadata
 *
 * Also writes a rolling log file to leads/openclaw/pipeline.log
 * for post-mortem debugging.
 */

const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'leads', 'openclaw', 'pipeline.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB — rotate after this

function rotateIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_SIZE) {
      const rotated = LOG_FILE + '.1';
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(LOG_FILE, rotated);
    }
  } catch {}
}

function createLogger(agentName) {
  rotateIfNeeded();

  function log(level, event, meta = {}) {
    const entry = {
      ts: new Date().toISOString(),
      agent: agentName,
      level,
      event,
      ...meta,
    };

    // Console output — human-readable for interactive runs, JSON for cron
    const isTTY = process.stdout.isTTY;
    if (isTTY) {
      const prefix = level === 'error' ? '✗' : level === 'warn' ? '!' : '·';
      const leadLabel = meta.lead || meta.business || meta.email || '';
      const detail = leadLabel ? ` [${leadLabel}]` : '';
      console.log(`  ${prefix} ${event}${detail}${meta.detail ? ' — ' + meta.detail : ''}`);
    } else {
      console.log(JSON.stringify(entry));
    }

    // Append to log file
    try {
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    } catch {}
  }

  return {
    info:  (event, meta) => log('info', event, meta),
    warn:  (event, meta) => log('warn', event, meta),
    error: (event, meta) => log('error', event, meta),

    // Convenience: log start/end of a pipeline run with timing
    startRun(meta = {}) {
      this._runStart = Date.now();
      this.info('run_start', meta);
    },
    endRun(meta = {}) {
      const elapsed = this._runStart ? Math.round((Date.now() - this._runStart) / 1000) : 0;
      this.info('run_end', { elapsed_sec: elapsed, ...meta });
    },

    // Log a lead-level event with business context
    lead(event, lead, extra = {}) {
      this.info(event, {
        lead_id: lead.id || null,
        business: lead.business_name,
        email: lead.email || null,
        ...extra,
      });
    },

    // Log an error with context (replaces empty catch blocks)
    catch(event, err, extra = {}) {
      this.error(event, {
        message: err?.message || String(err),
        stack: err?.stack?.split('\n').slice(0, 3).join(' | ') || null,
        ...extra,
      });
    },
  };
}

module.exports = { createLogger };
