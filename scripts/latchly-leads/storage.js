const fs = require('fs');
const path = require('path');
const { LEADS_DIR } = require('./config');
const { businessKey, ensureDir } = require('./utils');

function createStorage() {
  const url = databaseUrl();
  if (url && process.env.LATCHLY_LEADS_SKIP_DB !== '1') {
    return createDbStorage(url);
  }
  return createFileStorage();
}

function databaseUrl() {
  return process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL
    || '';
}

function createFileStorage() {
  const deliveredFile = path.join(LEADS_DIR, 'delivered.json');
  const crmFile = path.join(LEADS_DIR, 'crm-leads.json');
  ensureDir(LEADS_DIR);

  function readJsonArray(file) {
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
      return new Set(
        [...readJsonArray(deliveredFile), ...readJsonArray(crmFile)]
          .map(row => row.businessKey)
          .filter(Boolean),
      );
    },
    async upsertLeads(leads, meta = {}) {
      const existing = readJsonArray(crmFile);
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
      fs.writeFileSync(crmFile, JSON.stringify([...byKey.values()], null, 2));
    },
    async markDelivered(leads, meta = {}) {
      const existing = readJsonArray(deliveredFile);
      const byKey = new Map(existing.map(row => [row.businessKey, row]));
      const now = new Date().toISOString();
      for (const lead of leads) {
        const key = businessKey(lead);
        if (!key) continue;
        const prior = byKey.get(key);
        byKey.set(key, {
          ...prior,
          businessKey: key,
          businessName: lead.businessName,
          city: lead.city,
          state: lead.state,
          phone: lead.phone,
          website: lead.website,
          score: lead.score,
          deliveredAt: prior?.deliveredAt || now,
          meta,
        });
      }
      fs.writeFileSync(deliveredFile, JSON.stringify([...byKey.values()], null, 2));
    },
    async attachEnrichment() { /* file storage no-op */ },
    async attachDemo() { /* file storage no-op */ },
    async queueOutreach() { return null; },
    async recordOutreach() { /* file storage no-op */ },
    async dueOutreach() { return []; },
    async countOutreachSentToday() { return 0; },
    async findLeadById() { return null; },
    async recordRun(stats = {}, email = {}) {
      const file = path.join(LEADS_DIR, 'crm-runs.json');
      const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
      const status = normalizeRunStatus(stats.status || email.status || 'completed');
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
        tierMode: stats.tierMode || 'both',
        premiumQualified: stats.premiumQualified || 0,
        premiumDelivered: stats.premiumDelivered || 0,
        standardDelivered: stats.standardDelivered || 0,
        premiumGateIssues: stats.premiumGateIssues || [],
        selectionNotes: stats.selectionNotes || [],
        topRejectionReasons: stats.topRejectionReasons || [],
        topRejectionsBySource: stats.topRejectionsBySource || [],
        candidateOpportunityCounts: stats.candidateOpportunityCounts || {},
        waveStats: stats.waveStats || [],
        diagnosticsPath: stats.diagnosticsPath || '',
        diagnostics: stats.diagnostics || {},
        stopReason: stats.stopReason || '',
        maxAuditAttempts: stats.maxAuditAttempts || 0,
        maxRunMinutes: stats.maxRunMinutes || 0,
        underTargetReason: stats.underTargetReason || '',
        status,
        failureReason: stats.failureReason || email.error || '',
        email,
        createdAt: new Date().toISOString(),
      });
      fs.writeFileSync(file, JSON.stringify(existing, null, 2));
    },
  };
}

