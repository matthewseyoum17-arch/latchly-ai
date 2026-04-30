/**
 * scripts/latchly-leads/anthropic-client.js
 *
 * Single source of truth for "give me an anthropic-shaped client." Routes
 * to either:
 *   - the official SDK (`@anthropic-ai/sdk`) when LATCHLY_USE_API_KEY=1
 *   - the Max-plan `claude -p` shim otherwise (default)
 *
 * Use this everywhere instead of `new Anthropic({ apiKey })` so flipping
 * one env var swaps the entire pipeline between API-tier and Max-plan
 * auth. Both clients expose `client.messages.create(...)` with the same
 * input/output shape, so callers don't change.
 */

let _cached = null;

async function getAnthropicClient() {
  if (_cached) return _cached;

  if (process.env.LATCHLY_USE_API_KEY === '1') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('LATCHLY_USE_API_KEY=1 but ANTHROPIC_API_KEY is not set');
    }
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    _cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return _cached;
  }

  const { createMaxPlanClient } = require('./anthropic-via-cli');
  _cached = createMaxPlanClient();
  return _cached;
}

module.exports = { getAnthropicClient };
