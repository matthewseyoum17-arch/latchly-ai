import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

// Bulk enrichment endpoint. Replaces the per-lead "Find email" / "Find owner"
// buttons in the CRM. Accepts a list of lead ids + a target ('email' | 'owner'
// | 'website' | 'both'), then runs the verified-source chain for each lead in parallel
// (concurrency-bounded), streaming progress as Server-Sent Events.
//
// The CRM passes the currently-filtered view's lead ids; the server skips
// any lead that already has the target field so the operator never re-runs
// against already-found data.
//
// Response is text/event-stream with three event types:
//   - `progress`   { leadId, businessName, target, ok, source?, value?, reason? }
//   - `summary`    { processed, found: { email, owner, website }, notAvailable: { email, owner, website }, errors }
//   - `error`      { message }   — fatal only

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 300;

const CONCURRENCY = 4;

interface BulkBody {
  leadIds: number[];
  target: "email" | "owner" | "website" | "both";
}

export async function POST(request: NextRequest) {
  if (!verifyDashboardRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return new Response("invalid_body", { status: 400 });
  }

  const target = body.target === "email" || body.target === "owner" || body.target === "website" || body.target === "both" ? body.target : "both";
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds.map(Number).filter(Number.isFinite) : [];
  if (!leadIds.length) return new Response("no_lead_ids", { status: 400 });

  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL;
  if (!dbUrl) return new Response("no_database_url", { status: 500 });
  const sql = neon(dbUrl);

  // Lazy-load Node-only helpers. `finders` uses child_process for whois;
  // `websiteResolver` uses server-side HTTP to verify missing websites.
  const finders = target === "website" ? null : await import("../../../../../scripts/latchly-leads/finders/index.js");
  const websiteResolver = await import("../../../../../scripts/latchly-leads/website-resolver.js");

  // Pull the leads we'll work on. Skip any that already satisfy the target.
  const rows = await sql`
    SELECT id, business_name, niche, city, state,
           phone, email, decision_maker_name, website, website_status, email_status, source_payload
    FROM latchly_leads
    WHERE id = ANY(${leadIds})
  ` as any[];

  const eligible = rows.filter(row => {
    if (target === "website") return !row.website;
    if (target === "email") return !row.email;
    if (target === "owner") return !row.decision_maker_name;
    // 'both' — eligible if either is missing
    return !row.email || !row.decision_maker_name;
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const summary = {
        processed: 0,
        skipped: rows.length - eligible.length,
        found: { email: 0, owner: 0, website: 0 },
        notAvailable: { email: 0, owner: 0, website: 0 },
        errors: 0,
      };

      send("start", { total: eligible.length, skipped: summary.skipped, target });

      // Concurrency-bounded loop: process up to CONCURRENCY leads in parallel.
      const queue = [...eligible];
      const workers: Promise<void>[] = [];

      const worker = async () => {
        for (;;) {
          const lead = queue.shift();
          if (!lead) return;
          try {
            const out = await processLead(lead, target, finders, websiteResolver, sql);
            for (const event of out.events) {
              send("progress", event);
              if (event.target === "email" || event.target === "owner" || event.target === "website") {
                if (event.ok) summary.found[event.target] += 1;
                else if (event.reason === "not_available") summary.notAvailable[event.target] += 1;
              }
            }
            summary.processed += 1;
          } catch (err: any) {
            summary.errors += 1;
            send("progress", {
              leadId: lead.id,
              businessName: lead.business_name,
              target,
              ok: false,
              reason: err?.message || "unknown_error",
            });
          }
        }
      };
      for (let i = 0; i < CONCURRENCY; i += 1) workers.push(worker());
      await Promise.all(workers);

      send("summary", summary);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

interface LeadRow {
  id: number;
  business_name: string | null;
  niche: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  decision_maker_name: string | null;
  website: string | null;
  website_status: string | null;
  email_status: string | null;
  source_payload: any;
}

interface ProgressEvent {
  leadId: number;
  businessName: string | null;
  target: "email" | "owner" | "website";
  ok: boolean;
  source?: string;
  value?: string;
  reason?: string;
  attempted?: string[];
}

async function processLead(
  lead: LeadRow,
  target: "email" | "owner" | "website" | "both",
  finders: any,
  websiteResolver: any,
  sql: any,
): Promise<{ events: ProgressEvent[] }> {
  const events: ProgressEvent[] = [];
  const findArgs = {
    businessName: lead.business_name || "",
    city: lead.city || "",
    state: lead.state || "",
    website: lead.website || "",
  };

  // Website --------------------------------------------------------------
  let websiteFound: string | null = null;
  let websiteSource: string | null = null;
  if (target === "website" && !lead.website) {
    const rawPayload = lead.source_payload?.rawPayload || lead.source_payload?.raw_payload || lead.source_payload || {};
    const r = await websiteResolver.resolveMissingWebsite({
      businessName: lead.business_name || "",
      niche: lead.niche || "",
      city: lead.city || "",
      state: lead.state || "",
      phone: lead.phone || "",
      website: lead.website || "",
      rawPayload,
    });
    if (r?.website) {
      websiteFound = String(r.website);
      websiteSource = String(r.source || "website_resolver");
      events.push({
        leadId: lead.id,
        businessName: lead.business_name,
        target: "website",
        ok: true,
        source: websiteSource,
        value: websiteFound,
      });
    } else {
      events.push({
        leadId: lead.id,
        businessName: lead.business_name,
        target: "website",
        ok: false,
        reason: "not_available",
        attempted: r?.evidence?.map((item: any) => item.source).filter(Boolean),
      });
    }
  }

  // Owner ----------------------------------------------------------------
  let ownerFound: string | null = null;
  let ownerSource: string | null = null;
  if ((target === "owner" || target === "both") && !lead.decision_maker_name) {
    const r = await finders.findOwnerFromVerifiedSources(findArgs);
    if (r?.ok && r.ownerName) {
      ownerFound = r.ownerName;
      ownerSource = r.source;
      events.push({
        leadId: lead.id,
        businessName: lead.business_name,
        target: "owner",
        ok: true,
        source: r.source,
        value: r.ownerName,
      });
    } else {
      events.push({
        leadId: lead.id,
        businessName: lead.business_name,
        target: "owner",
        ok: false,
        reason: r?.reason || "not_available",
        attempted: r?.attempted,
      });
    }
  }

  // Email ----------------------------------------------------------------
  let emailFound: string | null = null;
  let emailSource: string | null = null;
  if ((target === "email" || target === "both") && !lead.email) {
    // Skip operator-rejected rows.
    if (lead.email_status === "rejected") {
      events.push({
        leadId: lead.id,
        businessName: lead.business_name,
        target: "email",
        ok: false,
        reason: "operator_rejected",
      });
    } else {
      const r = await finders.findEmailFromVerifiedSources(findArgs);
      if (r?.ok && r.email) {
        emailFound = String(r.email).toLowerCase();
        emailSource = r.source;
        events.push({
          leadId: lead.id,
          businessName: lead.business_name,
          target: "email",
          ok: true,
          source: r.source,
          value: emailFound,
        });
      } else {
        events.push({
          leadId: lead.id,
          businessName: lead.business_name,
          target: "email",
          ok: false,
          reason: r?.reason || "not_available",
          attempted: r?.attempted,
        });
      }
    }
  }

  // Persist --------------------------------------------------------------
  const emailStatusUpdate = emailFound
    ? "verified"
    : (target === "email" || target === "both") && !lead.email && lead.email_status !== "rejected"
      ? "not_available"
      : null;

  if (websiteFound || emailFound || ownerFound || emailStatusUpdate) {
    await sql`
      UPDATE latchly_leads SET
        website = CASE
          WHEN website IS NOT NULL AND website <> '' THEN website
          ELSE COALESCE(${websiteFound}, website)
        END,
        website_status = CASE
          WHEN website IS NOT NULL AND website <> '' THEN website_status
          WHEN ${websiteFound} IS NOT NULL THEN 'has_website'
          ELSE website_status
        END,
        email = CASE
          WHEN email_status = 'rejected' THEN email
          WHEN email IS NOT NULL AND email <> '' THEN email
          ELSE COALESCE(${emailFound}, email)
        END,
        email_provenance = CASE
          WHEN email_status = 'rejected' THEN email_provenance
          WHEN email IS NOT NULL AND email <> '' THEN email_provenance
          ELSE COALESCE(${emailSource}, email_provenance)
        END,
        email_status = CASE
          WHEN email_status = 'rejected' THEN 'rejected'
          WHEN email IS NOT NULL AND email <> '' THEN email_status
          ELSE COALESCE(${emailStatusUpdate}, email_status)
        END,
        decision_maker_name = COALESCE(NULLIF(decision_maker_name, ''), ${ownerFound}),
        decision_maker_confidence = CASE
          WHEN decision_maker_name IS NULL OR decision_maker_name = '' THEN ${ownerFound ? 0.85 : null}
          ELSE decision_maker_confidence
        END,
        updated_at = NOW()
      WHERE id = ${lead.id}
    `;
  }

  return { events };
}
