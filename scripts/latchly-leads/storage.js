const fs = require('fs');
const path = require('path');
const { LEADS_DIR } = require('./config');
const { businessKey, ensureDir } = require('./utils');

function createStorage() {
  if (process.env.DATABASE_URL && process.env.LATCHLY_LEADS_SKIP_DB !== '1') {
    return createDbStorage();
  }
  return createFileStorage();
}

function createFileStorage() {
  const file = path.join(LEADS_DIR, 'delivered.json');
  ensureDir(LEADS_DIR);

  function read() {
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return [];
    }
  }

  return {
    async init() {},
    async deliveredKeys() {
      return new Set(read().map(row => row.businessKey));
    },
    async upsertLeads(leads, meta = {}) {
      const file = path.join(LEADS_DIR, 'crm-leads.json');
      const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      const byKey = new Map(existing.map(row => [row.businessKey, row]));
      const now = new Date().toISOString();
      for (const lead of leads) {
        const row = toCrmRecord(lead, meta);
        byKey.set(row.businessKey, {
          ...byKey.get(row.businessKey),
          ...row,
          lastSeenAt: now,
          deliveredAt: byKey.get(row.businessKey)?.deliveredAt || now,
        });
      }
      fs.writeFileSync(file, JSON.stringify([...byKey.values()], null, 2));
    },
    async markDelivered(leads, meta = {}) {
      const existing = read();
      const now = new Date().toISOString();
      const additions = leads.map(lead => ({
        businessKey: businessKey(lead),
        businessName: lead.businessName,
        city: lead.city,
        state: lead.state,
        phone: lead.phone,
        website: lead.website,
        score: lead.score,
        deliveredAt: now,
        meta,
      }));
      fs.writeFileSync(file, JSON.stringify([...existing, ...additions], null, 2));
    },
    async recordRun(stats = {}, email = {}) {
      const file = path.join(LEADS_DIR, 'crm-runs.json');
      const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      existing.push({
        date: stats.date,
        target: stats.target,
        minimum: stats.minimum,
        candidates: stats.candidates,
        auditAttempts: stats.auditAttempts || 0,
        audited: stats.audited,
        qualified: stats.qualified,
        delivered: stats.delivered,
        rejected: stats.rejected,
        localDelivered: stats.localDelivered,
        noWebsiteDelivered: stats.noWebsiteDelivered || 0,
        poorWebsiteDelivered: stats.poorWebsiteDelivered || 0,
        siteBucketMin: stats.siteBucketMin || 0,
        siteBucketMax: stats.siteBucketMax || 0,
        noWebsiteShortage: stats.noWebsiteShortage || 0,
        poorWebsiteShortage: stats.poorWebsiteShortage || 0,
        localShortage: stats.localShortage || 0,
        nicheCap: stats.nicheCap || 0,
        nicheCounts: stats.nicheCounts || {},
        sourceCounts: stats.sourceCounts || {},
        scoreDistribution: stats.scoreDistribution || {},
        websiteStatusCounts: stats.websiteStatusCounts || {},
        selectionNotes: stats.selectionNotes || [],
        topRejectionReasons: stats.topRejectionReasons || [],
        underTargetReason: stats.underTargetReason || '',
        email,
        createdAt: new Date().toISOString(),
      });
      fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    },
  };
}

