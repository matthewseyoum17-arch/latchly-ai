import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyDashboardRequest } from "@/lib/auth";

// On-demand enrichment for a single lead. Pattern-guessing is permanently
// disabled — this route now delegates to the verified-source finder chain
// (BBB → OpenCorporates → Yelp → WHOIS → on-page scrape) and falls back
// to `email_status='not_available'` when nothing returns a verified hit.
//
// 1. Re-scrape the lead's /contact, /about, /team pages for emails +
//    owner names lifted from "Owner: ..." / "Meet our team" patterns.
// 2. If the scrape didn't surface either, fall through to the verified-
//    source chain in scripts/latchly-leads/finders/.
// 3. Backfill missing decision_maker_name + email columns (never clobber
//    values the operator already set; we use NULLIF + COALESCE so a hand-
//    typed entry always wins over the auto-found one).
//
// What we never do: generate `firstname@domain` permutations, MX-validate
// guesses, or surface anything not returned by a real public source.

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const ROLE_LOCAL_PARTS = new Set([
  "info", "noreply", "no-reply", "donotreply", "do-not-reply",
  "contact", "sales", "hello", "hi", "support", "admin", "help",
  "enquiries", "enquiry", "inquiry", "inquiries", "office", "reception",
  "team", "mail", "email", "webmaster", "postmaster", "service", "services",
  "jobs", "careers", "hr", "billing", "accounts", "accounting",
]);

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com",
  "hotmail.com", "live.com", "outlook.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
]);

const VALID_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

interface EnrichResult {
  ok: boolean;
  lead?: any;
  changes: {
    website?: { old: string | null; new: string; via: string };
    email?: { old: string | null; new: string; via: string };
    decisionMakerName?: { old: string | null; new: string; via: string };
  };
  attempted: string[];
  notes: string[];
  notAvailable?: { email?: boolean; owner?: boolean };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!verifyDashboardRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const leadId = Number(id);
  if (!Number.isFinite(leadId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const dbUrl =
    process.env.DATABASE_URL_UNPOOLED
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "no_database_url" }, { status: 500 });

  let body: { targets?: string[] } = {};
  try { body = (await request.json().catch(() => ({}))) as any; } catch {}
  const targetSet = new Set(
    (Array.isArray(body.targets) && body.targets.length ? body.targets : ["email", "owner"])
      .map(t => String(t || "").toLowerCase()),
  );
  if (targetSet.has("all")) {
    targetSet.add("email");
    targetSet.add("owner");
    targetSet.add("website");
  }

  const sql = neon(dbUrl);
  const rows = await sql`
    SELECT id, business_key, business_name, niche, city, state,
           email, decision_maker_name, decision_maker_title, decision_maker_confidence,
           phone, website, website_status, source_payload
    FROM latchly_leads WHERE id = ${leadId} LIMIT 1
  ` as any[];
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result: EnrichResult = {
    ok: true,
    changes: {},
    attempted: [],
    notes: [],
    notAvailable: {},
  };

  const initialEmail = (lead.email || "").trim().toLowerCase();
  const initialOwner = (lead.decision_maker_name || "").trim();
  let resolvedWebsite = "";

  if (targetSet.has("website") && !(lead.website || "").trim()) {
    result.attempted.push("website_resolver");
    try {
      const resolver = await import("../../../../../../scripts/latchly-leads/website-resolver.js");
      const rawPayload = lead.source_payload?.rawPayload || lead.source_payload?.raw_payload || lead.source_payload || {};
      const resolved = await resolver.resolveMissingWebsite({
        businessName: lead.business_name || "",
        niche: lead.niche || "",
        city: lead.city || "",
        state: lead.state || "",
        phone: lead.phone || "",
        website: lead.website || "",
        rawPayload,
      }, { timeoutMs: FETCH_TIMEOUT_MS });
      if (resolved?.website) {
        const resolvedSource = String((resolved as any).source || "website_resolver");
        resolvedWebsite = String(resolved.website);
        result.changes.website = {
          old: null,
          new: resolvedWebsite,
          via: resolvedSource,
        };
        result.notes.push(`website_via_${resolvedSource}: ${resolvedWebsite}`);
      } else {
        result.notes.push(`website_not_verified: ${resolved?.reason || "not_found"}`);
      }
    } catch (err: any) {
      result.notes.push(`website_resolver_error: ${err?.message || err}`);
    }
  }

  const effectiveWebsite = resolvedWebsite || lead.website || "";
  const businessDomain = deriveBusinessDomain(effectiveWebsite);

  // 1. Re-scrape the website for fresh contact pages — first chance at a
  //    verified email + owner name.
  let scrapedEmails: string[] = [];
  let scrapedOwnerName: string | null = null;
  if (effectiveWebsite) {
    result.attempted.push("website_scrape");
    const scrape = await scrapeContactPages(effectiveWebsite);
    scrapedEmails = scrape.emails;
    scrapedOwnerName = scrape.ownerName;
    if (!scrape.emails.length && !scrape.ownerName) {
      result.notes.push(`website_scrape: nothing extracted (${scrape.pagesTried} pages tried)`);
    } else {
      result.notes.push(`website_scrape: ${scrape.emails.length} emails, owner=${scrape.ownerName ? "yes" : "no"}, pages=${scrape.pagesTried}`);
    }
  } else {
    result.notes.push("no_website_skipping_scrape");
  }