function createDbStorage(url) {
  let sqlPromise;
  async function sql() {
    if (!sqlPromise) {
      sqlPromise = import('@neondatabase/serverless').then(({ neon }) => neon(url));
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
          tier TEXT NOT NULL DEFAULT 'standard',
          signal_count INT NOT NULL DEFAULT 0,
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
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard'`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS signal_count INT NOT NULL DEFAULT 0`;
      await db`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'latchly_leads'
              AND constraint_name = 'latchly_leads_tier_check'
          ) THEN
            ALTER TABLE latchly_leads
              ADD CONSTRAINT latchly_leads_tier_check CHECK (tier IN ('premium', 'standard'));
          END IF;
        END $$`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_tier ON latchly_leads (tier)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_tier_score ON latchly_leads (tier, score DESC)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_score ON latchly_leads (score DESC)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_delivered_at ON latchly_leads (delivered_at DESC)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_local_market ON latchly_leads (is_local_market)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_city ON latchly_leads (city)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_niche ON latchly_leads (niche)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_website_status ON latchly_leads (website_status)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_archived_at ON latchly_leads (archived_at)`;

      // Demo + outreach columns (Latchly v1: per-lead demos + cold email)
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS place_id TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS enrichment_data JSONB`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS existing_site_clone JSONB`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_slug TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_url TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_direction TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_quality_score NUMERIC(4,1)`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS demo_built_at TIMESTAMP`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_step INT NOT NULL DEFAULT 0`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT 'none'`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_subject TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_body_preview TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_queued_at TIMESTAMP`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_scheduled_for TIMESTAMP`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS last_resend_email_id TEXT`;
      await db`ALTER TABLE latchly_leads ADD COLUMN IF NOT EXISTS outreach_error TEXT`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_demo_slug ON latchly_leads (demo_slug)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_status ON latchly_leads (outreach_status)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_place_id ON latchly_leads (place_id)`;
      await db`CREATE INDEX IF NOT EXISTS idx_latchly_leads_outreach_due ON latchly_leads (outreach_status, outreach_scheduled_for)`;

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
            source_payload, audit_payload, tier, signal_count
          )
          VALUES (
            ${row.businessKey}, ${row.businessName}, ${row.normalizedName}, ${row.niche},
            ${row.city}, ${row.state}, ${row.phone}, ${row.email}, ${row.website},
            ${row.websiteStatus}, ${row.sourceName}, ${row.sourceRecordId},
            ${row.decisionMakerName}, ${row.decisionMakerTitle}, ${row.decisionMakerConfidence},
            ${row.score}, ${JSON.stringify(row.scoreReasons)}::jsonb, ${JSON.stringify(row.scoreBlockers)}::jsonb,
            ${JSON.stringify(row.pitch)}::jsonb, ${row.isLocalMarket},
            ${JSON.stringify(row.sourcePayload)}::jsonb, ${JSON.stringify(row.auditPayload)}::jsonb,
            ${row.tier}, ${row.signalCount}
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
            decision_maker_name = COALESCE(NULLIF(EXCLUDED.decision_maker_name, ''), latchly_leads.decision_maker_name),
            decision_maker_title = COALESCE(NULLIF(EXCLUDED.decision_maker_title, ''), latchly_leads.decision_maker_title),
            decision_maker_confidence = COALESCE(EXCLUDED.decision_maker_confidence, latchly_leads.decision_maker_confidence),
            score = EXCLUDED.score,
            score_reasons = EXCLUDED.score_reasons,
            score_blockers = EXCLUDED.score_blockers,
            pitch = EXCLUDED.pitch,
            is_local_market = EXCLUDED.is_local_market,
            source_payload = EXCLUDED.source_payload,
            audit_payload = EXCLUDED.audit_payload,
            tier = EXCLUDED.tier,
            signal_count = EXCLUDED.signal_count,
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
      const githubRunId = process.env.GITHUB_RUN_ID ? String(process.env.GITHUB_RUN_ID) : null;
      const status = normalizeRunStatus(stats.status || email.status || 'completed');
      const finishedAtKey = status === 'failed' ? 'failedAt' : 'completedAt';
      const metadataJson = JSON.stringify({
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
        tierMode: stats.tierMode || 'both',
        premiumQualified: stats.premiumQualified || 0,
        premiumDelivered: stats.premiumDelivered || 0,
        standardDelivered: stats.standardDelivered || 0,
        premiumGateIssues: stats.premiumGateIssues || [],
        selectionNotes: stats.selectionNotes || [],
        candidateOpportunityCounts: stats.candidateOpportunityCounts || {},
        waveStats: stats.waveStats || [],
        diagnosticsPath: stats.diagnosticsPath || '',
        diagnostics: stats.diagnostics || {},
        topRejectionsBySource: stats.topRejectionsBySource || [],
        stopReason: stats.stopReason || '',
        maxAuditAttempts: stats.maxAuditAttempts || 0,
        maxRunMinutes: stats.maxRunMinutes || 0,
        status,
        githubRunId,
        failureReason: stats.failureReason || email.error || null,
        failureName: stats.failureName || null,
        [finishedAtKey]: new Date().toISOString(),
      });

      // If this run was kicked off by the dashboard's manual dispatch, the API
      // already inserted a pending row keyed by the GitHub run id. Reconcile
      // by updating that row instead of leaving it orphaned.
      if (githubRunId) {
        const updated = await db`
          UPDATE latchly_lead_runs
          SET
            run_date = COALESCE(${stats.date || null}::date, run_date),
            target_count = ${stats.target || 0},
            minimum_count = ${stats.minimum || 0},
            candidate_count = ${stats.candidates || 0},
            audited_count = ${stats.audited || 0},
            qualified_count = ${stats.qualified || 0},
            delivered_count = ${stats.delivered || 0},
            local_count = ${stats.localDelivered || 0},
            rejected_count = ${stats.rejected || 0},
            rejection_stats = ${JSON.stringify(stats.topRejectionReasons || [])}::jsonb,
            under_target_reason = ${stats.underTargetReason || stats.failureReason || null},
            resend_email_id = ${email.id || null},
            email_sent = ${Boolean(email.sent)},
            dry_run = ${Boolean(email.dryRun)},
            metadata = metadata || ${metadataJson}::jsonb,
            updated_at = NOW()
          WHERE metadata->>'githubRunId' = ${githubRunId}
            AND COALESCE(metadata->>'status', '') IN ('pending', 'running', '')
          RETURNING id`;
        if (updated.length > 0) return;
      }

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
          ${stats.underTargetReason || stats.failureReason || null}, ${email.id || null}, ${Boolean(email.sent)},
          ${Boolean(email.dryRun)}, ${metadataJson}::jsonb
        )`;
    },
    async attachEnrichment(businessKeyValue, { placeId, enrichmentData, existingSiteClone } = {}) {
      const db = await sql();
      await db`
        UPDATE latchly_leads SET
          place_id = COALESCE(${placeId || null}, place_id),
          enrichment_data = COALESCE(${enrichmentData ? JSON.stringify(enrichmentData) : null}::jsonb, enrichment_data),
          existing_site_clone = COALESCE(${existingSiteClone ? JSON.stringify(existingSiteClone) : null}::jsonb, existing_site_clone),
          updated_at = NOW()
        WHERE business_key = ${businessKeyValue}`;
    },
    async attachDemo(businessKeyValue, { demoSlug, demoUrl, demoDirection, demoQualityScore } = {}) {
      const db = await sql();
      await db`
        UPDATE latchly_leads SET
          demo_slug = ${demoSlug || null},
          demo_url = ${demoUrl || null},
          demo_direction = ${demoDirection || null},
          demo_quality_score = ${demoQualityScore == null ? null : Number(demoQualityScore)},
          demo_built_at = NOW(),
          updated_at = NOW()
        WHERE business_key = ${businessKeyValue}`;
    },
    async queueOutreach(businessKeyValue, { subject, body, bodyPreview, scheduledFor, status } = {}) {
      const db = await sql();
      const scheduled = scheduledFor instanceof Date ? scheduledFor.toISOString() : scheduledFor;
      // Allowed initial statuses: 'queued' (autonomous send) or 'draft' (QA gate;
      // requires manual Approve in the CRM before drain cron picks it up).
      const initialStatus = status === 'draft' ? 'draft' : 'queued';
      const result = await db`
        UPDATE latchly_leads SET
          email_subject = ${subject || null},
          email_body = ${body || null},
          email_body_preview = ${bodyPreview || null},
          outreach_status = ${initialStatus},
          outreach_step = 1,
          outreach_queued_at = NOW(),
          outreach_scheduled_for = ${scheduled || null}::timestamp,
          outreach_error = NULL,
          updated_at = NOW()
        WHERE business_key = ${businessKeyValue}
          AND outreach_status NOT IN ('day_zero_sent', 'sending', 'unsubscribed')
        RETURNING id, outreach_status, outreach_scheduled_for`;
      return result[0] || null;
    },
    async recordOutreach(businessKeyValue, { step, emailId, status, error } = {}) {
      const db = await sql();
      const normalized = String(status || '').toLowerCase();
      const isSent = normalized === 'day_zero_sent';
      await db`
        UPDATE latchly_leads SET
          outreach_step = ${Number(step || 0)},
          outreach_status = ${normalized || 'queued'},
          last_resend_email_id = COALESCE(${emailId || null}, last_resend_email_id),
          email_sent_at = CASE WHEN ${isSent} THEN NOW() ELSE email_sent_at END,
          outreach_error = ${error || null},
          updated_at = NOW()
        WHERE business_key = ${businessKeyValue}`;
    },
    async dueOutreach({ limit = 8 } = {}) {
      const db = await sql();
      const cap = Math.max(1, Math.min(Number(limit) || 8, 100));
      return db`
        SELECT
          id, business_key, business_name, city, state, niche, email,
          email_subject, email_body, email_body_preview,
          demo_url, demo_slug,
          outreach_status, outreach_scheduled_for
        FROM latchly_leads
        WHERE outreach_status = 'queued'
          AND outreach_scheduled_for IS NOT NULL
          AND outreach_scheduled_for <= NOW()
          AND email IS NOT NULL AND email <> ''
          AND demo_url IS NOT NULL AND demo_url <> ''
        ORDER BY outreach_scheduled_for ASC
        LIMIT ${cap}`;
    },
    async countOutreachSentToday() {
      const db = await sql();
      const rows = await db`
        SELECT COUNT(*)::int AS n FROM latchly_leads
        WHERE outreach_status = 'day_zero_sent'
          AND email_sent_at >= date_trunc('day', NOW())`;
      return rows[0]?.n || 0;
    },
    async findLeadById(id) {
      const db = await sql();
      const rows = await db`
        SELECT
          id, business_key, business_name, city, state, niche, email,
          email_subject, email_body, demo_url, demo_slug, outreach_status
        FROM latchly_leads WHERE id = ${id} LIMIT 1`;
      return rows[0] || null;
    },
  };
}

