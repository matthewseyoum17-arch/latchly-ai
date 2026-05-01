/**
 * Latchly chat widget generator.
 * Same logic across all families, visual style parameterized.
 *
 * @param {object} lead - Lead data
 * @param {object} style - Widget style config
 * @param {string[]} quickReplies - Quick reply buttons
 * @param {string[]} serviceOptions - For booking form
 * @returns {string} Complete HTML+CSS+JS for the widget
 */
const { escHtml } = require('./utils');

function generateWidget(lead, style, quickReplies, serviceOptions) {
  const biz = escHtml(lead.business_name);
  const phone = escHtml(lead.phone || '(555) 000-0000');
  const emoji = style.emoji || '🔧';
  const s = style; // shorthand

  return `
<!-- ===== LATCHLY AI CHAT WIDGET ===== -->
<style>
#lw{position:fixed;bottom:${s.fabBottom || '24px'};right:${s.fabRight || '24px'};z-index:9999;font-family:${s.bodyFont || "'DM Sans',sans-serif"};}
#lw-fab{width:${s.fabSize || '52px'};height:${s.fabSize || '52px'};border-radius:${s.fabRadius || '14px'};cursor:pointer;border:none;background:${s.fabBg || '#0a0f1c'};color:#fff;box-shadow:${s.fabShadow || '0 4px 20px rgba(15,23,42,.35)'};display:flex;align-items:center;justify-content:center;position:relative;transition:transform .2s,box-shadow .2s;}
#lw-fab:hover{transform:scale(1.06);box-shadow:0 8px 28px rgba(15,23,42,.45);}
#lw-fab svg{width:22px;height:22px;}
#lw-fab-badge{position:absolute;top:-3px;right:-3px;width:16px;height:16px;background:#ef4444;border-radius:50%;border:2px solid #fff;font-size:9px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;}
#lw-nudge{position:absolute;bottom:68px;right:0;width:240px;background:#fff;border-radius:${s.panelRadius || '16px'};box-shadow:0 8px 30px rgba(0,0,0,.12);border:1px solid #e2e8f0;padding:14px 16px;cursor:pointer;opacity:0;transform:translateY(8px) scale(.95);pointer-events:none;transition:opacity .3s,transform .3s;}
#lw-nudge.show{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}
#lw-nudge p{margin:0;font-size:13px;color:#334155;line-height:1.5;padding-right:16px;}
#lw-nudge b{color:#0f172a;}
#lw-nudge-x{position:absolute;top:6px;right:8px;background:#f1f5f9;border:none;cursor:pointer;width:18px;height:18px;border-radius:50%;font-size:10px;color:#94a3b8;display:flex;align-items:center;justify-content:center;line-height:1;}
#lw-nudge::after{content:'';position:absolute;bottom:-6px;right:22px;width:12px;height:12px;background:#fff;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;transform:rotate(45deg);}
#lw-panel{position:absolute;bottom:68px;right:0;width:380px;height:600px;background:#fff;border-radius:${s.panelRadius || '16px'};box-shadow:0 20px 60px rgba(0,0,0,.18);border:1px solid #f1f5f9;display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(16px) scale(.96);pointer-events:none;transition:opacity .25s cubic-bezier(.34,1.56,.64,1),transform .3s cubic-bezier(.34,1.56,.64,1);transform-origin:bottom right;}
#lw-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:all;}
@media(max-width:440px){#lw-panel{position:fixed;inset:0;width:100%;height:100%;border-radius:0;}#lw{bottom:0;right:0;}}
#lw-head{background:${s.headBg || 'linear-gradient(135deg,#0a0f1c,#182438)'};color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;${s.headExtra || ''}}
#lw-head-emoji{width:40px;height:40px;border-radius:${s.emojiRadius || '12px'};background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
#lw-head-name{font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:14px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#lw-head-status{font-size:11px;opacity:.85;margin:2px 0 0;display:flex;align-items:center;gap:6px;}
#lw-head-status .dot{width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;flex-shrink:0;}
#lw-close{background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}
#lw-close:hover{background:rgba(255,255,255,.25);}
#lw-messages{flex:1;overflow-y:auto;padding:16px;background:${s.chatBg || '#f8fafc'};display:flex;flex-direction:column;gap:10px;}
.lw-msg{display:flex;gap:8px;max-width:88%;animation:lw-fadeIn .25s ease;}
.lw-msg-bot{align-self:flex-start;}.lw-msg-user{align-self:flex-end;flex-direction:row-reverse;}
.lw-msg-avatar{width:28px;height:28px;border-radius:50%;flex-shrink:0;margin-top:2px;background:${s.avatarBg || 'linear-gradient(135deg,#0a0f1c,#182438)'};display:flex;align-items:center;justify-content:center;font-size:12px;}
.lw-msg-user .lw-msg-avatar{display:none;}
.lw-msg-text{padding:10px 14px;font-size:13.5px;line-height:1.55;white-space:pre-line;}
.lw-msg-bot .lw-msg-text{background:#fff;color:#334155;border-radius:${s.msgBotRadius || '4px 16px 16px 16px'};box-shadow:0 1px 3px rgba(0,0,0,.06);}
.lw-msg-user .lw-msg-text{background:${s.userMsgBg || '#1B5FA8'};color:#fff;border-radius:${s.msgUserRadius || '16px 16px 4px 16px'};}
.lw-typing{display:flex;gap:4px;align-items:center;padding:12px 14px;}
.lw-typing span{width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:lw-bounce 1.2s ease-in-out infinite;}
.lw-typing span:nth-child(2){animation-delay:.15s;}.lw-typing span:nth-child(3){animation-delay:.3s;}
@keyframes lw-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
@keyframes lw-fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
#lw-quick{padding:4px 16px 8px;background:${s.chatBg || '#f8fafc'};display:flex;flex-wrap:wrap;gap:6px;}
.lw-qr{padding:7px 14px;border-radius:${s.qrRadius || '20px'};font-size:12px;font-weight:600;cursor:pointer;border:1px solid ${s.qrBorder || 'rgba(27,95,168,.25)'};color:${s.qrColor || '#1B5FA8'};background:${s.qrBg || 'rgba(27,95,168,.05)'};transition:background .15s,color .15s;}
.lw-qr:hover{background:${s.qrHoverBg || '#1B5FA8'};color:#fff;}
#lw-inputbar{padding:12px 16px;border-top:1px solid #f1f5f9;background:#fff;display:flex;align-items:center;gap:8px;flex-shrink:0;}
#lw-input{flex:1;border:1px solid #e2e8f0;border-radius:${s.inputRadius || '12px'};padding:10px 14px;font-size:13px;color:#0f172a;outline:none;font-family:${s.bodyFont || "'DM Sans',sans-serif"};transition:border-color .2s;}
#lw-input:focus{border-color:${s.inputFocusBorder || '#1B5FA8'};}
#lw-send{width:40px;height:40px;border-radius:${s.sendRadius || '12px'};border:none;cursor:pointer;background:${s.sendBg || '#1B5FA8'};color:#fff;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;}
#lw-send:hover{background:${s.sendHoverBg || '#134780'};}
#lw-send:disabled{background:#cbd5e1;cursor:default;}
#lw-send svg{width:16px;height:16px;}
#lw-end{padding:0 16px 8px;background:#fff;text-align:right;}
#lw-end button{background:none;border:none;font-size:10px;color:#ef4444;font-weight:600;cursor:pointer;padding:2px 0;}
#lw-end button:hover{text-decoration:underline;}
.lw-phase{display:none;flex-direction:column;flex:1;overflow:hidden;}.lw-phase.active{display:flex;}
#lw-booking-body{flex:1;overflow-y:auto;padding:20px 18px;background:${s.chatBg || '#f8fafc'};}
#lw-booking-body h3{font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:15px;color:#0f172a;margin:0 0 2px;}
.lw-field{margin-bottom:12px;}.lw-field label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px;}
.lw-field input,.lw-field select{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:${s.inputRadius || '12px'};font-size:13px;color:#0f172a;outline:none;font-family:${s.bodyFont || "'DM Sans',sans-serif"};box-sizing:border-box;transition:border-color .2s;background:#fff;}
.lw-field input:focus,.lw-field select:focus{border-color:${s.inputFocusBorder || '#1B5FA8'};box-shadow:0 0 0 3px ${s.inputFocusRing || 'rgba(27,95,168,.1)'};}
.lw-btn{width:100%;padding:12px;border:none;border-radius:${s.inputRadius || '12px'};font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:14px;color:#fff;cursor:pointer;background:${s.sendBg || '#1B5FA8'};transition:background .15s,transform .1s;margin-top:6px;}
.lw-btn:hover{background:${s.sendHoverBg || '#134780'};transform:scale(1.01);}
.lw-btn:disabled{background:#cbd5e1;cursor:default;transform:none;}
.lw-btn-outline{width:100%;padding:10px;border:none;background:none;font-size:12px;color:#64748b;font-weight:600;cursor:pointer;margin-top:6px;}
#lw-rating-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;background:${s.chatBg || '#f8fafc'};text-align:center;}
#lw-rating-body .emoji{font-size:48px;margin-bottom:16px;}
#lw-rating-body h3{font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:18px;color:#0f172a;margin:0 0 6px;}
#lw-stars{display:flex;gap:6px;margin-bottom:20px;}
#lw-stars button{background:none;border:none;cursor:pointer;padding:2px;transition:transform .15s;}
#lw-stars button svg{width:28px;height:28px;}
#lw-stars button.active svg{fill:#f59e0b;color:#f59e0b;}
#lw-stars button:not(.active) svg{fill:none;color:#cbd5e1;}
#lw-stars button.active{transform:scale(1.15);}
#lw-lead-body{flex:1;overflow-y:auto;padding:24px 18px;background:${s.chatBg || '#f8fafc'};}
#lw-lead-body h3{font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:17px;color:#0f172a;margin:0 0 4px;}
#lw-lead-body .sub{font-size:13px;color:#64748b;margin:0 0 20px;line-height:1.5;}
#lw-complete-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;background:${s.chatBg || '#f8fafc'};text-align:center;}
#lw-complete-body svg{width:56px;height:56px;color:#10b981;margin-bottom:16px;}
#lw-complete-body h3{font-family:${s.headingFont || "'Outfit',sans-serif"};font-weight:700;font-size:18px;color:#0f172a;margin:0 0 8px;}
#lw-complete-body p{font-size:13px;color:#64748b;margin:0;line-height:1.6;max-width:260px;}
#lw-footer{padding:8px 16px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;flex-shrink:0;background:#fff;}
#lw-footer a{color:${s.linkColor || '#1B5FA8'};text-decoration:none;font-weight:600;}
.lw-back-btn{display:block;width:100%;margin-top:8px;padding:10px;border:none;background:none;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;transition:color .15s;font-family:${s.bodyFont || "'DM Sans',sans-serif"};}
.lw-back-btn:hover{color:${s.linkColor || '#1B5FA8'};}
</style>

<div id="lw">
  <div id="lw-nudge">
    <button id="lw-nudge-x" aria-label="Dismiss">&times;</button>
    <p>Hi! Need help? I can answer questions about <b>${biz}</b> 24/7</p>
  </div>
  <div id="lw-panel">
    <div id="lw-head">
      <div id="lw-head-emoji">${escHtml(emoji)}</div>
      <div id="lw-head-info" style="flex:1;min-width:0;">
        <p id="lw-head-name">${biz}</p>
        <p id="lw-head-status"><span class="dot"></span> Online now · Replies instantly</p>
      </div>
      <button id="lw-close" aria-label="Close chat">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="lw-phase active" id="lw-phase-chat">
      <div id="lw-messages"></div>
      <div id="lw-quick"></div>
      <div id="lw-inputbar">
        <input id="lw-input" type="text" placeholder="Type your message..." autocomplete="off">
        <button id="lw-send" aria-label="Send"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg></button>
      </div>
      <div id="lw-end"><button id="lw-end-btn">End conversation</button></div>
    </div>
    <div class="lw-phase" id="lw-phase-rating">
      <div id="lw-rating-body">
        <div class="emoji">&#128172;</div>
        <h3>How was your experience?</h3>
        <p class="sub" style="font-size:13px;color:#64748b;margin:0 0 20px;">Your feedback helps us improve</p>
        <div id="lw-stars"></div>
        <button class="lw-btn" id="lw-rating-next" disabled style="width:auto;padding:12px 32px;">Continue</button>
        <button class="lw-back-btn" id="lw-rating-back">&#8592; Back to chat</button>
      </div>
    </div>
    <div class="lw-phase" id="lw-phase-lead">
      <div id="lw-lead-body">
        <h3>Stay connected!</h3>
        <p class="sub">Leave your info and we'll follow up personally.</p>
        <div class="lw-field"><label>Full Name *</label><input type="text" id="lw-lead-name" placeholder="John Smith"></div>
        <div class="lw-field"><label>Phone Number *</label><input type="tel" id="lw-lead-phone" placeholder="(555) 123-4567"></div>
        <div class="lw-field"><label>Email (optional)</label><input type="email" id="lw-lead-email" placeholder="john@email.com"></div>
        <button class="lw-btn" id="lw-lead-submit">Submit</button>
        <button class="lw-back-btn" id="lw-lead-back">&#8592; Back</button>
      </div>
    </div>
    <div class="lw-phase" id="lw-phase-complete">
      <div id="lw-complete-body">
        <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <h3>You're all set!</h3>
        <p>Thanks for reaching out. Our team will be in touch shortly to confirm everything.</p>
      </div>
    </div>
    <div id="lw-footer">Powered by <a href="https://latchlyai.com">Latchly</a></div>
  </div>
  <button id="lw-fab" aria-label="Open chat">
    <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z"/></svg>
    <span id="lw-fab-badge">1</span>
  </button>
</div>

<script>
(function(){
  var BIZ_NAME=${JSON.stringify(lead.business_name)};
  var BIZ_PHONE=${JSON.stringify(lead.phone||'(555) 000-0000')};
  var BIZ_SERVICES=${JSON.stringify((serviceOptions||[]).join(', '))};
  var QUICK_REPLIES=${JSON.stringify(quickReplies||['Get a Quote','Book Service','Pricing Info'])};
  var DEMO_SLUG=${JSON.stringify(lead.demo_slug || '')};
  var isOpen=false,messages=[],isTyping=false,nudgeDismissed=false;
  var fab=document.getElementById('lw-fab'),badge=document.getElementById('lw-fab-badge');
  var panel=document.getElementById('lw-panel'),closeBtn=document.getElementById('lw-close');
  var nudge=document.getElementById('lw-nudge'),nudgeX=document.getElementById('lw-nudge-x');
  var msgArea=document.getElementById('lw-messages'),quickDiv=document.getElementById('lw-quick');
  var input=document.getElementById('lw-input'),sendBtn=document.getElementById('lw-send');
  var endBtn=document.getElementById('lw-end-btn');
  function escH(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');}
  function addMsg(role,text){messages.push({role:role,text:text});var w=document.createElement('div');w.className='lw-msg lw-msg-'+role;w.innerHTML=role==='bot'?'<div class="lw-msg-avatar">${escHtml(emoji)}</div><div class="lw-msg-text">'+escH(text)+'</div>':'<div class="lw-msg-text">'+escH(text)+'</div>';msgArea.appendChild(w);msgArea.scrollTop=msgArea.scrollHeight;}
  function showTyping(){isTyping=true;sendBtn.disabled=true;var el=document.createElement('div');el.className='lw-msg lw-msg-bot';el.id='lw-typing-indicator';el.innerHTML='<div class="lw-msg-avatar">${escHtml(emoji)}</div><div class="lw-msg-text lw-typing"><span></span><span></span><span></span></div>';msgArea.appendChild(el);msgArea.scrollTop=msgArea.scrollHeight;}
  function hideTyping(){isTyping=false;sendBtn.disabled=false;var el=document.getElementById('lw-typing-indicator');if(el)el.remove();}
  function setPhase(p){document.querySelectorAll('.lw-phase').forEach(function(ph){ph.classList.remove('active');});document.getElementById('lw-phase-'+p).classList.add('active');}
  function renderQR(){quickDiv.innerHTML='';QUICK_REPLIES.forEach(function(q){var b=document.createElement('button');b.className='lw-qr';b.textContent=q;b.addEventListener('click',function(){handleMsg(q);});quickDiv.appendChild(b);});}
  function hideQR(){quickDiv.innerHTML='';}
  async function getAI(text){try{var r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:messages,businessInfo:{name:BIZ_NAME,phone:BIZ_PHONE,services:BIZ_SERVICES}})});var d=await r.json();return d.text||d.reply;}catch(e){return"Sorry, I'm having a moment! Call us at "+BIZ_PHONE;}}
  function handleMsg(text){if(!text.trim()||isTyping)return;addMsg('user',text.trim());input.value='';hideQR();showTyping();getAI(text).then(function(resp){hideTyping();addMsg('bot',resp);});}
  function openChat(){isOpen=true;panel.classList.add('open');fab.style.display='none';nudge.classList.remove('show');if(messages.length===0){setTimeout(function(){addMsg('bot',"Hi there! Welcome to "+BIZ_NAME+". I can answer questions, get you a quote, and help you book a service. How can I help?");renderQR();},400);}setTimeout(function(){input.focus();},500);}
  function closeChat(){isOpen=false;panel.classList.remove('open');fab.style.display='flex';}
  fab.addEventListener('click',openChat);
  closeBtn.addEventListener('click',closeChat);
  input.addEventListener('keydown',function(e){if(e.key==='Enter')handleMsg(input.value);});
  sendBtn.addEventListener('click',function(){handleMsg(input.value);});
  endBtn.addEventListener('click',function(){setPhase('rating');renderStars();});
  document.getElementById('lw-rating-back').addEventListener('click',function(){setPhase('chat');renderQR();});
  document.getElementById('lw-lead-back').addEventListener('click',function(){setPhase('rating');});
  function renderStars(){var c=document.getElementById('lw-stars');c.innerHTML='';for(var i=1;i<=5;i++){(function(v){var b=document.createElement('button');b.innerHTML='<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>';b.addEventListener('click',function(){c.querySelectorAll('button').forEach(function(x,idx){x.classList.toggle('active',idx<v);});document.getElementById('lw-rating-next').disabled=false;});c.appendChild(b);})(i);}}
  document.getElementById('lw-rating-next').addEventListener('click',function(){setPhase('lead');});
  document.getElementById('lw-lead-submit').addEventListener('click',function(){var n=document.getElementById('lw-lead-name').value.trim();var p=document.getElementById('lw-lead-phone').value.trim();var e=(document.getElementById('lw-lead-email')||{}).value||'';if(!n||!p)return;this.textContent='Submitting...';this.disabled=true;var stars=document.querySelectorAll('#lw-stars button.active');var r=stars?stars.length:null;if(DEMO_SLUG){fetch('/api/demo-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:DEMO_SLUG,name:n,phone:p,email:e.trim()||undefined,rating:r||undefined})}).catch(function(){});}setTimeout(function(){setPhase('complete');},800);});
  function dismissNudge(){nudge.classList.remove('show');nudgeDismissed=true;}
  nudgeX.addEventListener('click',function(e){e.stopPropagation();dismissNudge();});
  nudge.addEventListener('click',function(){dismissNudge();openChat();});
  setTimeout(function(){if(!isOpen&&!nudgeDismissed)nudge.classList.add('show');},5000);
  setTimeout(function(){if(!isOpen&&!nudgeDismissed)dismissNudge();},11000);
})();
</script>`;
}

module.exports = { generateWidget };
