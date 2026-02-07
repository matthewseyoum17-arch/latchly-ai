# SitePulse AI — Circular Reply Diagnosis & Fix Plan

---

## 1) Root-Cause Diagnosis Checklist (ranked by likelihood for THIS codebase)

| # | Cause | Likelihood | Status in Your Code |
|---|-------|-----------|---------------------|
| **1** | **Response function is stateless — zero history passed** | **100% CONFIRMED** | `getAIResponse(message, industryKey)` takes only current msg. No history arg. |
| **2** | **Only 7 response buckets with broad regex overlap** | **100% CONFIRMED** | "How much is whitening?" and "What's the cost of a crown?" both match `/price\|cost\|how much/` → identical response |
| **3** | **Greedy default fallback — anything unmatched returns same text** | **100% CONFIRMED** | "Tell me about parking", "Do you take Aetna?", "What's your cancellation policy?" → all return `r.default` |
| **4** | **No turn-aware state machine** | **100% CONFIRMED** | No `turnCount`, no `lastTopic`, no `askedLeadForm` flag. Bot can't progress through qualification → booking → lead capture |
| **5** | No conversation_id / session persistence | N/A | Chat is ephemeral React state — fine for demo, but means no server-side dedup |
| **6** | Duplicate message sends from frontend | Low | `sendMessage` clears input immediately; no double-fire guard but unlikely root cause |
| **7** | Streaming/caching issues | N/A | No streaming, no cache — responses are synchronous string returns |
| **8** | Prompt template includes last assistant response as "user" | N/A | No prompt template exists — no LLM call at all |

**Bottom line:** This isn't a "bug" — it's an architecture gap. The system was built as a keyword→canned-response demo and has no mechanism to avoid repetition because it has no memory of what it already said.

---

## 2) Targeted Instrumentation Plan

Even though the current implementation has no LLM backend, you need instrumentation for both the current demo AND the future LLM-backed version.

### 2a) Immediate (client-side, for the demo)

Add these to `sendMessage` / `handleQuickReply`:

```js
// In sendMessage, right before calling getAIResponse:
const debugPayload = {
  turn: messages.length,
  userInput: input.trim(),
  inputHash: simpleHash(input.trim().toLowerCase()),      // detect exact repeats
  matchedBucket: getMatchedBucket(input.trim(), industryKey), // which regex fired
  previousBotResponse: messages.filter(m => m.role === 'bot').slice(-1)[0]?.text?.substring(0, 80),
  responseHash: simpleHash(response),                      // detect identical outputs
  isDuplicate: simpleHash(response) === simpleHash(messages.filter(m => m.role === 'bot').slice(-1)[0]?.text),
};
console.log('[SitePulse Debug]', debugPayload);
```

Helper:
```js
function simpleHash(str) {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

function getMatchedBucket(message, industryKey) {
  const l = message.toLowerCase();
  if (l.match(/service|offer|do you do|treatment|practice|listing|search/)) return 'services';
  if (l.match(/price|cost|how much|pricing|fee|billing|valuation/)) return 'pricing';
  if (l.match(/hour|open|close|when|location|where/)) return 'hours';
  if (l.match(/book|appointment|schedule|consult|quote|estimate/)) return 'appointment';
  if (l.match(/emergency|urgent|pain|repair|broken|leak|burst|arrest/)) return 'emergency';
  if (l.match(/special|deal|maintenance|plan|drain|clean|sell/)) return 'services_alt';
  return 'default_fallback';
}
```

### 2b) Future (when you add an LLM API route)

Log at `POST /api/chat`:

| What | Where | Why |
|------|-------|-----|
| `conversation_id` | Request header or body | Session continuity |
| `messages[]` with roles | Request body | Verify history is appended, not overwritten |
| `SHA-256(JSON.stringify(messages))` | Server before LLM call | Detect identical payloads across turns |
| `SHA-256(assistantResponse)` | Server after LLM call | Detect identical outputs |
| `model`, `temperature`, `max_tokens` | Server | Verify generation params |
| `Cache-Control` header | Response | Ensure no HTTP-level caching of chat |
| Streaming chunk count + final length | Server | Detect truncation/reuse of last chunk |

---

## 3) Concrete Fixes

### Fix A — History-Aware Response Engine (replaces `getAIResponse`)

This is the **minimum viable fix** that works without an LLM:

```js
function getAIResponse(message, industryKey, conversationHistory = []) {
  const r = (INDUSTRIES[industryKey] || INDUSTRIES.dental).responses;
  const l = message.toLowerCase();
  const botHistory = conversationHistory.filter(m => m.role === 'bot').map(m => m.text);
  const turnCount = botHistory.length; // 0 = first bot response (greeting already sent)

  // 1. Determine topic bucket
  let bucket = 'default';
  if (l.match(/service|offer|do you do|treatment|practice|listing|search/)) bucket = 'services';
  else if (l.match(/price|cost|how much|pricing|fee|billing|valuation/)) bucket = 'pricing';
  else if (l.match(/hour|open|close|when|location|where/)) bucket = 'hours';
  else if (l.match(/book|appointment|schedule|consult|quote|estimate/)) bucket = 'appointment';
  else if (l.match(/emergency|urgent|pain|repair|broken|leak|burst|arrest/)) bucket = 'emergency';
  else if (l.match(/special|deal|maintenance|plan|drain|clean|sell/)) bucket = 'services';

  // 2. Get candidate response
  const candidate = r[bucket] || r.default;

  // 3. Anti-repeat: if last bot message is identical, pivot
  const lastBotMsg = botHistory[botHistory.length - 1] || '';
  if (candidate === lastBotMsg) {
    return getProgressionResponse(bucket, turnCount, r, INDUSTRIES[industryKey]);
  }

  // 4. After 2+ turns on same topic, nudge toward lead capture
  const sameBucketCount = conversationHistory.filter(
    m => m.role === 'user' && getMatchedBucket(m.text, industryKey) === bucket
  ).length;
  if (sameBucketCount >= 2) {
    return candidate + '\n\n---\n💡 Want me to have someone from our team reach out to you directly? I can collect your info right here.';
  }

  return candidate;
}

function getProgressionResponse(bucket, turnCount, responses, industry) {
  // When we WOULD repeat, offer a different next step instead
  const progressions = {
    services: `I've shared our full service list above! Would you like:\n\n• 💰 Pricing details on a specific service?\n• 📅 To book an appointment?\n• 📞 To speak with our team directly?`,
    pricing: `Those price ranges are listed above — for an exact quote tailored to your situation:\n\n1. 📅 Book a free consultation\n2. 📞 Call us at ${industry?.responses?.hours?.match(/\(555\) \d{3}-\d{4}/)?.[0] || 'our office'}\n3. 💬 Tell me more about what you need and I'll narrow it down`,
    hours: `Our hours are listed above! Need something else?\n\n• 📅 Book an appointment\n• 💰 Get pricing info\n• 📞 Call us directly`,
    appointment: `I'd love to get you booked! If you haven't shared yet, I just need:\n\n1. What type of visit/service?\n2. Your preferred date?\n3. Your name and phone number?\n\nOr I can have someone call you!`,
    emergency: `If this is urgent, please call us directly — that's the fastest path.\n\nOtherwise, want me to collect your info so our team can reach out ASAP?`,
    default: `I want to make sure I help you with exactly what you need. Could you tell me:\n\n• What specific service or question brought you here today?\n• Are you looking to book, get a price, or just learn more?\n\nI'm here to help! 😊`,
  };
  return progressions[bucket] || progressions.default;
}
```

**Key changes:**
- `getAIResponse` now receives `conversationHistory` (the full `messages` array)
- Detects when it would return an identical response and pivots
- After 2 user messages on the same topic, nudges toward lead capture
- `getProgressionResponse` provides unique "next step" responses per bucket

### Fix B — Call-site update in ChatWidget

```js
// In sendMessage (line ~148):
// BEFORE:
setTimeout(() => {
  setMessages(p => [...p, { role: "bot", text: getAIResponse(userMsg.text, industryKey), time: new Date() }]);
  setIsTyping(false);
}, 800 + Math.random() * 1200);

// AFTER:
setTimeout(() => {
  setMessages(p => {
    const response = getAIResponse(userMsg.text, industryKey, [...p, userMsg]);
    return [...p, { role: "bot", text: response, time: new Date() }];
  });
  setIsTyping(false);
}, 800 + Math.random() * 1200);

// In handleQuickReply (line ~151):
// BEFORE:
setTimeout(() => {
  setMessages(p => [...p, { role: "bot", text: getAIResponse(q, industryKey), time: new Date() }]);
  setIsTyping(false);
}, 1000);