function createDbStorage() {
  let sqlPromise;
  async function sql() {
    if (!sqlPromise) {
      sqlPromise = import('@neondatabase/serverless').then(({ neon }) => neon(process.env.DATABASE_URL));
    }
    return sqlPromise;
  }

  return {
    async init() {
      const db = await sql();
      await db`
        CREATE TABLE IF NOT EXISTS latchly_lead_deliveries (
          id SERIAL PRIMARY KEY,
          business_key TEXT NOT NULL UNIQUE,
          business_name TEXT,
          city TEXT,
          state TEXT,
          phone TEXT,
          website TEXT,
          score NUMERIC(4,1),
          payload JSONB,
          delivered_at TIMESTAMP DEFAULT NOW()
        )`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_lead_deliveries_delivered_at ON latchly_lead_deliveries (delivered_at DESC)`;
      await db`
        CREATE TABLE IF NOT EXISTS latchly_leads (
          id SERIAL PRIMARY KEY,
          business_key TEXT NOT NULL UNIQUE,
          business_name TEXT NOT NULL,
          normalized_name TEXT,
          niche TEXT,
          city TEXT,
          state TEXT,
          phone TEXT,
          email TEXT,
          website TEXT,
          website_status TEXT DEFAULT 'unknown',
          source_name TEXT,
          source_record_id TEXT,
          decision_maker_name TEXT,
          decision_maker_title TEXT,
          decision_maker_confidence NUMERIC(4,1),
          score NUMERIC(4,1) NOT NULL DEFAULT 0,
          score_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
          score_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
          pitch JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_local_market BOOLEAN NOT NULL DEFAULT FALSE,
          source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          audit_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          status TEXT NOT NULL DEFAULT 'new',
          notes TEXT NOT NULL DEFAULT '',
          last_contacted_at TIMESTAMP,
          next_follow_up_date DATE,
          archived_at TIMESTAMP,
          archive_reason TEXT,
          first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
          delivered_at TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT latchly_leads_status_check CHECK (
            status IN ('new', 'reviewed', 'contacted', 'interested', 'follow_up', 'not_fit', 'won', 'lost')
          )
        )`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_status ON latchly_leads (status)`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_score ON latchly_leads (score DESC)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_delivered_at ON latchly_leads (delivered_at DESC)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_local_market ON latchly_leads (is_local_market)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_city ON latchly_leads (city)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_niche ON latchly_leads (niche)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_website_status ON latchly_leads (website_status)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_archived_at ON latchly_leads (archived_at)`;
      await db`
        CREATE TABLE IF NOT EXISTS latchly_lead_runs (
          id SERIAL PRIMARY KEY,
          run_date DATE NOT NULL DEFAULT CURRENT_DATE,
          target_count INT NOT NULL DEFAULT 50,
          minimum_count INT NOT NULL DEFAULT 40,
          candidate_count INT NOT NULL DEFAULT 0,
          audited_count INT NOT NULL DEFAULT 0,
          qualified_count INT NOT NULL DEFAULT 0,
          delivered_count INT NOT NULL DEFAULT 0,
          local_count INT NOT NULL DEFAULT 0,
          rejected_count INT NOT NULL DEFAULT 0,
          rejection_stats JSONB NOT NULL DEFAULT '[]'::jsonb,
          under_target_reason TEXT,
          resend_email_id TEXT,
          email_sent BOOLEAN NOT NULL DEFAULT FALSE,
          dry_run BOOLEAN NOT NULL DEFAULT FALSE,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_lead_runs_run_date ON latchly_lead_runs (run_date DESC)`;
      await db`
        CREATE TABLE IF NOT EXISTS latchly_lead_activities (
          id SERIAL PRIMARY KEY,
          lead_id INT NOT NULL REFERENCES latchly_leads(id) ON DELETE CASCADE,
          activity_type TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          note TEXT,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_by TEXT NOT NULL DEFAULT 'admin',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_lead_activities_lead_id ON latchly_lead_activities (lead_id, created_at DESC)`;
    },
    async deliveredKeys() {
      const db = await sql();
      const rows = await db`
        SELECT business_key FROM latchly_lead_deliveries
        UNION
        SELECT business_key FROM latchly_leads`;
      return new Set(rows.map(row => row.business_key));
    },
    async upsertLeads(leads, meta = {}) {
      const db = await sql();
      for (const lead of leads) {
        const row = toCrmRecord(lead, meta);
        await db`
          INSERT INTO latchly_leads (
            business_key, business_name, normalized_name, niche, city, state,
            phone, email, website, website_status, source_name, source_record_id,
            decision_maker_name, decision_maker_title, decision_maker_confidence,
            score, score_reasons, score_blockers, pitch, is_local_market,
            source_payload, audit_payload
          )
          VALUES (
            ${row.businessKey}, ${row.businessName}, ${row.normalizedName}, ${row.niche},
            ${row.city}, ${row.state}, ${row.phone}, ${row.email}, ${row.website},
            ${row.websiteStatus}, ${row.sourceName}, ${row.sourceRecordId},
            ${row.decisionMakerName}, ${row.decisionMakerTitle}, ${row.decisionMakerConfidence},
            ${row.score}, ${JSON.stringify(row.scoreReasons)}::jsonb, ${JSON.stringify(row.scoreBlockers)}::jsonb,
            ${JSON.stringify(row.pitch)}::jsonb, ${row.isLocalMarket},
            ${JSON.stringify(row.sourcePayload)}::jsonb, ${JSON.stringify(row.auditPayload)}::jsonb
          )
          ON CONFLICT (business_key) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            normalized_name = EXCLUDED.normalized_name,
            niche = EXCLUDED.niche,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            phone = COALESCE(NULLIF(latchly_leads.phone, ''), EXCLUDED.phone),
            email = COALESCE(NULLIF(latchly_leads.email, ''), EXCLUDED.email),
            website = COALESCE(NULLIF(latchly_leads.website, ''), EXCLUDED.website),
            website_status = EXCLUDED.website_status,
            source_name = EXCLUDED.source_name,
            source_record_id = EXCLUDED.source_record_id,
            decision_maker_name = COALESCE(NULLIF(latchly_leads.decision_maker_name, ''), EXCLUDED.decision_maker_name),
            decision_maker_title = COALESCE(NULLIF(latchly_leads.decision_maker_title, ''), EXCLUDED.decision_maker_title),
            decision_maker_confidence = COALESCE(latchly_leads.decision_maker_confidence, EXCLUDED.decision_maker_confidence),
            score = EXCLUDED.score,
            score_reasons = EXCLUDED.score_reasons,
            score_blockers = EXCLUDED.score_blockers,
            pitch = EXCLUDED.pitch,
            is_local_market = EXCLUDED.is_local_market,
            source_payload = EXCLUDED.source_payload,
            audit_payload = EXCLUDED.audit_payload,
            last_seen_at = NOW(),
            updated_at = NOW()`;
      }
    },
    async markDelivered(leads, meta = {}) {
      const db = await sql();
      for (const lead of leads) {
        const key = businessKey(lead);
        await db`
          INSERT INTO latchly_lead_deliveries
            (business_key, business_name, city, state, phone, website, score, payload)
          VALUES
            (${key}, ${lead.businessName}, ${lead.city || null}, ${lead.state || null},
             ${lead.phone || null}, ${lead.website || null}, ${lead.score || null},
             ${JSON.stringify({ lead, meta })}::jsonb)
          ON CONFLICT (business_key) DO NOTHING`;
      }
    },
    async recordRun(stats = {}, email = {}) {
      const db = await sql();
      await db`
        INSERT INTO latchly_lead_runs (
          run_date, target_count, minimum_count, candidate_count, audited_count,
          qualified_count, delivered_count, local_count, rejected_count,
          rejection_stats, under_target_reason, resend_email_id, email_sent,
          dry_run, metadata
        )
        VALUES (
          ${stats.date || null}, ${stats.target || 0}, ${stats.minimum || 0},
          ${stats.candidates || 0}, ${stats.audited || 0}, ${stats.qualified || 0},
          ${stats.delivered || 0}, ${stats.localDelivered || 0}, ${stats.rejected || 0},
          ${JSON.stringify(stats.topRejectionReasons || [])}::jsonb,
          ${stats.underTargetReason || null}, ${email.id || null}, ${Boolean(email.sent)},
          ${Boolean(email.dryRun)}, ${JSON.stringify({
            to: email.to || null,
            auditAttempts: stats.auditAttempts || 0,
            noWebsiteTarget: stats.noWebsiteTarget || 0,
            poorWebsiteTarget: stats.poorWebsiteTarget || 0,
            noWebsiteQualified: stats.noWebsiteQualified || 0,
            poorWebsiteQualified: stats.poorWebsiteQualified || 0,
            noWebsiteDelivered: stats.noWebsiteDelivered || 0,
            poorWebsiteDelivered: stats.poorWebsiteDelivered || 0,
            noWebsiteShortage: stats.noWebsiteShortage || 0,
            poorWebsiteShortage: stats.poorWebsiteShortage || 0,
            localQualified: stats.localQualified || 0,
            localTargetMin: stats.localTargetMin || 0,
            localTargetMax: stats.localTargetMax || 0,
            localShortage: stats.localShortage || 0,
            siteBucketMin: stats.siteBucketMin || 0,
            siteBucketMax: stats.siteBucketMax || 0,
            nicheCap: stats.nicheCap || 0,
            nicheCounts: stats.nicheCounts || {},
            sourceCounts: stats.sourceCounts || {},
            scoreDistribution: stats.scoreDistribution || {},
            websiteStatusCounts: stats.websiteStatusCounts || {},
            selectionNotes: stats.selectionNotes || [],
          })}::jsonb
        )`;
    },
  };
}

function toCrmRecord(lead, meta = {}) {
  const decisionMaker = lead.decisionMaker || {};
  const rawPayload = lead.rawPayload || lead.sourcePayload || {};
  return {
    businessKey: businessKey(lead),
    businessName: lead.businessName || '',
    normalizedName: lead.normalizedName || String(lead.businessName || '').toLowerCase(),
    niche: lead.niche || '',
    city: lead.city || '',
    state: lead.state || '',
    phone: lead.phone || '',
    email: lead.email || rawPayload.Email || rawPayload.email || '',
    website: lead.website || '',
    websiteStatus: lead.websiteStatus || (lead.website ? 'poor_website' : 'no_website'),
    sourceName: lead.sourceName || '',
    sourceRecordId: lead.sourceRecordId || '',
    decisionMakerName: decisionMaker.name || lead.ownerName || lead.contactName || '',
    decisionMakerTitle: decisionMaker.title || lead.ownerTitle || lead.contactTitle || '',
    decisionMakerConfidence: decisionMaker.confidence || null,
    score: lead.score || 0,
    scoreReasons: lead.reasons || [],
    scoreBlockers: lead.blockers || [],
    pitch: lead.pitch || {},
    isLocalMarket: Boolean(lead.isLocalMarket),
    sourcePayload: {
      meta,
      sourceName: lead.sourceName || '',
      sourceRecordId: lead.sourceRecordId || '',
      sourceScore: lead.sourceScore || null,
      sourceIssues: lead.sourceIssues || '',
      sourcePitch: lead.sourcePitch || '',
      leadType: lead.leadType || '',
      rawPayload,
    },
    auditPayload: lead.audit || {},
  };
}

module.exports = { createStorage };
