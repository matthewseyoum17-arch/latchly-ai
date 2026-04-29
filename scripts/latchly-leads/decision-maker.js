const { absoluteUrl, fetchText, normalizeWebsite, stripHtml } = require('./utils');

const FETCH_TIMEOUT_MS = Math.max(2500, parseInt(process.env.LATCHLY_DM_FETCH_TIMEOUT_MS || '5000', 10));
const PAGE_TEXT_LIMIT = Math.max(1000, parseInt(process.env.LATCHLY_DM_PAGE_TEXT_LIMIT || '3200', 10));
const HTML_LIMIT = Math.max(4000, parseInt(process.env.LATCHLY_DM_HTML_LIMIT || '10000', 10));
const CLAUDE_MODEL = process.env.LATCHLY_DM_CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const COMMON_FIRST_NAMES = new Set([
  'aaron', 'adam', 'alex', 'alicia', 'andrew', 'anthony', 'antonio', 'ben', 'belynda', 'brian', 'brandon',
  'carlos', 'charles', 'chris', 'christopher', 'dale', 'daniel', 'david', 'edward', 'eric', 'frank',
  'gabriel', 'george', 'hector', 'jackelin', 'james', 'jason', 'jesus', 'john', 'jon', 'jordan', 'jose',
  'juan', 'kevin', 'luis', 'mark', 'matthew', 'michael', 'miguel', 'paul', 'robert', 'ron', 'samuel',
  'steven', 'timothy', 'william',
]);

async function extractDecisionMaker(lead = {}, htmlInput = '', urls = [], claudeClient = null, options = {}) {
  const fetcher = options.fetcher || fetchText;
  const pages = await loadDecisionMakerPages(lead, htmlInput, urls, fetcher);
  const candidates = [];

  for (const page of pages) {
    candidates.push(...extractJsonLdCandidates(page));
  }

  for (const page of pages) {
    candidates.push(...extractMetaAuthorCandidates(page));
  }

  if (!candidates.length) {
    const claudeCandidate = await extractWithClaude(lead, pages, claudeClient);
    if (claudeCandidate) candidates.push(claudeCandidate);
  }

  for (const page of pages) {
    candidates.push(...extractRegexCandidates(page));
  }

  const heuristic = extractBusinessNameHeuristic(lead.businessName || lead.normalizedName || '');
  if (heuristic) candidates.push(heuristic);

  const placeCandidate = await extractGooglePlaceCandidate(lead, fetcher);
  if (placeCandidate) candidates.push(placeCandidate);

  return mergeCandidates(candidates);
}

async function loadDecisionMakerPages(lead, htmlInput, urls, fetcher) {
  const seeded = normalizePageInputs(htmlInput, urls);
  const byUrl = new Map();
  for (const page of seeded) {
    const key = normalizePageUrl(page.url) || `inline:${byUrl.size}`;
    byUrl.set(key, {
      url: page.url || '',
      html: String(page.html || '').slice(0, HTML_LIMIT),
      text: page.text || stripHtml(String(page.html || '')).slice(0, PAGE_TEXT_LIMIT),
    });
  }

  const base = normalizeWebsite(lead.website || seeded.find(page => page.url)?.url || '');
  const fetchUrls = decisionMakerUrls(base);
  for (const url of fetchUrls) {
    const key = normalizePageUrl(url);
    if (!url || byUrl.has(key)) continue;
    try {
      const res = await fetcher(url, FETCH_TIMEOUT_MS);
      if (!res?.ok || !res.text) continue;
      byUrl.set(key, {
        url: res.url || url,
        html: String(res.text || '').slice(0, HTML_LIMIT),
        text: stripHtml(String(res.text || '')).slice(0, PAGE_TEXT_LIMIT),
      });
    } catch {
      // Best-effort enrichment. Lack of an about/team page should not fail the audit.
    }
  }

  return [...byUrl.values()].filter(page => page.html || page.text);
}

function normalizePageInputs(htmlInput, urls = []) {
  if (Array.isArray(htmlInput)) {
    return htmlInput
      .map(page => ({
        url: page.url || page.href || '',
        html: page.html || page.text || '',
        text: page.text || '',
      }))
      .filter(page => page.html || page.text);
  }

  if (htmlInput && typeof htmlInput === 'object') {
    return normalizePageInputs([htmlInput], urls);
  }

  const allUrls = Array.isArray(urls) ? urls : [urls].filter(Boolean);
  return [{
    url: allUrls[0] || '',
    html: String(htmlInput || ''),
    text: '',
  }];
}