function normalizeRunStatus(value) {
  const status = String(value || '').toLowerCase();
  return ['completed', 'failed', 'running', 'pending'].includes(status) ? status : 'completed';
}

function toCrmRecord(lead, meta = {}) {
  const decisionMaker = normalizeDecisionMaker(lead);
  const rawPayload = lead.rawPayload || lead.sourcePayload || {};
  const auditPayload = lead.audit || {};
  const dmConfidence = decisionMaker.confidence;
  const dmConfidenceColumn = dmConfidence == null
    ? null
    : normalizeDmConfidence(dmConfidence);
  return {
    businessKey: businessKey(lead),
    businessName: lead.businessName || '',
    normalizedName: lead.normalizedName || String(lead.businessName || '').toLowerCase(),
    niche: lead.niche || '',
    city: lead.city || '',
    state: lead.state || '',
    phone: lead.phone || '',
    email: firstContactEmail(lead, rawPayload, auditPayload),
    website: lead.website || '',
    websiteStatus: lead.websiteStatus || (lead.website ? 'poor_website' : 'no_website'),
    sourceName: lead.sourceName || '',
    sourceRecordId: lead.sourceRecordId || '',
    decisionMakerName: decisionMaker.name || lead.ownerName || lead.contactName || '',
    decisionMakerTitle: decisionMaker.title || lead.ownerTitle || lead.contactTitle || '',
    decisionMakerConfidence: dmConfidenceColumn,
    score: lead.score || 0,
    scoreReasons: lead.reasons || [],
    scoreBlockers: lead.blockers || [],
    pitch: lead.pitch || {},
    isLocalMarket: Boolean(lead.isLocalMarket),
    tier: lead.tier === 'premium' ? 'premium' : 'standard',
    signalCount: Number(lead.signalCount || 0),
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
    auditPayload,
  };
}

function firstContactEmail(lead = {}, rawPayload = {}, auditPayload = {}) {
  return [
    lead.email,
    rawPayload.Email,
    rawPayload.email,
    auditPayload.email,
    ...(Array.isArray(auditPayload.emails) ? auditPayload.emails : []),
    ...(auditPayload.verifiedSignals?.contactTruth?.emails || []).map(item => item?.value),
  ]
    .map(value => String(value || '').trim().toLowerCase())
    .find(value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) || '';
}

function normalizeDecisionMaker(lead = {}) {
  const source = typeof lead.decisionMaker === 'object' && lead.decisionMaker
    ? lead.decisionMaker
    : {};
  return {
    name: cleanDecisionMakerName(source.name || lead.ownerName || lead.contactName || ''),
    title: cleanDecisionMakerName(source.title || lead.ownerTitle || lead.contactTitle || ''),
    confidence: source.confidence ?? lead.decisionMakerConfidence ?? null,
  };
}

function normalizeDmConfidence(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= 1) return num;
  if (num <= 10) return num / 10;
  return 1;
}

function cleanDecisionMakerName(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed || /^[\[{]/.test(trimmed)) return '';
  return trimmed;
}

module.exports = { createStorage };
