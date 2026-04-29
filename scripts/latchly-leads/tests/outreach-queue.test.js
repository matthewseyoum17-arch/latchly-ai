const { test } = require('node:test');
const assert = require('node:assert');
const { nextLocalSendWindow, STATE_TZ } = require('../outreach-queue');

function localHour(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find(p => p.type === type)?.value || 0);
  const h = get('hour'); // formatToParts can return 24 for midnight
  return { hour: h === 24 ? 0 : h, minute: get('minute') };
}

const SAMPLES = [
  { now: '2026-01-15T12:00:00Z', desc: 'PT standard time, midday UTC' },
  { now: '2026-01-15T20:00:00Z', desc: 'PT standard time, evening UTC' },
  { now: '2026-07-15T12:00:00Z', desc: 'PT DST' },
  { now: '2026-03-08T08:00:00Z', desc: 'DST spring-forward day' },
  { now: '2026-11-01T08:00:00Z', desc: 'DST fall-back day' },
  { now: '2026-04-29T03:00:00Z', desc: 'current-ish' },
];
const STATES = ['CA', 'WA', 'AZ', 'CO', 'TX', 'NY', 'FL', 'HI'];

test('nextLocalSendWindow lands in 7-9am local for every state across DST + standard time', () => {
  for (const sample of SAMPLES) {
    const now = new Date(sample.now);
    for (const state of STATES) {
      const tz = STATE_TZ[state];
      const t = nextLocalSendWindow(state, now);
      const { hour, minute } = localHour(t, tz);
      const minOfDay = hour * 60 + minute;
      assert.ok(
        minOfDay >= 7 * 60 && minOfDay < 9 * 60,
        `${sample.desc} / ${state} (${tz}) -> ${t.toISOString()} = ${hour}:${String(minute).padStart(2, '0')} local (expected 7-9am)`,
      );
      assert.ok(
        t.getTime() >= now.getTime() - 1000,
        `${sample.desc} / ${state} -> scheduled in the past (${t.toISOString()} vs now=${sample.now})`,
      );
    }
  }
});

test('nextLocalSendWindow with testNow returns now+~60s', () => {
  const now = new Date('2026-04-29T03:00:00Z');
  const t = nextLocalSendWindow('FL', now, { testNow: true });
  const delta = (t.getTime() - now.getTime()) / 1000;
  assert.ok(delta >= 50 && delta <= 70, `testNow delta should be ~60s, got ${delta}`);
});
