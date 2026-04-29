#!/usr/bin/env node
/**
 * scripts/dev/showcase-one-lead.js
 *
 * Picks one existing CRM lead with a website + email and runs the new
 * demo+outreach v1 stage against it (enrichment → content → demo → email
 * compose). Outputs the artifacts so we can compare:
 *   - original site URL
 *   - composed cold email subject + body
 *   - demo HTML (path on disk + length)
 *
 * Does NOT send the email. Does NOT queue. Just dry-run + persist demo
 * HTML to disk.
 *
 * Usage:
 *   node scripts/dev/showcase-one-lead.js [businessKey]
 *
 * If no businessKey passed, picks the highest-scoring lead with a
 * non-empty website and email.
 */

require('../latchly-leads/utils').loadEnv?.();

const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { enrichLead } = require('../latchly-leads/enrichment');
const { generateSiteContent } = require('../latchly-leads/site-content-engine');
const { buildDemoForLead } = require('../latchly-leads/design-engine');
const { composeColdEmailForLead } = require('../latchly-leads/cold-email-engine');

async function main() {
  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const targetKey = process.argv[2];
  let row;
  if (targetKey) {
    const rows = await sql`
      SELECT * FROM latchly_leads WHERE business_key = ${targetKey} LIMIT 1
    `;
    row = rows[0];
  } else {
    const rows = await sql`
      SELECT * FROM latchly_leads
      WHERE website IS NOT NULL AND website <> ''
        AND email IS NOT NULL AND email <> ''
        AND archived_at IS NULL
      ORDER BY score DESC, signal_count DESC
      LIMIT 1
    `;
    row = rows[0];
  }

  if (!row) {
    console.error('No lead found.');
    process.exit(1);
  }

  const lead = {
    businessKey: row.business_key,
    businessName: row.business_name,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    website: row.website,
    niche: row.niche,
    score: row.score,
    decisionMakerName: row.decision_maker_name,
    decisionMakerTitle: row.decision_maker_title,
    rawPayload: row.source_payload?.rawPayload || {},
  };

  console.log('═══ ORIGINAL LEAD ═══');
  console.log(JSON.stringify({
    businessKey: lead.businessKey,
    businessName: lead.businessName,
    city: lead.city, state: lead.state,
    phone: lead.phone, email: lead.email,
    website: lead.website, niche: lead.niche,
    score: lead.score,
    decisionMaker: lead.decisionMakerName,
  }, null, 2));

  console.log('\n═══ STAGE 1: ENRICHMENT ═══');
  const enrichment = await enrichLead(lead, {
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
  });
  console.log(JSON.stringify({
    placeId: enrichment.placeId,
    ownerName: enrichment.ownerName,
    averageRating: enrichment.averageRating,
    reviewCount: enrichment.reviewCount,
    reviews: (enrichment.reviews || []).map(r => ({
      author: r.author, rating: r.rating, text: (r.text || '').slice(0, 120),
    })),
    yearsInBusiness: enrichment.yearsInBusiness,
    servicesVerified: enrichment.servicesVerified,
    bbbAccreditation: enrichment.bbbAccreditation,
    licenses: enrichment.licenses,
    formattedAddress: enrichment.formattedAddress,
    coordinates: enrichment.coordinates,
    existingCopy: enrichment.existingCopy ? {
      hero: enrichment.existingCopy.hero,
      about: (enrichment.existingCopy.about || '').slice(0, 200),
      servicesCount: (enrichment.existingCopy.services || []).length,
      testimonialsCount: (enrichment.existingCopy.testimonials || []).length,
    } : null,
    enrichmentErrors: enrichment.enrichmentErrors,
  }, null, 2));

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('\n═══ STAGE 2: SITE CONTENT ═══');
  const content = await generateSiteContent(lead, enrichment, {
    anthropic,
    mode: lead.website ? 'souped-up' : 'fresh-build',
  });
  console.log(JSON.stringify(content, null, 2));

  console.log('\n═══ STAGE 3: DEMO BUILD ═══');
  const slug = makeSlug(lead);
  const demo = await buildDemoForLead(lead, {
    enrichment, content: content || {},
    slug,
    siteBase: process.env.SITE_BASE || 'https://latchlyai.com',
  });
  console.log(JSON.stringify({
    ok: demo.ok, direction: demo.direction,
    qualityScore: demo.qualityScore || demo.lint?.score,
    htmlLength: demo.html?.length || 0,
    issues: demo.lint?.issues || [],
  }, null, 2));

  // Save demo to disk for inspection
  const demosDir = path.join(process.cwd(), 'demos', 'prospects');
  if (!fs.existsSync(demosDir)) fs.mkdirSync(demosDir, { recursive: true });
  const demoPath = path.join(demosDir, `${slug}.html`);
  if (demo.html) {
    fs.writeFileSync(demoPath, demo.html, 'utf8');
    console.log('demo written to:', demoPath);

    // Persist to demo_pages so /demo/<slug> on production serves this HTML.
    // Uses the same INSERT...ON CONFLICT path the daily pipeline uses.
    try {
      await sql`
        INSERT INTO demo_pages (slug, html, source, created_at, updated_at)
        VALUES (${slug}, ${demo.html}, 'showcase-one-lead', NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE SET
          html = EXCLUDED.html,
          source = EXCLUDED.source,
          updated_at = NOW()
      `;
      console.log('demo persisted to demo_pages table; URL is now live');
    } catch (err) {
      console.error('demo_pages INSERT failed:', err.message);
    }
  }

  console.log('\n═══ STAGE 4: COLD EMAIL ═══');
  const demoUrl = `${process.env.SITE_BASE || 'https://latchlyai.com'}/demo/${slug}`;
  const email = await composeColdEmailForLead(lead, enrichment, demoUrl, {
    anthropic,
    fromEmail: process.env.OUTREACH_FROM || 'matt@latchlyai.com',
    siteBase: process.env.SITE_BASE,
  });
  console.log('SUBJECT:', email.subject);
  console.log('---');
  console.log(email.body);
  console.log('---');
  console.log('\nplainText (full version with sign-off + unsub):');
  console.log(email.plainText);

  console.log('\n═══ SUMMARY ═══');
  console.log('Original site:', lead.website || '(none)');
  console.log('Demo file:    ', demoPath);
  console.log('Demo URL:     ', demoUrl);
  console.log('Email subject:', email.subject);
}

function makeSlug(lead) {
  const raw = `${lead.businessName || 'business'}-${lead.city || ''}-${lead.state || ''}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