  // 2. Pick a candidate email from the scrape, prefer business-domain + person-shaped.
  let bestEmail = "";
  if (targetSet.has("email") && !initialEmail) {
    const ranked = rankEmails(scrapedEmails, businessDomain);
    if (ranked.length) {
      bestEmail = ranked[0];
      result.changes.email = { old: null, new: bestEmail, via: "website_scrape" };
    }
  }

  // 3. Owner name from scrape.
  let bestOwner = "";
  if (targetSet.has("owner") && !initialOwner && scrapedOwnerName) {
    bestOwner = scrapedOwnerName;
    result.changes.decisionMakerName = { old: null, new: bestOwner, via: "website_scrape" };
  }

  // 4. Verified-source fallback chain (BBB → OpenCorporates → Yelp → WHOIS).
  //    Replaces the deleted pattern-guess path. Each source returns either
  //    a real verified hit or a reason; if all return reasons, the field
  //    stays empty and the response surfaces `notAvailable: true`.
  const ownerNeeded = targetSet.has("owner") && !initialOwner && !bestOwner;
  const emailNeeded = targetSet.has("email") && !initialEmail && !bestEmail;
  if (ownerNeeded || emailNeeded) {
    // Lazy-require the chain so we don't pay the import cost on every
    // request — most enrich calls hit the website-scrape first and stop.
    const finders = await import("../../../../../../scripts/latchly-leads/finders/index.js");

    if (ownerNeeded) {
      result.attempted.push("verified_owner_chain");
      try {
        const owner = await finders.findOwnerFromVerifiedSources({
          businessName: lead.business_name,
          city: lead.city,
          state: lead.state,
          website: lead.website || "",
          domain: businessDomain,
        });
        if (owner?.ok && owner.ownerName) {
          bestOwner = owner.ownerName;
          const ownerVia = String(owner.source || "verified");
          result.changes.decisionMakerName = { old: null, new: bestOwner, via: ownerVia };
          result.notes.push(`owner_via_${ownerVia}: ${owner.ownerName} (conf=${owner.confidence})`);
        } else {
          result.notAvailable!.owner = true;
          result.notes.push(`owner_not_available (tried: ${(owner?.attempted || []).join(", ")})`);
        }
      } catch (err: any) {
        result.notes.push(`owner_chain_error: ${err?.message || err}`);
      }
    }

    if (emailNeeded) {
      result.attempted.push("verified_email_chain");
      try {
        const verifiedEmail = await finders.findEmailFromVerifiedSources({
          businessName: lead.business_name,
          city: lead.city,
          state: lead.state,
          website: lead.website || "",
          domain: businessDomain,
        });
        if (verifiedEmail?.ok && verifiedEmail.email) {
          bestEmail = String(verifiedEmail.email).toLowerCase();
          const emailVia = String(verifiedEmail.source || "verified");
          result.changes.email = { old: null, new: bestEmail, via: emailVia };
          result.notes.push(`email_via_${emailVia}: ${bestEmail} (conf=${verifiedEmail.confidence})`);
        } else {
          result.notAvailable!.email = true;
          result.notes.push(`email_not_available (tried: ${(verifiedEmail?.attempted || []).join(", ")})`);
        }
      } catch (err: any) {
        result.notes.push(`email_chain_error: ${err?.message || err}`);
      }
    }
  }

  // 5. Persist. Determine the final email_status based on what we found:
  //    - Any verified hit → 'verified'
  //    - We tried the chain and nothing came back → 'not_available'
  //    - We didn't try (already had a value) → leave existing status alone
  //    NULLIF guard means we never clobber a hand-edited value even if a
  //    rerun finds a different candidate. `email_status='rejected'` (operator
  //    cleared the email) is also never auto-refilled.
  const provenance = result.changes.email?.via || null;
  const emailStatus = bestEmail ? "verified" : (result.notAvailable?.email ? "not_available" : null);
  const shouldUpdate = resolvedWebsite || bestEmail || bestOwner || result.notAvailable?.email;
  if (shouldUpdate) {
    await sql`
      UPDATE latchly_leads SET
        website = CASE
          WHEN website IS NOT NULL AND website <> '' THEN website
          ELSE COALESCE(${resolvedWebsite || null}, website)
        END,
        website_status = CASE
          WHEN website IS NOT NULL AND website <> '' THEN website_status
          WHEN ${resolvedWebsite || null} IS NOT NULL THEN 'has_website'
          ELSE website_status
        END,
        email = CASE
          WHEN email_status = 'rejected' THEN email
          WHEN email IS NOT NULL AND email <> '' THEN email
          ELSE COALESCE(${bestEmail || null}, email)
        END,
        email_provenance = CASE
          WHEN email_status = 'rejected' THEN email_provenance
          WHEN email IS NOT NULL AND email <> '' THEN email_provenance
          ELSE COALESCE(${provenance}, email_provenance)
        END,
        email_status = CASE
          WHEN email_status = 'rejected' THEN 'rejected'
          WHEN email IS NOT NULL AND email <> '' THEN email_status
          ELSE COALESCE(${emailStatus}, email_status)
        END,
        decision_maker_name = COALESCE(NULLIF(decision_maker_name, ''), ${bestOwner || null}),
        decision_maker_confidence = CASE
          WHEN decision_maker_name IS NULL OR decision_maker_name = '' THEN ${bestOwner ? 0.85 : null}
          ELSE decision_maker_confidence
        END,
        updated_at = NOW()
      WHERE id = ${leadId}
    `;
  }

