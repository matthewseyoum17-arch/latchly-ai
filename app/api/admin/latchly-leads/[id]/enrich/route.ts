import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import dns from "node:dns/promises";
import { verifyDashboardRequest } from "@/lib/auth";

// On-demand enrichment for a single lead. Triggered from the CRM "Find
// email" / "Find owner" buttons. Runs the FREE chain only:
//   1. Re-scrape the lead's /contact, /about, /team pages for emails +
//      owner names lifted from "Owner: ..." / "Meet our team" patterns.
//   2. If we have an owner name + business domain but still no email,
//      generate the standard person-shaped permutations and validate each
//      against the domain's MX records.
//   3. Backfill missing decision_maker_name + email columns (never clobber
//      values the operator already set; we use NULLIF + COALESCE so a hand-
//      typed entry always wins over the auto-found one).
//
// Florida public registries (Sunbiz, DBPR) are Cloudflare-protected against
// server-side fetch, so they're not in this path — they belong on the
// bulk-ingest side of the pipeline (deferred per the plan).

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
    email?: { old: string | null; new: string; via: string };
    decisionMakerName?: { old: string | null; new: string; via: string };
  };
  attempted: string[];
  notes: string[];
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
  }

  const sql = neon(dbUrl);
  const rows = await sql`
    SELECT id, business_key, business_name, niche, city, state,
           email, decision_maker_name, decision_maker_title, decision_maker_confidence,
           website, website_status
    FROM latchly_leads WHERE id = ${leadId} LIMIT 1
  ` as any[];
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result: EnrichResult = { ok: true, changes: {}, attempted: [], notes: [] };

  const initialEmail = (lead.email || "").trim().toLowerCase();
  const initialOwner = (lead.decision_maker_name || "").trim();
  const businessDomain = deriveBusinessDomain(lead.website || "");

  // 1. Re-scrape the website for fresh contact pages.
  let scrapedEmails: string[] = [];
  let scrapedOwnerName: string | null = null;
  if (lead.website) {
    result.attempted.push("website_scrape");
    const scrape = await scrapeContactPages(lead.website);
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

  // 3. Owner name from scrape if we don't have one.
  let bestOwner = "";
  if (targetSet.has("owner") && !initialOwner && scrapedOwnerName) {
    bestOwner = scrapedOwnerName;
    result.changes.decisionMakerName = { old: null, new: bestOwner, via: "website_scrape" };
  }

  // 4. Pattern-guess fallback when we have an owner name + domain but still no email.
  const ownerForGuess = bestOwner || initialOwner;
  if (targetSet.has("email") && !initialEmail && !bestEmail && ownerForGuess && businessDomain) {
    result.attempted.push("pattern_guess");
    const guess = await patternGuessEmail(ownerForGuess, businessDomain);
    if (guess.email) {
      bestEmail = guess.email;
      result.changes.email = { old: null, new: bestEmail, via: "pattern_guess_mx_only" };
      result.notes.push(`pattern_guess: ${guess.email} (MX validated)`);
    } else {
      result.notes.push(`pattern_guess: ${guess.reason}`);
    }
  }

  // 5. Persist. NULLIF guard means we never clobber a hand-edited value
  //    even if a rerun finds a different candidate. Email status is set so
  //    the UI can warn that pattern-guessed addresses haven't been verified
  //    against a real mailbox (Codex review #3) and so manual clears
  //    (email_status='rejected') aren't auto-refilled (#2).
  const provenance = result.changes.email?.via || null;
  const emailStatus = provenance === "pattern_guess_mx_only" ? "guessed" : provenance ? "verified" : null;
  if (bestEmail || bestOwner) {
    await sql`
      UPDATE latchly_leads SET
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
          WHEN decision_maker_name IS NULL OR decision_maker_name = '' THEN ${bestOwner ? 0.7 : null}
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
           website
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

async function patternGuessEmail(ownerName: string, domain: string): Promise<{ email: string | null; reason: string }> {
  if (!domain) return { email: null, reason: "no_domain" };
  if (!(await hasMx(domain))) return { email: null, reason: "no_mx_records" };
  const split = splitName(ownerName);
  if (!split) return { email: null, reason: "unparseable_name" };
  const candidates = permute(split, domain);
  if (!candidates.length) return { email: null, reason: "no_candidates" };
  const ranked = rankEmails(candidates, domain);
  return { email: ranked[0] || null, reason: "ok" };
}

function splitName(name: string): { first: string; last: string } | null {
  const trimmed = String(name || "").replace(/[^A-Za-z\s'-]/g, "").replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (!parts.length) return null;
  return {
    first: parts[0].toLowerCase(),
    last: parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "",
  };
}

function permute(split: { first: string; last: string }, domain: string): string[] {
  const { first, last } = split;
  const fi = first.charAt(0);
  const li = last.charAt(0);
  const out: string[] = [];
  if (first) out.push(`${first}@${domain}`);
  if (first && last) {
    out.push(`${first}.${last}@${domain}`);
    out.push(`${first}${last}@${domain}`);
    out.push(`${fi}${last}@${domain}`);
    out.push(`${first}${li}@${domain}`);
    out.push(`${fi}.${last}@${domain}`);
  }
  return out;
}

const MX_CACHE = new Map<string, { ok: boolean; at: number }>();
const MX_CACHE_MS = 30 * 60 * 1000;

async function hasMx(domain: string): Promise<boolean> {
  if (!domain) return false;
  const cached = MX_CACHE.get(domain);
  if (cached && Date.now() - cached.at < MX_CACHE_MS) return cached.ok;
  try {
    const records = await dns.resolveMx(domain);
    const ok = Array.isArray(records) && records.length > 0;
    MX_CACHE.set(domain, { ok, at: Date.now() });
    return ok;
  } catch {
    MX_CACHE.set(domain, { ok: false, at: Date.now() });
    return false;
  }
}
