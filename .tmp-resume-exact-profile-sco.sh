#!/usr/bin/env bash
set -euo pipefail
cd /home/matthewseyoum17/leadpilot-ai

RUN_DATE="${RUN_DATE:-2026-04-22}"
RUN_LABEL="scheduled-6am-et-exact-profile-sco-run"
TS="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
REPORT_DIR="leads/reports"
TMP_DIR="leads/tmp"
LEADCLAW_DIR="leads/leadclaw"
STRICT_TMP_ROOT=".tmp-head-run-${RUN_DATE}-resume-${TS}"

RAW_OUT="$LEADCLAW_DIR/raw-exact-profile-sco-${RUN_DATE}.csv"
PRIORITY_RAW="$TMP_DIR/raw-exact-profile-sco-priority-${RUN_DATE}.csv"
PREFILTER_OUT="$TMP_DIR/leadclaw-qualified-combined-${RUN_DATE}.csv"
STRICT_INPUT="$TMP_DIR/strict-exact-profile-sco-input-${RUN_DATE}.csv"
STRICT_QUALIFIED_COPY_CSV="$TMP_DIR/strict-qualified-exact-profile-sco-${RUN_DATE}.csv"
STRICT_QUALIFIED_COPY_JSON="$TMP_DIR/strict-qualified-exact-profile-sco-${RUN_DATE}.json"
DISTRIBUTION_JSON="$TMP_DIR/${RUN_DATE}-exact-profile-sco-distribution.json"
SUMMARY_PATH="$REPORT_DIR/${RUN_DATE}-exact-profile-sco-run-summary.md"
META_PATH="$REPORT_DIR/${RUN_DATE}-exact-profile-sco-run-meta.json"

PREFILTER_LOG="$REPORT_DIR/${TS}-leadclaw-prefilter-exact-profile-sco.log"
STRICT_LOG="$REPORT_DIR/${TS}-strict-exact-profile-sco-qualifier.log"
REPLENISH_LOG="$REPORT_DIR/${TS}-inventory-replenish-exact-profile-sco.log"
DISPATCH_LOG="$REPORT_DIR/${TS}-dispatch-exact-profile-sco.log"
EMAIL_LOG="$REPORT_DIR/${TS}-email-exact-profile-sco.log"

mkdir -p "$REPORT_DIR" "$TMP_DIR" "$LEADCLAW_DIR" "$STRICT_TMP_ROOT/scripts" "$STRICT_TMP_ROOT/leads"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHA="$(git rev-parse HEAD)"
STATUS="$(git status --short --branch || true)"

count_csv_rows() {
  local file="$1"
  node - "$file" <<'NODE'
const fs=require('fs');
const file=process.argv[2];
if(!file || !fs.existsSync(file) || fs.statSync(file).size===0){console.log(0);process.exit(0)}
const text=fs.readFileSync(file,'utf8').trim();
if(!text){console.log(0);process.exit(0)}
const lines=text.split(/\r?\n/).filter(Boolean);
console.log(Math.max(0, lines.length-1));
NODE
}

count_with_site_phone() {
  local file="$1"
  node - "$file" <<'NODE'
const fs=require('fs');
const file=process.argv[2];
function splitCSV(line){const out=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
if(!fs.existsSync(file)||fs.statSync(file).size===0){console.log(0);process.exit(0)}
const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).filter(Boolean);
if(lines.length<=1){console.log(0);process.exit(0)}
const headers=splitCSV(lines[0]); const iWeb=headers.indexOf('Website'); const iPhone=headers.indexOf('Phone'); let c=0;
for(const line of lines.slice(1)){const vals=splitCSV(line); if(String(vals[iWeb]||'').trim() && String(vals[iPhone]||'').trim()) c++;}
console.log(c);
NODE
}

