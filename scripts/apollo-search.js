#!/usr/bin/env node
// Deprecated login-driven Apollo automation.
// Kept as a small helper so old references do not silently use hardcoded credentials.
// Use scripts/apollo-scrape.js with an already logged-in Chrome Apollo session instead.

console.error('scripts/apollo-search.js is deprecated.');
console.error('Use one of these instead:');
console.error('  npm run leads:apollo            # scrape via live Chrome CDP Apollo session');
console.error('  npm run leads:pipeline          # full scrape -> qualify -> clean batch');
console.error('  npm run leads:pipeline:local    # use an existing leads/apollo-leads.csv');
console.error('');
console.error('This repo no longer stores or uses Apollo credentials inside scripts.');
process.exit(1);