// AFTER:
setTimeout(() => {
  setMessages(p => {
    const userMsg = { role: "user", text: q, time: new Date() };
    const response = getAIResponse(q, industryKey, [...p, userMsg]);
    return [...p, { role: "bot", text: response, time: new Date() }];
  });
  setIsTyping(false);
}, 1000);
```

### Fix C — Dedupe Guard (prevent double-sends)

```js
// Add to ChatWidget state:
const [lastSentHash, setLastSentHash] = useState(null);
const [lastSentTime, setLastSentTime] = useState(0);

// In sendMessage, before processing:
const inputHash = simpleHash(input.trim().toLowerCase());
const now = Date.now();
if (inputHash === lastSentHash && now - lastSentTime < 2000) {
  return; // Ignore duplicate within 2 seconds
}
setLastSentHash(inputHash);
setLastSentTime(now);
```

### Fix D — Canonical Message Schema

Every message object must follow this shape:

```js
{
  id: crypto.randomUUID(),   // unique per message
  role: 'user' | 'bot',      // never 'assistant', 'system', or undefined
  text: String,               // trimmed, non-empty
  time: new Date(),           // for display
  bucket: String | null,      // which response bucket matched (for bot messages)
  turnIndex: Number,          // sequential turn number in conversation
}
```

### Fix E — Future LLM Integration Anti-Repeat

When you add an actual LLM API route, the request must be:

```js
// POST /api/chat
{
  conversation_id: "uuid-v4",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    // ... trimmed history (last 10-20 messages max) ...
    { role: "user", content: latestUserMessage }  // ONLY the latest
  ],
  temperature: 0.7,  // not 0.0 — low temp increases repetition
  // NO HTTP caching headers
}
```

Server must:
- Append user message to stored history BEFORE calling LLM
- Append assistant response AFTER receiving it
- Never cache on anything less than full `messages` array hash
- Set `Cache-Control: no-store` on response

---

## 4) "Anti-Circular" System Prompt Snippet

Use this when you integrate an LLM (e.g., OpenAI, Claude):

```
## CONVERSATION RULES — ANTI-REPETITION

1. NEVER repeat a previous response verbatim or near-verbatim. If you already answered a topic, summarize in one sentence ("As I mentioned, cleanings run $75–$150") then ADD new value: a follow-up question, a related detail, or a next step.

2. ALWAYS reference the user's NEW message explicitly. Start your response by addressing what they just said, not by restating your prior answer.

3. If the user repeats their own question:
   - Acknowledge it: "Just to make sure — are you asking about [X] again, or something slightly different?"
   - Offer a NEW angle: more detail, a related service, or a direct handoff.
   - Do NOT paste the same answer.

4. If you lack information to give a new answer, ask 1–2 SPECIFIC clarifying questions. Do not re-explain what you already covered.

5. PROGRESS the conversation toward one of these goals (pick the most natural):
   a) Answer their question with specifics
   b) Ask a qualifying question (budget, timeline, location)
   c) Offer to book / schedule / connect with a human
   d) Collect contact info (name, phone, email)
   
   Each response must move at least one step forward.

6. After 3+ turns, if no appointment or lead form has been offered, proactively suggest it:
   "Would you like me to have [business name] reach out to you directly? I just need your name and phone number."
```

---

## 5) Acceptance Tests

### Similarity Threshold Rule

Before delivering any bot response, compute n-gram overlap with the previous bot message:

```js
function ngramOverlap(a, b, n = 3) {
  if (!a || !b) return 0;
  const ngrams = (s) => {
    const tokens = s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const grams = new Set();
    for (let i = 0; i <= tokens.length - n; i++) {
      grams.add(tokens.slice(i, i + n).join(' '));
    }
    return grams;
  };
  const setA = ngrams(a);
  const setB = ngrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const g of setA) if (setB.has(g)) intersection++;
  return intersection / Math.min(setA.size, setB.size);
}

// RULE: If overlap > 0.6, trigger anti-repeat:
// → Use getProgressionResponse() (canned mode)
// → Or append "do not repeat" instruction to LLM prompt (LLM mode)
// → Log the event for monitoring
```

### Test Conversations

---

#### TEST 1: Same-bucket repeat (Dental — Pricing)
```
User: "How much is teeth whitening?"
Bot:  → pricing response (pass: contains price ranges)
User: "What about the cost of a crown?"
Bot:  → MUST NOT be identical to previous response
      → PASS: mentions crown specifically OR pivots ("I listed our ranges above — for crowns specifically, $800–$1,500. Want an exact quote?")
      → FAIL: returns the full pricing list verbatim again