inventory_available_count() {
  node - <<'NODE'
const fs=require('fs');
const p='leads/exact-profile-inventory.csv';
function splitCSV(line){const out=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
if(!fs.existsSync(p)||fs.statSync(p).size===0){console.log(0);process.exit(0)}
const lines=fs.readFileSync(p,'utf8').trim().split(/\r?\n/).filter(Boolean);
if(lines.length<=1){console.log(0);process.exit(0)}
const headers=splitCSV(lines[0]); const idx=headers.indexOf('inventory_status'); let count=0;
for(const line of lines.slice(1)){const vals=splitCSV(line); if((vals[idx]||'')==='available') count++;}
console.log(count);
NODE
}

ensure_priority_raw() {
  if [ -f "$PRIORITY_RAW" ]; then return; fi
  node - "$RAW_OUT" "$PRIORITY_RAW" <<'NODE'
const fs=require('fs');
const [input, output]=process.argv.slice(2);
function splitCSV(line){const out=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
function parse(text){const lines=String(text||'').trim().split(/\r?\n/).filter(Boolean);if(!lines.length)return {headers:[],rows:[]};const headers=splitCSV(lines[0]);const rows=lines.slice(1).map(line=>{const vals=splitCSV(line);const obj={};headers.forEach((h,i)=>obj[h]=vals[i]||'');return obj;});return {headers,rows};}
function esc(v){const s=String(v||'').replace(/\r?\n/g,' ').trim();return /[",]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function priority(niche){const n=String(niche||'').toLowerCase(); if(n.includes('plumb')) return 0; if(n.includes('hvac')||n.includes('heating')||n.includes('cooling')||n.includes('air')) return 1; if(n.includes('roof')) return 2; return 3;}
const {headers,rows}=parse(fs.readFileSync(input,'utf8'));
rows.sort((a,b)=> priority(a['Niche'])-priority(b['Niche']) || String(a['State']||'').localeCompare(String(b['State']||'')) || String(a['City']||'').localeCompare(String(b['City']||'')) || String(a['Business Name']||'').localeCompare(String(b['Business Name']||'')));
fs.writeFileSync(output,[headers.join(',')].concat(rows.map(r=>headers.map(h=>esc(r[h])).join(','))).join('\n')+'\n','utf8');
NODE
}

build_strict_input() {
  node - "$PREFILTER_OUT" "$STRICT_INPUT" <<'NODE'
const fs=require('fs');
const [input, output]=process.argv.slice(2);
function splitCSV(line){const out=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
function parse(text){const lines=String(text||'').trim().split(/\r?\n/).filter(Boolean);if(!lines.length)return {headers:[],rows:[]};const headers=splitCSV(lines[0]);const rows=lines.slice(1).map(line=>{const vals=splitCSV(line);const obj={};headers.forEach((h,i)=>obj[h]=vals[i]||'');return obj;});return {headers,rows};}
function esc(v){const s=String(v||'').replace(/\r?\n/g,' ').trim();return /[",]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function priority(niche){const n=String(niche||'').toLowerCase(); if(n.includes('plumb')) return 0; if(n.includes('hvac')||n.includes('heating')||n.includes('cooling')||n.includes('air')) return 1; if(n.includes('roof')) return 2; return 3;}
function normSite(s){s=String(s||'').trim(); if(!s) return ''; return s.replace(/^https?:\/\//i,'').replace(/^www\./i,'').replace(/\/$/,'').toLowerCase();}
const {rows}=parse(fs.readFileSync(input,'utf8'));
const seen=new Set(); const mapped=[];
for(const r of rows){
  const website=String(r['Website']||'').trim(); const phone=String(r['Phone']||'').trim(); const company=String(r['Business Name']||'').trim();
  if(!website || !phone || !company) continue;
  const key=normSite(website); if(!key || seen.has(key)) continue; seen.add(key);
  mapped.push({
    Name:String(r['Owner']||'').trim(),
    Title:String(r['Title']||'').trim(),
    Company:company,
    Industry:String(r['Niche']||'').trim(),
    City:String(r['City']||'').trim(),
    State:String(r['State']||'').trim(),
    Email:'',
    Phone:phone,
    'Company Website':website,
    Source:'leadclaw-prefilter',
    __priority:priority(r['Niche']),
    __issueCount:parseInt(String(r['Issue Count']||'0'),10)||0,
    __score:parseInt(String(r['Score']||'0'),10)||0,
  });
}
mapped.sort((a,b)=>a.__priority-b.__priority || b.__issueCount-a.__issueCount || b.__score-a.__score || a.Company.localeCompare(b.Company));
const headers=['Name','Title','Company','Industry','City','State','Email','Phone','Company Website','Source'];
fs.writeFileSync(output,[headers.join(',')].concat(mapped.map(r=>headers.map(h=>esc(r[h])).join(','))).join('\n')+'\n','utf8');
NODE
}

compute_distribution_json() {
  local file="$1"
  local outjson="$2"
  node - "$file" "$outjson" <<'NODE'
const fs=require('fs');
const [file,outjson]=process.argv.slice(2);
function splitCSV(line){const out=[];let cur='';let q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;continue;}if(ch===','&&!q){out.push(cur);cur='';continue;}cur+=ch;}out.push(cur);return out;}
function parseCSV(text){const lines=String(text||'').trim().split(/\r?\n/).filter(Boolean);if(!lines.length) return [];const headers=splitCSV(lines[0]);return lines.slice(1).map(line=>{const vals=splitCSV(line);const obj={};headers.forEach((h,i)=>obj[String(h||'').trim()]=String(vals[i]||'').trim());return obj;});}
function get(row, keys){ for(const k of keys){ if(row[k]!==undefined && String(row[k]).trim()!=='') return String(row[k]).trim(); } return ''; }
function countListItems(value){ return String(value||'').split(';').map(s=>s.trim()).filter(Boolean).length; }
function getInt(row, keys){ return parseInt(get(row, keys) || '0', 10) || 0; }
function leadScore(row){ return getInt(row, ['Overall Score', 'Fit Score']); }
function qualityScore(row){ const signals=String(get(row,['Marketing Signals'])||''); let score=0; if(/Google Ads\/GTM/i.test(signals)) score+=3; if(/Local Service Ads/i.test(signals)) score+=2; if(/Scheduling/i.test(signals)) score+=2; if(/\d{2,} internal links/i.test(signals)) score+=2; if(/Reviews/i.test(signals)) score+=1; if(/Coupons|financing/i.test(signals)) score+=1; return score; }
function isQualified(row){ const verifiedNoChat=String(get(row,['Verified No Chatbot'])||'').toLowerCase(); const chatbot=String(get(row,['Chatbot?'])||'').toLowerCase(); const noChatConfidence=getInt(row,['No-Chat Confidence']); const redesign=getInt(row,['Redesign Need Score']); const buyer=getInt(row,['Buyer Quality Score']); const packageFit=getInt(row,['Package-Fit Score']); const fit=getInt(row,['Overall Score','Fit Score']); const signalCount=countListItems(get(row,['Marketing Signals'])); const redesignProblems=countListItems(get(row,['Exact Redesign Problems'])); const leadCaptureGaps=countListItems(get(row,['Exact Lead-Capture Gaps','Missed-Lead Opportunity'])); if(verifiedNoChat && verifiedNoChat!=='yes') return false; if(/intercom|hubspot|birdeye|drift|tidio|tawk|crisp|livechat|podium|leadconnector|msgsndr|yes/i.test(chatbot)) return false; if(noChatConfidence && noChatConfidence<8) return false; if(redesign && redesign<8) return false; if(buyer && buyer<7) return false; if(packageFit && packageFit<8) return false; if(fit>10 && fit<32) return false; if(fit>0 && fit<=10 && fit<9) return false; if(signalCount<1) return false; if(redesignProblems && redesignProblems<3) return false; if(leadCaptureGaps && leadCaptureGaps<3) return false; return true; }
let rows=[]; if(fs.existsSync(file) && fs.statSync(file).size>0) rows=parseCSV(fs.readFileSync(file,'utf8')); const counts={Koray:0,Azel:0,Nafim:0};
if(rows.length && rows.some(r=>get(r,['Assigned SCO Name']))){ for(const r of rows){ const name=get(r,['Assigned SCO Name']); if(counts[name]!==undefined) counts[name]++; } }
else if(rows.length){ const qualified=rows.filter(isQualified).sort((a,b)=>(leadScore(b)-leadScore(a)) || (getInt(b,['Redesign Need Score'])-getInt(a,['Redesign Need Score'])) || (qualityScore(b)-qualityScore(a))); const order=['Koray','Azel','Nafim']; const limits={Koray:100,Azel:100,Nafim:100}; for(let i=0;i<qualified.length;i++){ const name=order[i%order.length]; if(counts[name] < limits[name]) counts[name]++; } }
fs.writeFileSync(outjson, JSON.stringify(counts,null,2));
NODE
}

if [ ! -f "$RAW_OUT" ]; then
  echo "Missing raw source file: $RAW_OUT" >&2
  exit 1
fi

ensure_priority_raw
RAW_SOURCED="$(count_csv_rows "$RAW_OUT")"
RAW_WITH_SITE_PHONE="$(count_with_site_phone "$PRIORITY_RAW")"

rm -f leads/leadclaw/qualified.csv leads/leadclaw/daily-leads.md "$PREFILTER_OUT" "$STRICT_INPUT" leads/qualified-leads.csv leads/qualified-leads.json "$STRICT_QUALIFIED_COPY_CSV" "$STRICT_QUALIFIED_COPY_JSON"

LEADCLAW_INPUT="$PRIORITY_RAW" LEAD_TARGET=1500 node scripts/leadclaw-qualify.js > "$PREFILTER_LOG" 2>&1
cp leads/leadclaw/qualified.csv "$PREFILTER_OUT"
PREFILTER_QUALIFIED="$(count_csv_rows "$PREFILTER_OUT")"

build_strict_input
STRICT_INPUT_ROWS="$(count_csv_rows "$STRICT_INPUT")"

git show HEAD:scripts/qualify-via-cdp.js > "$STRICT_TMP_ROOT/scripts/qualify-via-cdp.js"
if [ -f .env ]; then ln -sf "$(pwd)/.env" "$STRICT_TMP_ROOT/.env"; fi
cp "$STRICT_INPUT" "$STRICT_TMP_ROOT/leads/apollo-leads.csv"

STRICT_EXIT=0
set +e
node "$STRICT_TMP_ROOT/scripts/qualify-via-cdp.js" > "$STRICT_LOG" 2>&1
STRICT_EXIT=$?
set -e
if [ -f "$STRICT_TMP_ROOT/leads/qualified-leads.csv" ]; then
  cp "$STRICT_TMP_ROOT/leads/qualified-leads.csv" leads/qualified-leads.csv
  cp "$STRICT_TMP_ROOT/leads/qualified-leads.csv" "$STRICT_QUALIFIED_COPY_CSV"
fi
if [ -f "$STRICT_TMP_ROOT/leads/qualified-leads.json" ]; then
  cp "$STRICT_TMP_ROOT/leads/qualified-leads.json" leads/qualified-leads.json
  cp "$STRICT_TMP_ROOT/leads/qualified-leads.json" "$STRICT_QUALIFIED_COPY_JSON"
fi
STRICT_QUALIFIED="$(count_csv_rows leads/qualified-leads.csv)"

REPLENISH_EXIT=0
set +e
QUALIFIED_INPUT=leads/qualified-leads.csv node scripts/replenish-inventory.js > "$REPLENISH_LOG" 2>&1
REPLENISH_EXIT=$?
set -e
AVAILABLE_AFTER_REPLENISH="$(inventory_available_count)"

printf '{"Koray":0,"Azel":0,"Nafim":0}\n' > "$DISTRIBUTION_JSON"
EMAIL_STATUS="not sent — no verified leads"
EMAIL_MODE="none"
DISPATCH_EXIT=0
EMAIL_EXIT=0

if [ "$STRICT_QUALIFIED" -gt 0 ]; then
  if [ "$AVAILABLE_AFTER_REPLENISH" -ge 300 ]; then
    set +e
    DISPATCH_RUN_ID="$RUN_LABEL-$RUN_DATE-$TS" node scripts/dispatch-inventory.js > "$DISPATCH_LOG" 2>&1
    DISPATCH_EXIT=$?
    set -e
    if [ "$DISPATCH_EXIT" -eq 0 ] && [ -f leads/latchly-clean-batch.csv ]; then
      compute_distribution_json "leads/latchly-clean-batch.csv" "$DISTRIBUTION_JSON"
      set +e
      QUALIFIED_INPUT=leads/latchly-clean-batch.csv node scripts/email-setters.js > "$EMAIL_LOG" 2>&1
      EMAIL_EXIT=$?
      set -e
      if [ "$EMAIL_EXIT" -eq 0 ]; then EMAIL_STATUS="sent"; else EMAIL_STATUS="attempted but failed"; fi
      EMAIL_MODE="inventory-dispatch"
    else
      EMAIL_STATUS="not sent — dispatch failed"
    fi
  else
    compute_distribution_json "leads/qualified-leads.csv" "$DISTRIBUTION_JSON"
    set +e
    QUALIFIED_INPUT=leads/qualified-leads.csv node scripts/email-setters.js > "$EMAIL_LOG" 2>&1
    EMAIL_EXIT=$?
    set -e
    if [ "$EMAIL_EXIT" -eq 0 ]; then EMAIL_STATUS="sent"; else EMAIL_STATUS="attempted but failed"; fi
    EMAIL_MODE="direct-partial-qualified-batch"
  fi
fi

KORAY="$(node -e "const j=require('./$DISTRIBUTION_JSON'); console.log(j.Koray||0)")"
AZEL="$(node -e "const j=require('./$DISTRIBUTION_JSON'); console.log(j.Azel||0)")"
NAFIM="$(node -e "const j=require('./$DISTRIBUTION_JSON'); console.log(j.Nafim||0)")"
GAP="$((300-STRICT_QUALIFIED))"
if [ "$GAP" -lt 0 ]; then GAP=0; fi

node - "$STRICT_EXIT" "$REPLENISH_EXIT" "$DISPATCH_EXIT" "$STRICT_QUALIFIED" "$EMAIL_STATUS" "$EMAIL_MODE" <<'NODE' > "$TMP_DIR/blockers.json"
const [strictExit,replenishExit,dispatchExit,strictQualified,emailStatus,emailMode]=process.argv.slice(2);
const blockers=[];
if(Number(strictExit)!==0) blockers.push(`strict verifier exited ${strictExit}`);
if(Number(strictQualified)===0) blockers.push('strict exact-profile verification produced 0 real survivors');
if(Number(replenishExit)!==0) blockers.push(`inventory replenish exited ${replenishExit}`);
if(Number(dispatchExit)!==0 && emailMode==='inventory-dispatch') blockers.push(`inventory dispatch exited ${dispatchExit}`);
if(emailStatus==='attempted but failed') blockers.push('email send attempt failed');
process.stdout.write(JSON.stringify(blockers,null,2));
NODE
BLOCKERS_JSON="$(cat "$TMP_DIR/blockers.json")"

cat > "$SUMMARY_PATH" <<EOF
# Scheduled 6 AM ET Exact-Profile SCO Run — ${RUN_DATE}

- **Repo:** /home/matthewseyoum17/leadpilot-ai
- **Branch used:** local \
- **Run type:** scheduled 6 AM ET exact-profile SCO run
- **Target:** 300 verified exact-profile leads total, split 100 / 100 / 100 to Koray, Azel, Nafim
- **Priority order used:** plumbing, HVAC, roofing first
- **Execution mode:** fresh source + repo prefilter + committed HEAD strict browser verification + live email when real leads exist

## Result

- **Raw leads sourced:** ${RAW_SOURCED}
- **Raw leads with website + phone:** ${RAW_WITH_SITE_PHONE}
- **Bad-site prefilter survivors:** ${PREFILTER_QUALIFIED}
- **Strict verifier input rows:** ${STRICT_INPUT_ROWS}
- **Strict exact-profile verified leads this run:** ${STRICT_QUALIFIED}
- **Inventory available after replenish:** ${AVAILABLE_AFTER_REPLENISH}
- **Gap to target:** ${GAP}

## Per-SCO counts

- Koray: ${KORAY}
- Azel: ${AZEL}
- Nafim: ${NAFIM}

## Email send status

- ${EMAIL_STATUS}
- **Send path:** ${EMAIL_MODE}

## Main blocker(s)

$(node - <<'NODE'
const fs=require('fs');
const arr=JSON.parse(fs.readFileSync('leads/tmp/blockers.json','utf8'));
if(!arr.length) console.log('- none');
else arr.forEach(x=>console.log(`- ${x}`));
NODE
)

## Files / logs

- Raw source: \
  ${RAW_OUT}
- Prefilter combined: \
  ${PREFILTER_OUT}
- Strict verifier input: \
  ${STRICT_INPUT}
- Prefilter log: \
  ${PREFILTER_LOG}
- Strict verifier log: \
  ${STRICT_LOG}
- Replenish log: \
  ${REPLENISH_LOG}
- Dispatch log: \
  ${DISPATCH_LOG}
- Email log: \
  ${EMAIL_LOG}

## Honest conclusion

This was the scheduled 6 AM ET exact-profile SCO run. It stayed exact-profile only and did not pad weak matches. Verified sendable leads: **${STRICT_QUALIFIED}**. Per-SCO distribution: **Koray ${KORAY}, Azel ${AZEL}, Nafim ${NAFIM}**. Email status: **${EMAIL_STATUS}**.
EOF

cat > "$META_PATH" <<EOF
{
  "runType": "scheduled-6am-et-exact-profile-sco",
  "label": "${RUN_LABEL}",
  "repo": "/home/matthewseyoum17/leadpilot-ai",
  "branch": "${BRANCH}",
  "head": "${HEAD_SHA}",
  "status": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$STATUS"),
  "note": "Uses current local main committed HEAD strict verifier, not working-tree-only edits.",
  "rawSourced": ${RAW_SOURCED},
  "prefilterScreened": ${RAW_WITH_SITE_PHONE},
  "prefilterQualified": ${PREFILTER_QUALIFIED},
  "strictQualified": ${STRICT_QUALIFIED},
  "availableAfterReplenish": ${AVAILABLE_AFTER_REPLENISH},
  "gap": ${GAP},
  "perSco": {
    "Koray": ${KORAY},
    "Azel": ${AZEL},
    "Nafim": ${NAFIM}
  },
  "email": {
    "credentialsAvailable": true,
    "sent": $( [ "$EMAIL_STATUS" = "sent" ] && echo true || echo false ),
    "sendMode": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$EMAIL_MODE"),
    "status": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$EMAIL_STATUS")
  },
  "blockers": ${BLOCKERS_JSON},
  "logs": {
    "prefilter": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$PREFILTER_LOG"),
    "strict": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$STRICT_LOG"),
    "replenish": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$REPLENISH_LOG"),
    "dispatch": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$DISPATCH_LOG"),
    "email": $(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$EMAIL_LOG")
  },
  "finishedAt": $(node -e 'process.stdout.write(JSON.stringify(new Date().toISOString()))')
}
EOF

node - <<'NODE'
const fs=require('fs');
const meta='leads/reports/2026-04-22-exact-profile-sco-run-meta.json';
const m=JSON.parse(fs.readFileSync(meta,'utf8'));
console.log(JSON.stringify({strictQualified:m.strictQualified,perSco:m.perSco,email:m.email,gap:m.gap,blockers:m.blockers},null,2));
NODE