function decisionMakerUrls(base) {
  if (!base) return [];
  return unique([
    base,
    absoluteUrl(base, '/about'),
    absoluteUrl(base, '/about-us'),
    absoluteUrl(base, '/team'),
    absoluteUrl(base, '/our-team'),
    absoluteUrl(base, '/contact'),
    absoluteUrl(base, '/contact-us'),
    absoluteUrl(base, '/our-story'),
    absoluteUrl(base, '/staff'),
  ]);
}

function extractJsonLdCandidates(page) {
  const scripts = [];
  const html = String(page.html || '');
  html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (_, json) => {
    scripts.push(json);
    return '';
  });

  const candidates = [];
  for (const script of scripts) {
    for (const node of flattenJsonLd(parseLooseJson(script))) {
      const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
      if (/Person/i.test(type)) {
        const name = cleanName(node.name);
        if (name) {
          candidates.push(candidate(name, node.jobTitle || node.title || '', 0.9, 'json_ld_person', page.url));
        }
      }
      if (/Organization|LocalBusiness/i.test(type)) {
        for (const field of ['founder', 'founders', 'employee', 'employees', 'owner']) {
          for (const person of asArray(node[field])) {
            const name = cleanName(typeof person === 'string' ? person : person?.name);
            if (name) {
              const title = person?.jobTitle || person?.title || (field.includes('founder') ? 'Founder' : '');
              candidates.push(candidate(name, title, 0.9, `json_ld_${field}`, page.url));
            }
          }
        }
      }
    }
  }
  return candidates;
}

function parseLooseJson(raw) {
  try {
    return JSON.parse(String(raw || '').trim());
  } catch {
    return null;
  }
}

function flattenJsonLd(value) {
  const out = [];
  const visit = node => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;
    out.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  visit(value);
  return out;
}

function extractMetaAuthorCandidates(page) {
  const html = String(page.html || '');
  const candidates = [];
  const metaRe = /<meta\b[^>]*(?:name|property)=["'](?:author|og:author|twitter:creator)["'][^>]*>/gi;
  for (const tag of html.match(metaRe) || []) {
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1] || '';
    const name = cleanName(content.replace(/^@/, ''));
    if (name) candidates.push(candidate(name, '', 0.8, 'meta_author', page.url));
  }
  return candidates;
}

async function extractWithClaude(lead, pages, claudeClient) {
  const client = claudeClient || createClaudeClient();
  if (!client) return null;

  const pageText = pages
    .slice(0, 5)
    .map(page => `URL: ${page.url || 'inline'}\n${(page.text || stripHtml(page.html)).slice(0, PAGE_TEXT_LIMIT)}`)
    .join('\n\n---\n\n');
  if (!pageText.trim()) return null;

  const prompt = [
    'Extract the most likely owner, founder, principal, president, CEO, or general manager for this home-service business.',
    'Return only compact JSON: {"name":"","title":"","confidence":0}. Confidence is 0 to 1.',
    'Use an empty name and confidence 0 if no person is clearly identified.',
    `Business: ${lead.businessName || ''}`,
    `Market: ${[lead.city, lead.state].filter(Boolean).join(', ')}`,
    pageText,
  ].join('\n\n');

  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 220,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = responseText(response);
    const parsed = parseLooseJson(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const name = cleanName(parsed?.name);
    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence || 0)));
    if (!name || confidence <= 0) return null;
    return candidate(name, parsed?.title || '', Math.min(0.75, confidence), 'claude_page_text', pages[0]?.url || '');
  } catch {
    return null;
  }
}

function createClaudeClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch {
    return null;
  }
}

function responseText(response) {
  return (response?.content || [])
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .join('\n')
    .trim();
}

function extractRegexCandidates(page) {
  const text = String(page.text || stripHtml(page.html || '')).replace(/\s+/g, ' ');
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-,|]\s*(Owner|Founder|President|CEO|Principal|General Manager|Operations Manager|Office Manager)/g,
    /(Owner|Founder|President|CEO|Principal|General Manager|Operations Manager|Office Manager)\s*[-:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g,
    /meet\s+(?:the\s+owner\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi,
  ];
  const out = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (/owner|founder|president|ceo|principal|manager/i.test(match[1])) {
        out.push(candidate(match[2], match[1], 0.65, 'regex_owner_title', page.url));
      } else {
        out.push(candidate(match[1], match[2] || 'Owner', 0.65, 'regex_owner_title', page.url));
      }
    }
  }
  return out;
}