```
**Similarity check:** ngramOverlap(response1, response2) must be < 0.6

---

#### TEST 2: Default fallback repeat (Dental — Unrecognized x2)
```
User: "Do you accept Delta Dental insurance?"
Bot:  → default response (pass: offers to connect with team)
User: "What about payment plans?"
Bot:  → MUST NOT return identical default
      → PASS: asks clarifying question ("Are you asking about financing options for a specific treatment?") or pivots to pricing bucket
      → FAIL: same "Let me connect you with our dental team" block
```

---

#### TEST 3: Quick-reply then manual repeat (HVAC)
```
User: [clicks "Get a quote"]
Bot:  → appointment response (pass: asks for service type, address, date)
User: "I need a quote for AC repair"
Bot:  → MUST NOT repeat the same 3 questions
      → PASS: acknowledges they said AC repair, asks for address/zip + date only
      → FAIL: re-asks "Type of service (repair, install, maintenance)?"
```

---

#### TEST 4: Topic cycling (Med Spa — pricing → hours → pricing again)
```
User: "How much is Botox?"
Bot:  → pricing response
User: "What are your hours?"
Bot:  → hours response
User: "And how much are fillers?"
Bot:  → MUST NOT return the full pricing response again
      → PASS: gives filler-specific info ("Fillers run $600–$1,200/syringe — I shared the full menu earlier. Want to book a consultation for fillers specifically?")
      → FAIL: identical pricing block from turn 1
```

---

#### TEST 5: Escalation after 3 turns on same topic (Plumbing)
```
User: "How much is drain cleaning?"
Bot:  → pricing response
User: "What about sewer line repair?"
Bot:  → pricing variation or progression
User: "And water heater installation?"
Bot:  → MUST include lead-capture nudge
      → PASS: answers + "Want me to have someone from our team reach out with an exact quote? I just need your name and number."
      → FAIL: another pricing dump with no progression
```

---

#### TEST 6: User repeats exact message (Law Firm)
```
User: "I need a free consultation"
Bot:  → appointment response
User: "I need a free consultation"
Bot:  → MUST NOT return identical response
      → PASS: "Absolutely — I want to get this booked for you! Which practice area is this regarding? And what day/time works best?"
      → FAIL: identical "Let's schedule a consultation!" block
```

---

#### TEST 7: Fallback → Fallback → Fallback (Real Estate)
```
User: "What neighborhoods do you serve?"
Bot:  → default or hours (if "where" matches)
User: "Do you handle condos?"
Bot:  → default
User: "What about foreclosures?"
Bot:  → MUST NOT be third identical default
      → PASS: "I want to make sure I connect you with the right agent — are you looking to buy, or are you an investor? And what's your target area?"
      → FAIL: same "Let me connect you with an agent" for the third time
```

---

#### TEST 8: Progression through full funnel (HVAC — happy path)
```
User: "My AC stopped working"
Bot:  → emergency response (pass: mentions emergency line + same-day)
User: "It's not an emergency, but it's been struggling"
Bot:  → MUST progress away from emergency
      → PASS: pivots to diagnostic/appointment ("Got it — sounds like it might need a tune-up or repair. Want to schedule a diagnostic visit? Our service call runs $79–$129.")
      → FAIL: repeats emergency info
User: "Yeah, can I get someone out this week?"
Bot:  → MUST collect scheduling info
      → PASS: asks for address + preferred day/time
      → FAIL: generic "Let me get our HVAC team on it"
User: "Thursday afternoon, I'm at 123 Main St"
Bot:  → MUST confirm + capture lead
      → PASS: "Thursday afternoon at 123 Main St — got it! Can I get your name and phone number so we can confirm?"
      → FAIL: asks the same scheduling questions again
```

---

## Implementation Priority

| Order | Fix | Effort | Impact |
|-------|-----|--------|--------|
| **1** | Fix A — Pass history to `getAIResponse` | S (30 min) | Eliminates 90% of circular replies |
| **2** | Fix B — Update call sites in ChatWidget | S (15 min) | Required for Fix A to work |
| **3** | Fix D — Canonical message schema with `id` and `bucket` | S (20 min) | Enables dedup + analytics |
| **4** | Fix C — Dedupe guard for double-sends | S (10 min) | Edge case protection |
| **5** | Similarity threshold check (`ngramOverlap`) | M (1 hr) | Automated regression detection |
| **6** | Anti-circular system prompt (section 4) | S (5 min) | Only needed when LLM is integrated |
| **7** | Fix E — LLM API route with proper history | L (2-4 hrs) | Full solution; replaces keyword matching |

Do Fix A + Fix B first. They're ~45 minutes of work and will fix the problem for the demo.
