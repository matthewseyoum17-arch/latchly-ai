export interface OutreachEmailPayload {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;
const TRAILING_URL_PUNCTUATION = /[.,!?;:)]$/;

export function shouldUseOutreachHtml() {
  return process.env.LATCHLY_OUTREACH_HTML !== "0";
}

export function textToOutreachHtml(text: string): string {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return "<p></p>";

  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${linkifyAndEscape(block).replace(/\n/g, "<br>\n")}</p>`)
    .join("\n");
}

export function outreachTagsForLead(leadId: number | string) {
  // Resend tag names and values must be [A-Za-z0-9_-] and <=256 bytes.
  return [
    { name: "lead_id", value: String(leadId) },
    { name: "source", value: "latchly-outreach" },
  ];
}

export function buildOutreachEmailPayload({
  from,
  replyTo,
  to,
  subject,
  text,
  leadId,
  headers,
}: {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  text: string;
  leadId: number | string;
  headers?: Record<string, string>;
}): OutreachEmailPayload {
  const base = { from, replyTo, to, subject, text, headers };
  if (!shouldUseOutreachHtml()) return base;

  // The current Resend send-email API exposes open/click tracking at the
  // sending-domain level, not per message. HTML and tags are per-message;
  // click tracking should stay disabled in the Resend domain settings.
  return {
    ...base,
    html: textToOutreachHtml(text),
    tags: outreachTagsForLead(leadId),
  };
}

function linkifyAndEscape(raw: string): string {
  let out = "";
  let cursor = 0;

  raw.replace(URL_RE, (match, offset) => {
    out += escapeHtml(raw.slice(cursor, offset));

    const { url, suffix } = trimUrlSuffix(match);
    const escapedUrl = escapeHtml(url);
    out += `<a href="${escapedUrl}">${escapedUrl}</a>${escapeHtml(suffix)}`;

    cursor = offset + match.length;
    return match;
  });

  out += escapeHtml(raw.slice(cursor));
  return out;
}

function trimUrlSuffix(value: string) {
  let url = value;
  let suffix = "";

  while (url && TRAILING_URL_PUNCTUATION.test(url)) {
    const char = url.slice(-1);
    if (char === ")" && countChar(url, "(") >= countChar(url, ")")) break;
    suffix = char + suffix;
    url = url.slice(0, -1);
  }

  return { url, suffix };
}

function countChar(value: string, char: string) {
  let count = 0;
  for (const next of value) {
    if (next === char) count += 1;
  }
  return count;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