function extractBusinessNameHeuristic(name) {
  const value = String(name || '').trim();
  const personNamedBusiness = value.match(/\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})(?:\s+[A-Z][a-z]{2,}){0,3}\s+(?:Plumbing|Roofing|HVAC|Electric|Electrical|Painting|Landscaping|Tree|Pest|Pool|Fence|Concrete|Masonry|Construction|Remodel|Gutter|Handyman|Property|Air|Heating|Cooling)\b/);
  if (personNamedBusiness && isLikelyFirstName(personNamedBusiness[1]) && !isLikelyBrandPhrase(personNamedBusiness[1], personNamedBusiness[2])) {
    return candidate(`${personNamedBusiness[1]} ${personNamedBusiness[2]}`, '', 0.58, 'business_name_person_named', '');
  }
  const possessive = value.match(/\b([A-Z][a-z]{2,})['’]s\s+(?:Plumbing|Roofing|HVAC|Electric|Electrical|Painting|Landscaping|Tree|Pest|Pool|Fence|Concrete|Remodel|Gutter|Handyman)\b/);
  if (possessive) return candidate(possessive[1], '', 0.5, 'business_name_possessive', '');
  const sons = value.match(/\b([A-Z][a-z]{2,})\s+(?:&|and)\s+Sons\b/);
  if (sons) return candidate(sons[1], '', 0.5, 'business_name_sons', '');
  return null;
}

function isLikelyBrandPhrase(first, second) {
  const phrase = `${first} ${second}`.toLowerCase();
  return /^(texas|florida|georgia|dallas|houston|austin|tampa|orlando|miami|total|best|good|great|right|quality|premier|prime|superior|advanced|american|southern|central|national|local|team|the)\b/.test(phrase);
}

function isLikelyFirstName(value) {
  return COMMON_FIRST_NAMES.has(String(value || '').toLowerCase());
}

async function extractGooglePlaceCandidate(lead, fetcher) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = lead.placeId || lead.googlePlaceId || lead.sourcePlaceId || lead.rawPayload?.place_id;
  if (!key || !placeId) return null;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=editorial_summary&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetcher(url, FETCH_TIMEOUT_MS);
    const parsed = parseLooseJson(res?.text || '');
    const summary = parsed?.result?.editorial_summary?.overview || '';
    const page = { url, text: summary, html: summary };
    return extractRegexCandidates(page)[0]
      ? { ...extractRegexCandidates(page)[0], confidence: 0.55, source: 'google_place_editorial_summary' }
      : null;
  } catch {
    return null;
  }
}

function mergeCandidates(candidates) {
  const clean = candidates
    .filter(item => item && cleanName(item.name))
    .map(item => ({ ...item, name: cleanName(item.name), confidence: normalizeConfidence(item.confidence) }))
    .filter(item => item.confidence > 0);

  if (!clean.length) return { name: '', title: '', confidence: 0, sources: [] };

  const groups = new Map();
  for (const item of clean) {
    const key = nameKey(item.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const ranked = [...groups.values()].map(group => {
    const sorted = [...group].sort(candidateSort);
    const best = sorted[0];
    const agreement = new Set(group.map(item => item.source)).size >= 2;
    const confidence = agreement ? Math.max(0.95, best.confidence) : best.confidence;
    return {
      ...best,
      confidence,
      sources: group.map(item => ({
        source: item.source,
        url: item.url || '',
        confidence: item.confidence,
      })),
      agreement,
    };
  }).sort(candidateSort);

  const best = ranked[0];
  return {
    name: best.name,
    title: best.title || '',
    confidence: Number(best.confidence.toFixed(2)),
    sources: best.sources,
  };
}

function candidateSort(a, b) {
  return Number(b.confidence || 0) - Number(a.confidence || 0)
    || Number(hasFirstLastName(b.name)) - Number(hasFirstLastName(a.name))
    || String(a.name || '').localeCompare(String(b.name || ''));
}

function candidate(name, title, confidence, source, url) {
  return {
    name: cleanName(name),
    title: cleanTitle(title),
    confidence,
    source,
    url: url || '',
  };
}

function cleanName(value) {
  const text = String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z]+|[^A-Za-z. '\-]+$/g, '')
    .trim();
  if (!text || text.length < 2 || text.length > 80) return '';
  if (/^(admin|office|contact|info|support|sales|team|staff|owner|founder|manager)$/i.test(text)) return '';
  if (/@|https?:|www\.|\.com\b/i.test(text)) return '';
  return text;
}

function cleanTitle(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function normalizeConfidence(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= 1) return num;
  if (num <= 10) return num / 10;
  return 1;
}

function nameKey(name) {
  const parts = String(name || '').toLowerCase().match(/[a-z]+/g) || [];
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function hasFirstLastName(name) {
  return (String(name || '').match(/\b[A-Za-z][a-z]+\b/g) || []).length >= 2;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function normalizePageUrl(url) {
  return String(url || '').replace(/\/+$/, '').toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  extractDecisionMaker,
  extractJsonLdCandidates,
  extractMetaAuthorCandidates,
  extractRegexCandidates,
  extractBusinessNameHeuristic,
  mergeCandidates,
  decisionMakerUrls,
};