  // Return the post-update row so the UI can refresh in place.
  const after = (await sql`
    SELECT id, business_key, business_name, niche, city, state,
           email, decision_maker_name, decision_maker_title, decision_maker_confidence,
           website, website_status, email_status, email_provenance
    FROM latchly_leads WHERE id = ${leadId} LIMIT 1
  ` as any[])[0];
  result.lead = after;

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

// --- helpers ----------------------------------------------------------------

function deriveBusinessDomain(value: string): string {
  if (!value) return "";
  if (value.includes("@")) return (value.split("@")[1] || "").toLowerCase();
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeEmail(value: string): string {
  if (!value) return "";
  const trimmed = String(value).trim().toLowerCase();
  return VALID_EMAIL_RE.test(trimmed) ? trimmed : "";
}

function localPart(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

function domainPart(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

function isPersonShapedLocal(local: string): boolean {
  if (!local || local.length < 3) return false;
  if (ROLE_LOCAL_PARTS.has(local)) return false;
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return true;
  if (/^[a-z]\.?[a-z]{2,}$/.test(local)) return true;
  if (/^[a-z]{3,}$/.test(local)) return true;
  return false;
}

function scoreEmail(email: string, businessDomain: string): number {
  const local = localPart(email);
  const domain = domainPart(email);
  let score = 0;
  if (isPersonShapedLocal(local)) score += 10;
  if (!ROLE_LOCAL_PARTS.has(local)) score += 4;
  if (businessDomain && domain === businessDomain) score += 6;
  if (!FREE_MAIL_DOMAINS.has(domain)) score += 2;
  if (local.length > 24) score -= 2;
  return score;
}

function rankEmails(candidates: string[], businessDomain: string): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of candidates || []) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  valid.sort((a, b) => scoreEmail(b, businessDomain) - scoreEmail(a, businessDomain));
  return valid;
}

async function fetchHtml(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*", "Accept-Language": "en-US" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct && !/text\/html|application\/xhtml/i.test(ct)) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function extractEmailsFromHtml(html: string): string[] {
  const matches = html.match(EMAIL_RE) || [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

function extractOwnerFromText(text: string): string | null {
  // "Owner: Jane Smith" / "Founder: John Doe" / "Meet John, our owner"
  const patterns = [
    /(?:Owner|Founder|Proprietor|Operator|President)\s*[:\-]\s*([A-Z][A-Za-z'\.\-]+(?:\s+[A-Z][A-Za-z'\.\-]+){0,3})/,
    /(?:Meet|I am|I'm)\s+([A-Z][A-Za-z'\.\-]+(?:\s+[A-Z][A-Za-z'\.\-]+){1,2})\s*,?\s*(?:the\s+)?(?:owner|founder|president|operator)/i,
    /([A-Z][A-Za-z'\.\-]+(?:\s+[A-Z][A-Za-z'\.\-]+){1,2})\s*[—\-]\s*(?:Owner|Founder|President|Proprietor)/,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) {
      const name = match[1].trim();
      if (/\s/.test(name)) return name;
    }
  }
  return null;
}

interface ScrapeOutcome {
  emails: string[];
  ownerName: string | null;
  pagesTried: number;
}

async function scrapeContactPages(rawWebsite: string): Promise<ScrapeOutcome> {
  const base = normalizeWebsite(rawWebsite);
  if (!base) return { emails: [], ownerName: null, pagesTried: 0 };
  const candidates = uniquePaths([
    base,
    join(base, "/contact"),
    join(base, "/contact-us"),
    join(base, "/about"),
    join(base, "/about-us"),
    join(base, "/team"),
    join(base, "/our-team"),
    join(base, "/staff"),
  ]).slice(0, 6);

  const allEmails: string[] = [];
  let ownerName: string | null = null;
  let triedCount = 0;

  for (const url of candidates) {
    const html = await fetchHtml(url);
    if (!html) continue;
    triedCount += 1;
    allEmails.push(...extractEmailsFromHtml(html));
    if (!ownerName) {
      const text = stripTags(html).replace(/\s+/g, " ");
      ownerName = extractOwnerFromText(text);
    }
  }

  return {
    emails: Array.from(new Set(allEmails)),
    ownerName,
    pagesTried: triedCount,
  };
}

function normalizeWebsite(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "";
  }
}

function join(base: string, path: string): string {
  if (!base) return "";
  return `${base.replace(/\/$/, "")}${path}`;
}

function uniquePaths(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}
