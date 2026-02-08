"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const DashboardPreview = dynamic(() => import("./DashboardPreviewClient"), { ssr: false, loading: () => <div style={{ background:"#0f172a",borderRadius:20,padding:60,textAlign:"center",color:"#64748b" }}>Loading dashboard preview...</div> });

const Icons = {
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Star: ({ filled }) => <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Phone: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Shield: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Zap: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  BarChart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Globe: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  MessageSquare: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ChevronDown: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ArrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Copy: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  DollarSign: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  TrendingUp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Clock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

const INDUSTRIES = {
  dental: {
    name: "Bright Smile Dental", emoji: "🦷", label: "Dental Offices",
    quickReplies: ["Book a cleaning", "Pricing", "Hours & location", "Emergency dental"],
    heroQ: "How much is teeth whitening?", heroA: "Great question! Our teeth whitening starts at $300. Want me to book a consultation?",
    responses: {
      greeting: "Hi there! 👋 Welcome to Bright Smile Dental. I'm your virtual assistant, available 24/7. How can I help you today?",
      services: "We offer a full range of dental services:\n\n• General Dentistry (cleanings, fillings, exams)\n• Cosmetic Dentistry (veneers, whitening, bonding)\n• Orthodontics (Invisalign, traditional braces)\n• Oral Surgery (extractions, implants)\n• Pediatric Dentistry\n\nWould you like to book an appointment or get a quote?",
      pricing: "Here are our general pricing ranges:\n\n• Routine Cleaning: $75–$150\n• Teeth Whitening: $300–$600\n• Dental Implant: $1,500–$3,000\n• Invisalign: $3,500–$6,000\n• Crown: $800–$1,500\n\nMost insurance accepted! Want a personalized quote?",
      hours: "Our office hours:\n\n📅 Mon–Fri: 8:00 AM – 6:00 PM\n📅 Saturday: 9:00 AM – 2:00 PM\n📅 Sunday: Closed\n\n🚨 Dental emergencies? Call (555) 123-4567",
      appointment: "I'd love to help you book! Could you share:\n\n1. Your preferred date and time?\n2. Type of visit?\n3. First visit with us?\n\nOr I can have our team call you directly!",
      emergency: "For dental emergencies:\n\n🚨 During hours: Call (555) 123-4567\n🚨 After hours: Emergency line (555) 123-4568\n\nWe handle: severe toothache, knocked-out teeth, broken crowns, abscesses.",
      default: "Great question! Let me connect you with our dental team.\n\n• 📞 Call: (555) 123-4567\n• 📅 Book online\n• 💬 Keep chatting!\n\nWhat else can I help with?"
    }
  },
  medspa: {
    name: "Glow Aesthetics Med Spa", emoji: "💆", label: "Med Spas",
    quickReplies: ["Book a consultation", "Treatment pricing", "Hours & location", "Current specials"],
    heroQ: "How much is Botox?", heroA: "Botox starts at $10–$15 per unit! Want to book a free consultation?",
    responses: {
      greeting: "Hi there! ✨ Welcome to Glow Aesthetics. I'm your virtual assistant, available 24/7. Curious about Botox, fillers, facials, or body contouring? I'm here to help!",
      services: "We offer a full menu of aesthetic treatments:\n\n• Injectables (Botox, Dysport, dermal fillers)\n• Laser Treatments (hair removal, skin resurfacing)\n• Facials & Chemical Peels\n• Body Contouring (CoolSculpting, EmSculpt)\n• IV Therapy & Vitamin Drips\n• Microneedling & PRP\n\nWant to book a free consultation?",
      pricing: "Our popular treatment ranges:\n\n• Botox: $10–$15 per unit\n• Dermal Fillers: $600–$1,200/syringe\n• Chemical Peel: $150–$350\n• Laser Hair Removal: $150–$500/session\n• CoolSculpting: $750–$1,500/area\n\nWe offer financing! Want a personalized quote?",
      hours: "Our spa hours:\n\n📅 Mon–Fri: 9:00 AM – 7:00 PM\n📅 Saturday: 10:00 AM – 5:00 PM\n📅 Sunday: Closed\n\n✨ Evening appointments available by request!",
      appointment: "I'd love to help you book! Tell me:\n\n1. What treatment interests you?\n2. Preferred date and time?\n3. Have you visited us before?\n\nAll new clients get a complimentary consultation!",
      emergency: "For urgent skincare concerns:\n\n📞 Call us directly: (555) 234-5678\n\nIf you're experiencing a reaction to a treatment, please call immediately.\n\nFor medical emergencies, call 911.",
      default: "Great question! Let me connect you with our aesthetics team.\n\n• 📞 Call: (555) 234-5678\n• 📅 Book a free consultation\n• 💬 Keep chatting!\n\nWhat else can I help with?"
    }
  },
  hvac: {
    name: "CoolAir Heating & Cooling", emoji: "❄️", label: "HVAC Companies",
    quickReplies: ["Get a quote", "Emergency repair", "Hours & service area", "Maintenance plans"],
    heroQ: "My AC stopped working!", heroA: "Sorry to hear that! We offer same-day emergency AC repair. Want me to schedule a tech?",
    responses: {
      greeting: "Hey there! 🔧 Welcome to CoolAir Heating & Cooling. I'm available 24/7. AC not cooling? Heater acting up? Let me help!",
      services: "We handle all heating and cooling needs:\n\n• AC Repair & Installation\n• Furnace Repair & Replacement\n• Heat Pump Services\n• Duct Cleaning & Sealing\n• Preventive Maintenance Plans\n• Smart Thermostat Installation\n\nNeed a free estimate?",
      pricing: "Our typical service ranges:\n\n• Diagnostic Call: $79–$129\n• AC Repair: $150–$600\n• New AC Installed: $3,500–$7,500\n• Furnace Repair: $150–$500\n• Maintenance Plan: $149–$299/yr\n\nWant a free in-home estimate?",
      hours: "We're here when you need us:\n\n📅 Mon–Fri: 7:00 AM – 7:00 PM\n📅 Saturday: 8:00 AM – 4:00 PM\n📅 Sunday: Emergency calls only\n\n🚨 24/7 Emergency: (555) 345-6789",
      appointment: "Let's get you scheduled! I'll need:\n\n1. Type of service (repair, install, maintenance)?\n2. Your address / zip code?\n3. Preferred date and time?\n\nOr call us for same-day service!",
      emergency: "🚨 HVAC Emergency? We're here 24/7!\n\n📞 Emergency Line: (555) 345-6789\n\nNo heat? No AC? Gas smell? We dispatch technicians around the clock.\n\nCall now — most emergencies resolved same-day!",
      default: "Good question! Let me get our HVAC team on it.\n\n• 📞 Call: (555) 345-6789\n• 📅 Schedule a free estimate\n• 💬 Keep chatting!\n\nWhat else can I help with?"
    }
  },
  plumbing: {
    name: "FlowRight Plumbing", emoji: "🔧", label: "Plumbing Services",
    quickReplies: ["Get a quote", "Emergency plumbing", "Hours & service area", "Drain cleaning"],
    heroQ: "I have a leaky faucet", heroA: "We can help! Faucet repairs run $150–$350. Want a free estimate?",
    responses: {
      greeting: "Hey! 🔧 Welcome to FlowRight Plumbing. I'm your 24/7 assistant. Leaky faucet? Clogged drain? Water heater issues? Let me help!",
      services: "We handle all plumbing needs:\n\n• Drain Cleaning & Unclogging\n• Leak Detection & Repair\n• Water Heater Install & Repair\n• Sewer Line Services\n• Pipe Repair & Replacement\n• Sump Pump Services\n\nNeed a free estimate?",
      pricing: "Our common service ranges:\n\n• Service Call + Diagnosis: $49–$99\n• Drain Cleaning: $99–$250\n• Faucet Repair: $150–$350\n• Water Heater Install: $1,200–$3,000\n• Sewer Line Repair: $1,500–$4,000\n\nNo hidden fees! Want an exact quote?",
      hours: "Our service hours:\n\n📅 Mon–Fri: 7:00 AM – 6:00 PM\n📅 Saturday: 8:00 AM – 3:00 PM\n📅 Sunday: Emergency calls only\n\n🚨 24/7 Emergency: (555) 456-7890",
      appointment: "Let's get a plumber to you! I'll need:\n\n1. What's the issue?\n2. Your address?\n3. Preferred date and time?\n4. How urgent is it?\n\nSame-day service often available!",
      emergency: "🚨 Plumbing Emergency? Don't wait!\n\n📞 24/7 Emergency: (555) 456-7890\n\nBurst pipes, major leaks, sewage backup — we respond fast.\n\n⚡ Average response: 45 minutes",
      default: "Let me get our plumbing team on this.\n\n• 📞 Call: (555) 456-7890\n• 📅 Schedule a visit\n• 💬 Keep chatting!\n\nWhat else can I help with?"
    }
  },
  legal: {
    name: "Summit Legal Group", emoji: "⚖️", label: "Law Firms",
    quickReplies: ["Free consultation", "Practice areas", "Hours & location", "How billing works"],
    heroQ: "I need a free consultation", heroA: "Absolutely! All initial consultations are free and confidential. When works best for you?",
    responses: {
      greeting: "Hello! ⚖️ Welcome to Summit Legal Group. I'm your virtual assistant, available 24/7. I can help with practice areas, scheduling a free consultation, or general questions.",
      services: "Our practice areas:\n\n• Personal Injury\n• Family Law (divorce, custody, support)\n• Criminal Defense\n• Estate Planning (wills, trusts)\n• Business Law & Contracts\n• Real Estate Law\n• Employment Law\n\n📋 Free initial consultations available.",
      pricing: "Our fee structures by practice area:\n\n• Personal Injury: Contingency (no fee unless we win)\n• Family Law: $250–$450/hour\n• Criminal Defense: Flat fee or retainer\n• Estate Planning: Flat fee from $500\n• Business Law: $200–$400/hour\n\nFree initial consultation for all new clients!",
      hours: "Our office hours:\n\n📅 Mon–Fri: 8:30 AM – 5:30 PM\n📅 Saturday: By appointment\n📅 Sunday: Closed\n\n📞 After-hours? Leave a message at (555) 567-8901",
      appointment: "Let's schedule a consultation!\n\n1. Which practice area?\n2. Brief description of your situation?\n3. Preferred date and time?\n\nAll initial consultations are free and confidential.",
      emergency: "For urgent legal matters:\n\n📞 Call: (555) 567-8901\n\nArrested or served papers? Contact us immediately.\n\n⚠️ This is general info, not legal advice. For safety emergencies, call 911.",
      default: "Let me connect you with our legal team.\n\n• 📞 Call: (555) 567-8901\n• 📅 Book a free consultation\n• 💬 Keep chatting!\n\n⚠️ I provide general info, not legal advice."
    }
  },
  realestate: {
    name: "Keystone Realty", emoji: "🏠", label: "Real Estate",
    quickReplies: ["Search listings", "Home valuation", "Hours & location", "Selling my home"],
    heroQ: "What homes are available?", heroA: "I'd love to help! What area and price range are you looking in?",
    responses: {
      greeting: "Welcome! 🏠 I'm the virtual assistant for Keystone Realty, available 24/7. Buying, selling, or browsing — I'm here to help you find your next home!",
      services: "We offer full-service real estate:\n\n• Home Buying (first-time & experienced)\n• Home Selling & Listing\n• Free Home Valuations / CMA\n• Investment Property Guidance\n• Relocation Assistance\n• New Construction\n\nWant to connect with an agent?",
      pricing: "Our services:\n\n• Buyers: Free to you (seller pays commission)\n• Sellers: Competitive commission (typically 5–6%)\n• Free Home Valuation: No obligation\n• Consultation: Always free\n\nMedian home price in our area: $325K–$550K\n\nWant a free home valuation?",
      hours: "Our office hours:\n\n📅 Mon–Fri: 9:00 AM – 6:00 PM\n📅 Saturday: 10:00 AM – 4:00 PM\n📅 Sunday: Open houses only\n\n📞 Reach an agent: (555) 678-9012\nShowings available evenings & weekends!",
      appointment: "Let's get you connected!\n\n1. Buying or selling (or both)?\n2. What area interests you?\n3. Budget range or home value?\n4. Preferred time to chat?\n\nNo obligation — just a friendly conversation!",
      emergency: "Need immediate real estate help?\n\n📞 Call an agent: (555) 678-9012\n\nClosing deadline? Contract questions? Our agents are responsive and can help fast.",
      default: "Great question! Let me connect you with an agent.\n\n• 📞 Call: (555) 678-9012\n• 📅 Schedule a free consultation\n• 💬 Keep chatting!\n\nWhat else can I help with?"
    }
  },
};

function getMatchedBucket(message) {
  const l = message.toLowerCase();
  if (l.match(/service|offer|do you do|treatment|practice|listing|search/)) return "services";
  if (l.match(/price|cost|how much|pricing|fee|billing|valuation/)) return "pricing";
  if (l.match(/hour|open|close|when|location|where/)) return "hours";
  if (l.match(/book|appointment|schedule|consult|quote|estimate/)) return "appointment";
  if (l.match(/emergency|urgent|pain|repair|broken|leak|burst|arrest/)) return "emergency";
  if (l.match(/special|deal|maintenance|plan|drain|clean|sell/)) return "services";
  return "default";
}

function getAIResponse(message, industryKey, conversationHistory = []) {
  const industry = INDUSTRIES[industryKey] || INDUSTRIES.dental;
  const r = industry.responses;
  const bucket = getMatchedBucket(message);
  const candidate = r[bucket] || r.default;
  const phone = r.hours?.match(/\(\d{3}\) \d{3}-\d{4}/)?.[0] || "our office";
  const name = industry.name;

  const botCount = conversationHistory.filter(m => m.role === "bot").length;
  const bucketHits = conversationHistory.filter(m => m.role === "user" && getMatchedBucket(m.text) === bucket).length;

  if (botCount >= 6) {
    return `Thanks for chatting with me! I've shared everything I can here.\n\nTo get personal help, the best next step is:\n\n📞 Call us: ${phone}\n📋 Or leave your name and phone — we'll follow up within minutes.\n\nWe'd love to help you!`;
  }

  if (bucketHits <= 1) return candidate;

  if (bucketHits === 2) {
    const t1 = {
      services: `I shared our services above! Want me to narrow it down?\n\n• 💰 Ask me about pricing for any specific one\n• 📅 Ready to book? I can help with that\n• 📞 Or call us directly at ${phone}`,
      pricing: `I listed our pricing above! To get a quote specific to your situation:\n\n📅 Book a free consultation — no obligation\n📞 Or call ${phone} and our team can walk you through it\n\nWhich works best for you?`,
      hours: `Those are our hours above! Is there anything else I can help with?\n\n• 💰 Pricing questions?\n• 📅 Want to book a visit?\n• 📞 Call us at ${phone}`,
      appointment: `Great — to lock in your appointment, I just need a few details:\n\n1. What service are you coming in for?\n2. What day works best for you?\n3. Your name and phone number so we can confirm\n\nOr call ${phone} to book directly!`,
      emergency: `For emergencies, the fastest option is always to call:\n\n📞 ${phone} — available 24/7\n\nIf you can't call right now, share your number and we'll reach out to you ASAP.`,
      default: `I want to help, but I may not have that specific info. Here's what I'd suggest:\n\n📞 Call ${phone} — our team can answer that in a minute\n📅 Or tell me your name and number and we'll call you back\n\nWhat would you prefer?`,
    };
    return t1[bucket] || t1.default;
  }

  if (bucketHits === 3) {
    const t2 = {
      services: `You've got great questions about our services! The best way to get detailed answers is a quick call.\n\n📞 ${phone}\n\nOr drop your name and number and someone from ${name} will reach out!`,
      pricing: `Every case is a little different, so an exact price depends on your specific needs. The fastest way to find out:\n\n📞 Call ${phone} for a free quote\n💬 Or share your name + phone and we'll reach out with pricing details!`,
      hours: `Need a time outside our regular hours? We might be able to make it work!\n\n📞 Call ${phone} to ask about availability\n💬 Or leave your info and we'll find something that fits your schedule.`,
      appointment: `Let's get this done! Just drop your name and phone number here, and our team at ${name} will call you to finalize everything. Quick and easy!`,
      emergency: `Please call us now at ${phone}.\n\nIf you can't reach us, share your name and number and we will call you back immediately — we treat every emergency as a top priority.`,
      default: `That's beyond what I can cover here, but our team can definitely help.\n\n📞 ${phone}\n💬 Or share your name + number — someone from ${name} will get back to you shortly!`,
    };
    return t2[bucket] || t2.default;
  }

  return `I appreciate your questions! I've shared what I can on this topic. The fastest way to get exactly what you need:\n\n📞 Call ${name}: ${phone}\n📋 Or leave your name and phone number — we'll reach out within minutes!\n\nWhat would you prefer?`;
}

function ChatWidget({ isOpen, onClose, industryKey = "dental", brandColor = "#0e7c6b" }) {
  const industry = INDUSTRIES[industryKey] || INDUSTRIES.dental;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatPhase, setChatPhase] = useState("chat");
  const [rating, setRating] = useState(0);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", contactMethod: "phone", consent: false });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const messagesEndRef = useRef(null);
  const prevRef = useRef(industryKey);

  useEffect(() => {
    if (prevRef.current !== industryKey) { setMessages([]); setChatPhase("chat"); setRating(0); prevRef.current = industryKey; }
  }, [industryKey]);

  useEffect(() => {
    if (isOpen && messages.length === 0) setTimeout(() => setMessages([{ role: "bot", text: industry.responses.greeting, time: new Date() }]), 600);
  }, [isOpen, industryKey, messages.length]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const getBusinessInfo = () => {
    const r = industry.responses;
    const phone = r.hours?.match(/\(\d{3}\) \d{3}-\d{4}/)?.[0] || "our office";
    return { name: industry.name, phone, pricing: r.pricing, hours: r.hours, services: r.services };
  };

  const fetchAIResponse = async (allMessages) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, businessInfo: getBusinessInfo() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");
      return data.text;
    } catch (err) {
      console.error("Chat API error:", err);
      return `Sorry, I'm having trouble connecting right now. Please call us at ${getBusinessInfo().phone} for immediate help!`;
    }
  };

  const humanPhrases = ["talk to a human","speak to someone","real person","talk to someone","human agent","live agent","call me","speak to a person"];
  const getHumanResponse = () => { const b = getBusinessInfo(); return `I'd be happy to connect you with our team! Here's how to reach us:\n\n📞 Phone: ${b.phone}\n📧 Email: ${b.email}\n🕐 Hours: ${b.hours}\n\nYou can also leave your contact info and we'll reach out to you personally!`; };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = { role: "user", text: input.trim(), time: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(""); setIsTyping(true);
    const isHuman = humanPhrases.some(p => userMsg.text.toLowerCase().includes(p));
    const response = isHuman ? getHumanResponse() : await fetchAIResponse(updated);
    setMessages(prev => [...prev, { role: "bot", text: response, time: new Date() }]);
    setIsTyping(false);
  };
  const handleQuickReply = async (q) => {
    if (isTyping) return;
    const userMsg = { role: "user", text: q, time: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated); setIsTyping(true);
    const isHuman = humanPhrases.some(p => q.toLowerCase().includes(p));
    const response = isHuman ? getHumanResponse() : await fetchAIResponse(updated);
    setMessages(prev => [...prev, { role: "bot", text: response, time: new Date() }]);
    setIsTyping(false);
  };

  if (!isOpen) return null;
  return (
    <div className="chat-widget-mobile" style={{ position:"fixed",bottom:24,right:24,width:380,height:600,background:"#fff",borderRadius:20,boxShadow:"0 25px 60px rgba(0,0,0,0.3)",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:10000,fontFamily:"'DM Sans',sans-serif",border:"1px solid rgba(0,0,0,0.08)",animation:"slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <div style={{ background:`linear-gradient(135deg,${brandColor},${brandColor}dd)`,color:"#fff",padding:"16px 20px",display:"flex",alignItems:"center",gap:12 }}>
        <div style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20 }}>{industry.emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700,fontSize:15 }}>{industry.name}</div>
          <div style={{ fontSize:12,opacity:0.85,display:"flex",alignItems:"center",gap:4 }}><span style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block" }}></span>Online now • Replies instantly</div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Icons.X /></button>
      </div>

      {chatPhase === "chat" && (<>
        <div style={{ flex:1,overflowY:"auto",padding:"16px 16px 8px",background:"#f8f9fb" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",marginBottom:12,animation:"fadeIn 0.3s ease" }}>
              <div style={{ maxWidth:"82%",padding:"10px 14px",borderRadius:16,background:msg.role==="user"?brandColor:"#fff",color:msg.role==="user"?"#fff":"#1e293b",fontSize:13.5,lineHeight:1.5,whiteSpace:"pre-line",boxShadow:msg.role==="bot"?"0 1px 3px rgba(0,0,0,0.06)":"none",borderBottomRightRadius:msg.role==="user"?4:16,borderBottomLeftRadius:msg.role==="bot"?4:16 }}>{msg.text}</div>
            </div>
          ))}
          {isTyping && <div style={{ display:"flex",gap:4,padding:"10px 14px",background:"#fff",borderRadius:16,width:"fit-content",boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>{[0,1,2].map(i=><span key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#94a3b8",display:"inline-block",animation:`bounce 1.4s ease-in-out ${i*0.16}s infinite` }}></span>)}</div>}
          <div ref={messagesEndRef} />
        </div>
        {messages.length <= 2 && <div style={{ padding:"4px 16px 8px",display:"flex",flexWrap:"wrap",gap:6,background:"#f8f9fb" }}>
          {industry.quickReplies.map(q => <button key={q} onClick={()=>handleQuickReply(q)} style={{ padding:"6px 12px",borderRadius:20,border:`1px solid ${brandColor}33`,background:`${brandColor}08`,color:brandColor,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>{q}</button>)}
        </div>}
        <div style={{ padding:"12px 16px",borderTop:"1px solid #e9ecf0",background:"#fff",display:"flex",flexDirection:"column",gap:8 }}>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Type your message..." style={{ flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid #e2e8f0",fontSize:13.5,fontFamily:"inherit",outline:"none" }} />
            <button onClick={sendMessage} style={{ width:40,height:40,borderRadius:12,background:brandColor,border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Icons.Send /></button>
          </div>
          <div style={{ display:"flex",justifyContent:"flex-end" }}>
            <button onClick={()=>setChatPhase("rating")} style={{ padding:"5px 10px",borderRadius:8,border:"none",background:"transparent",fontSize:10,color:"#dc2626",cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>End conversation</button>
          </div>
        </div>
      </>)}

      {chatPhase === "rating" && (
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",background:"#f8f9fb" }}>
          <div style={{ fontSize:48,marginBottom:16 }}>💬</div>
          <h3 style={{ fontSize:18,fontWeight:700,color:"#1e293b",margin:"0 0 8px" }}>How was your experience?</h3>
          <p style={{ fontSize:13,color:"#64748b",margin:"0 0 24px" }}>Your feedback helps us improve</p>
          <div style={{ display:"flex",gap:8,marginBottom:24 }}>{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setRating(s)} style={{ background:"none",border:"none",cursor:"pointer",color:s<=rating?"#f59e0b":"#d1d5db",transform:s<=rating?"scale(1.2)":"scale(1)",padding:2,transition:"all 0.2s" }}><Icons.Star filled={s<=rating} /></button>)}</div>
          <button onClick={()=>setChatPhase("leadCapture")} disabled={!rating} style={{ padding:"12px 32px",borderRadius:12,background:rating?brandColor:"#cbd5e1",color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:rating?"pointer":"default",fontFamily:"inherit" }}>Continue</button>
        </div>
      )}

      {chatPhase === "leadCapture" && (
        <div style={{ flex:1,overflowY:"auto",padding:24,background:"#f8f9fb" }}>
          <h3 style={{ fontSize:17,fontWeight:700,color:"#1e293b",margin:"0 0 4px" }}>Stay connected!</h3>
          <p style={{ fontSize:13,color:"#64748b",margin:"0 0 20px" }}>Leave your info and we'll follow up personally.</p>
          {[{key:"name",label:"Full Name *",type:"text",ph:"John Smith"},{key:"phone",label:"Phone Number *",type:"tel",ph:"(555) 000-0000"},{key:"email",label:"Email (optional)",type:"email",ph:"john@email.com"}].map(f=>(
            <div key={f.key} style={{ marginBottom:14 }}>
              <label style={{ fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4 }}>{f.label}</label>
              <input type={f.type} placeholder={f.ph} value={leadForm[f.key]} onChange={e=>setLeadForm(p=>({...p,[f.key]:e.target.value}))} style={{ width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:13.5,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }} />
            </div>
          ))}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6 }}>Preferred contact method</label>
            <div style={{ display:"flex",gap:8 }}>{["phone","email","text"].map(m=><button key={m} onClick={()=>setLeadForm(p=>({...p,contactMethod:m}))} style={{ flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:600,border:`1.5px solid ${leadForm.contactMethod===m?brandColor:"#e2e8f0"}`,background:leadForm.contactMethod===m?`${brandColor}10`:"#fff",color:leadForm.contactMethod===m?brandColor:"#64748b",cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize" }}>{m}</button>)}</div>
          </div>
          <label style={{ display:"flex",gap:8,alignItems:"flex-start",fontSize:11.5,color:"#64748b",marginBottom:20,cursor:"pointer" }}>
            <input type="checkbox" checked={leadForm.consent} onChange={e=>setLeadForm(p=>({...p,consent:e.target.checked}))} style={{ marginTop:2,accentColor:brandColor }} />
            I consent to being contacted. Standard message rates may apply.
          </label>
          <button onClick={async()=>{if(!leadForm.name||!leadForm.phone||!leadForm.consent)return;setLeadSubmitting(true);try{const transcript=messages.map(m=>`${m.role==='user'?'Customer':'Bot'}: ${m.text}`).join('\n');await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:leadForm.name,phone:leadForm.phone,email:leadForm.email,contactMethod:leadForm.contactMethod,rating,industry:industryKey,transcript})});} catch(err){console.error('Lead save failed:',err);} finally{setLeadSubmitting(false);setChatPhase('complete');}}} disabled={!leadForm.name||!leadForm.phone||!leadForm.consent||leadSubmitting} style={{ width:"100%",padding:"12px",borderRadius:12,background:(leadForm.name&&leadForm.phone&&leadForm.consent&&!leadSubmitting)?brandColor:"#cbd5e1",color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:(leadForm.name&&leadForm.phone&&leadForm.consent&&!leadSubmitting)?"pointer":"default",fontFamily:"inherit" }}>{leadSubmitting?'Submitting...':'Submit'}</button>
        </div>
      )}

      {chatPhase === "complete" && (
        <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center",background:"#f8f9fb" }}>
          <div style={{ width:64,height:64,borderRadius:"50%",background:`${brandColor}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,color:brandColor }}><Icons.Check /></div>
          <h3 style={{ fontSize:18,fontWeight:700,color:"#1e293b",margin:"0 0 8px" }}>Thank you! 🎉</h3>
          <p style={{ fontSize:13,color:"#64748b",margin:"0 0 24px" }}>Our team will reach out shortly.</p>
          <button onClick={onClose} style={{ padding:"12px 32px",borderRadius:12,background:brandColor,color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit" }}>Close</button>
        </div>
      )}

      <div style={{ padding:"6px 16px 8px",textAlign:"center",fontSize:10,color:"#94a3b8",background:chatPhase==="chat"?"#fff":"#f8f9fb" }}>🔒 We don't store payment info • Powered by <span style={{ fontWeight:700,color:brandColor }}>Latchly</span></div>
    </div>
  );
}

export default function LatchlyLanding() {
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("landing");
  const [openFaq, setOpenFaq] = useState(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const [embedCopied, setEmbedCopied] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState("dental");
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [contactForm, setContactForm] = useState({ name:"", email:"", business:"", message:"" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [countersVisible, setCountersVisible] = useState(false);
  const roiStatsRef = useRef(null);
  const industryKeys = Object.keys(INDUSTRIES);

  useEffect(() => {
    const handleScroll = () => { setShowStickyCta(window.scrollY > window.innerHeight); };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setCountersVisible(true); }, { threshold: 0.3 });
    if (roiStatsRef.current) obs.observe(roiStatsRef.current);
    return () => obs.disconnect();
  }, []);

  const features = [
    { icon: <Icons.MessageSquare />, title: "24/7 AI Chat Assistant", desc: "Never miss a customer. Your AI answers questions, qualifies leads, and books appointments around the clock — even when you're closed." },
    { icon: <Icons.Zap />, title: "Instant Lead Capture", desc: "Automatically collect names, phone numbers, and emails with post-chat lead forms. Get notified by email or SMS the moment a lead comes in." },
    { icon: <Icons.BarChart />, title: "Owner Dashboard & Analytics", desc: "See total chats, leads captured, after-hours activity, top questions, and conversion rates — all in one clean dashboard." },
    { icon: <Icons.Shield />, title: "Industry-Specific Intelligence", desc: "Pre-built knowledge bases for dental, med spa, HVAC, plumbing, legal, and more. Your bot speaks your industry from day one." },
    { icon: <Icons.Users />, title: "Human Handoff & Escalation", desc: "One-click 'Talk to a human' button, click-to-call, and callback requests. AI handles the volume — you handle the close." },
    { icon: <Icons.Globe />, title: "2-Minute Installation", desc: "Copy one line of code. Paste it on your site. That's it. No developers, no redesign, no headaches. Works on any website platform." },
  ];
  const plans = [
    { id:"starter",name:"Starter",price:"$109.99",period:"/month",desc:"Perfect for single-location businesses getting started with AI",features:["AI chat widget for your website","Up to 100 leads/month","Basic customization","Email notifications","Mobile-friendly chat"],cta:"Start Free Trial",popular:false },
    { id:"growth",name:"Growth",price:"$249.99",period:"/month",desc:"For businesses ready to maximize every lead and scale",features:["Everything in Starter, plus:","Unlimited leads","Advanced AI training","Custom branding","SMS alerts","CRM integrations","Priority support"],cta:"Start Free Trial",popular:true },
  ];
  const faqs = [
    { q:"How does the AI know about my specific business?", a:"During setup, you provide your business details — services, pricing, hours, FAQs, and service areas. The AI uses this custom knowledge base to answer questions accurately. We also have pre-built templates for 20+ industries." },
    { q:"Will this slow down my website?", a:"Not at all. The chat widget loads asynchronously and weighs under 50KB. Zero impact on page load speed and Core Web Vitals." },
    { q:"What happens if the AI can't answer a question?", a:"The AI gracefully escalates — 'Talk to a human' button, click-to-call, or collecting visitor info for your team to follow up." },
    { q:"Do I need to change my existing website?", a:"No. One line of embed code — like adding Google Analytics. Works on WordPress, Squarespace, Wix, Shopify, and any platform." },
    { q:"How are leads delivered to me?", a:"Email, SMS, or both. Every notification includes the full conversation transcript. You can also view everything in your dashboard." },
    { q:"Is this compliant with privacy regulations?", a:"Yes. Privacy notices, consent checkboxes, no payment info stored. Conversation data encrypted and used only for service improvement." },
    { q:"Can I customize the look and feel?", a:"Absolutely. Brand colors, logo, greeting message, quick-reply buttons. The widget feels like part of your website." },
    { q:"What industries does this work for?", a:"Any service-based business. We have presets for dental, med spa, HVAC, plumbing, legal, real estate, auto repair, salons, fitness, and more." },
  ];
  const roiComparisons = [
    { title:"Cost Per Lead", ai:"$0.50 – $2.00", trad:"$15 – $50+", icon:<Icons.DollarSign />, detail:"AI handles unlimited chats simultaneously. A receptionist handles one call at a time. The math is simple." },
    { title:"After-Hours Coverage", ai:"24/7/365 — never off", trad:"0 hours covered", icon:<Icons.Clock />, detail:"40–60% of website visits happen outside business hours. Without AI, every one of those visitors bounces to a competitor." },
    { title:"Response Time", ai:"Under 2 seconds", trad:"4–24+ hours", icon:<Icons.Zap />, detail:"78% of customers buy from the first business that responds. AI responds instantly — every single time." },
    { title:"Annual Cost", ai:"$1,164 – $2,364/yr", trad:"$35,000 – $55,000/yr", icon:<Icons.TrendingUp />, detail:"A full-time receptionist costs $35K–$55K/yr plus benefits. Latchly works 3x the hours at a fraction of the cost." },
  ];
  const embedCode = `<!-- Latchly Chat Widget -->\n<script src="https://cdn.latchly.com/widget.js"\n  data-business-id="YOUR_ID"\n  data-color="#0e7c6b"\n  async>\n</script>`;
  const ind = INDUSTRIES[selectedIndustry];

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",background:"#fafbfc",color:"#1e293b",overflowX:"hidden" }}>

      {/* NAV */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:1000,background:"rgba(250,251,252,0.85)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(0,0,0,0.05)",padding:"0 40px" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",height:64 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#0e7c6b,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" }}><Icons.Zap /></div>
            <span style={{ fontWeight:800,fontSize:18,letterSpacing:-0.5 }}>Latchly</span>
          </div>
          <div style={{ display:"flex",gap:32,alignItems:"center" }}>
            {["Features","Demo","Pricing","FAQ","About","Contact"].map(item=><a key={item} href={`#${item.toLowerCase()}`} onClick={e=>{e.preventDefault();document.getElementById(item.toLowerCase())?.scrollIntoView({behavior:"smooth",block:"start"});}} style={{ textDecoration:"none",color:"#475569",fontSize:14,fontWeight:600,cursor:"pointer" }}>{item}</a>)}
            <button onClick={()=>setChatOpen(true)} style={{ padding:"9px 20px",borderRadius:10,background:"linear-gradient(135deg,#0e7c6b,#0a6b5c)",color:"#fff",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Try Live Demo</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 24px 40px",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-200,right:-200,width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#0e7c6b08 0%,transparent 70%)",pointerEvents:"none" }} />
        <div className="hero-grid" style={{ maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:56,alignItems:"center" }}>
          <div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:50,background:"#0e7c6b10",border:"1px solid #0e7c6b20",fontSize:12.5,fontWeight:700,color:"#0e7c6b",marginBottom:12 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s infinite" }}></span>Your website never sleeps.
            </div>
            <h1 style={{ fontFamily:"'Playfair Display',serif",fontSize:56,fontWeight:900,lineHeight:1.08,letterSpacing:-2,marginBottom:14,color:"#0f172a" }}>
              Your company's<br/><span style={{ background:"linear-gradient(135deg,#0e7c6b,#0ea5e9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>best employee</span><br/>never sleeps.
            </h1>
            <p style={{ fontSize:18,lineHeight:1.65,color:"#64748b",marginBottom:24,maxWidth:480 }}>A 24/7 AI assistant that answers questions, captures leads, and sends real customers to your phone — even when you're closed.</p>
            <div style={{ display:"flex",gap:14,alignItems:"center",marginBottom:20 }}>
              <button onClick={()=>setChatOpen(true)} style={{ padding:"16px 32px",borderRadius:14,background:"linear-gradient(135deg,#0e7c6b,#0a6b5c)",color:"#fff",border:"none",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8,boxShadow:"0 8px 30px #0e7c6b40" }}>See it in action <Icons.ArrowRight /></button>
              <a href="#pricing" onClick={e=>{e.preventDefault();document.getElementById("pricing")?.scrollIntoView({behavior:"smooth",block:"start"});}} style={{ padding:"16px 32px",borderRadius:14,border:"2px solid #e2e8f0",color:"#475569",textDecoration:"none",fontWeight:700,fontSize:15,fontFamily:"'DM Sans',sans-serif" }}>View Pricing</a>
            </div>
            <div style={{ display:"flex",gap:24,fontSize:13,color:"#94a3b8" }}>{["No credit card required","2-min setup","Cancel anytime"].map(t=><span key={t} style={{ display:"flex",alignItems:"center",gap:5 }}><span style={{ color:"#0e7c6b" }}><Icons.Check /></span> {t}</span>)}</div>
          </div>
          <div style={{ position:"relative" }}>
            <div onClick={()=>setChatOpen(true)} style={{ cursor:"pointer",background:"#fff",borderRadius:24,overflow:"hidden",boxShadow:"0 40px 80px rgba(0,0,0,0.08)",border:"1px solid rgba(0,0,0,0.06)",animation:"float 6s ease-in-out infinite",minHeight:380 }}>
              <div style={{ background:"linear-gradient(135deg,#0e7c6b,#0e7c6bdd)",padding:"14px 20px",display:"flex",alignItems:"center",gap:10,color:"#fff" }}>
                <div style={{ width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{ind.emoji}</div>
                <div><div style={{ fontWeight:700,fontSize:14 }}>{ind.name}</div><div style={{ fontSize:11,opacity:0.8 }}>● Online now</div></div>
              </div>
              <div style={{ padding:"16px 20px",minHeight:280,overflow:"hidden" }}>
                {[{role:"bot",text:"Hi there! 👋 How can I help you today?"},{role:"user",text:ind.heroQ},{role:"bot",text:ind.heroA}].map((m,i)=>(
                  <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:10 }}>
                    <div style={{ padding:"16px 20px",borderRadius:14,maxWidth:"80%",fontSize:13,lineHeight:1.5,background:m.role==="user"?"#0e7c6b":"#f1f5f9",color:m.role==="user"?"#fff":"#1e293b",borderBottomRightRadius:m.role==="user"?4:14,borderBottomLeftRadius:m.role==="bot"?4:14 }}>{m.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"0 20px 16px" }}>
                <div style={{ display:"flex",gap:6 }}>{ind.quickReplies.slice(0,3).map(b=><span key={b} style={{ padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,border:"1px solid #0e7c6b30",color:"#0e7c6b",background:"#0e7c6b08" }}>{b}</span>)}</div>
              </div>
            </div>
            <div style={{ position:"absolute",top:-16,right:-16,background:"#fff",borderRadius:14,padding:"10px 16px",boxShadow:"0 8px 30px rgba(0,0,0,0.1)",display:"flex",alignItems:"center",gap:8,animation:"float 5s ease-in-out 1s infinite" }}>
              <div style={{ width:32,height:32,borderRadius:8,background:"#fef3c7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>📱</div>
              <div><div style={{ fontSize:11,fontWeight:700,color:"#1e293b" }}>New lead captured!</div><div style={{ fontSize:10,color:"#64748b" }}>Just now</div></div>
            </div>
            <div style={{ position:"absolute",bottom:-10,left:-20,background:"#fff",borderRadius:14,padding:"10px 16px",boxShadow:"0 8px 30px rgba(0,0,0,0.1)",animation:"float 5s ease-in-out 2s infinite" }}>
              <div style={{ fontSize:10,color:"#64748b",fontWeight:600 }}>After-hours coverage</div><div style={{ fontSize:22,fontWeight:800,color:"#0e7c6b" }}>24/7</div>
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRY SELECTOR */}
      <section style={{ padding:"24px 0" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",textAlign:"center" }}>
          <p style={{ fontSize:13,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:2,marginBottom:20 }}>Select an industry to try the demo</p>
          <div style={{ display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap" }}>
            {industryKeys.map(key=>{const i=INDUSTRIES[key];const active=selectedIndustry===key;return(
              <button key={key} onClick={()=>setSelectedIndustry(key)} style={{ padding:"10px 20px",borderRadius:12,fontSize:14,fontWeight:700,color:active?"#fff":"#1e293b",whiteSpace:"nowrap",background:active?"linear-gradient(135deg,#0e7c6b,#0a6b5c)":"#fff",border:active?"2px solid #0e7c6b":"2px solid #e2e8f0",cursor:"pointer",fontFamily:"inherit",transition:"all 0.25s",boxShadow:active?"0 4px 16px #0e7c6b30":"0 1px 3px rgba(0,0,0,0.04)",display:"flex",alignItems:"center",gap:6 }}><span style={{ fontSize:16 }}>{i.emoji}</span> {i.label}</button>
            );})}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding:"60px 40px" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Features</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>Everything you need to<br/>convert more visitors</h2>
            <p style={{ fontSize:16,color:"#64748b",maxWidth:520,margin:"0 auto" }}>From AI conversations to lead capture to analytics — one platform handles it all.</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,marginBottom:20 }}>
            {features.map((f,i)=><div key={i} className="hover-lift" style={{ background:"#fff",borderRadius:18,padding:32,border:"1px solid #f1f5f9" }}>
              <div style={{ width:48,height:48,borderRadius:14,marginBottom:20,background:"linear-gradient(135deg,#0e7c6b12,#0ea5e912)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0e7c6b" }}>{f.icon}</div>
              <h3 style={{ fontSize:17,fontWeight:800,marginBottom:10 }}>{f.title}</h3>
              <p style={{ fontSize:14,lineHeight:1.65,color:"#64748b" }}>{f.desc}</p>
            </div>)}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" style={{ padding:"60px 40px",background:"#f1f5f9" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Live Demo</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>See it in action</h2>
            <p style={{ fontSize:16,color:"#64748b",maxWidth:580,margin:"0 auto" }}>Select an industry above, then open the chat to experience a fully tailored AI assistant.</p>
          </div>
          <div style={{ display:"flex",justifyContent:"center",gap:16,marginBottom:24 }}>
            {["landing","dashboard"].map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"10px 24px",borderRadius:10,border:"none",fontFamily:"inherit",fontWeight:700,fontSize:14,cursor:"pointer",background:activeTab===tab?"#0e7c6b":"#fff",color:activeTab===tab?"#fff":"#64748b",boxShadow:activeTab===tab?"0 4px 12px #0e7c6b30":"0 1px 3px rgba(0,0,0,0.05)" }}>{tab==="landing"?"Chat Widget":"Owner Dashboard"}</button>)}
          </div>
          {activeTab==="dashboard"?<DashboardPreview />:(
            <div style={{ textAlign:"center" }}>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"8px 20px",borderRadius:50,background:"#fff",marginBottom:24,fontSize:14,fontWeight:700,color:"#0e7c6b",boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}><span style={{ fontSize:18 }}>{ind.emoji}</span>Currently demoing: {ind.name}</div><br/>
              <button onClick={()=>setChatOpen(true)} style={{ padding:"20px 48px",borderRadius:16,background:"linear-gradient(135deg,#0e7c6b,#0a6b5c)",color:"#fff",border:"none",fontWeight:800,fontSize:18,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 12px 40px #0e7c6b30",display:"inline-flex",alignItems:"center",gap:12 }}><Icons.MessageSquare /> Open Live Chat Demo</button>
              <p style={{ fontSize:13,color:"#94a3b8",marginTop:16 }}>Industry-tailored responses, quick replies, lead capture, and rating system</p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding:"60px 40px" }}>
        <div style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Setup</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5 }}>Up and running in minutes</h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:32 }}>
            {[{step:"01",title:"Tell us about your business",desc:"Enter your services, hours, pricing, and FAQs. Or pick an industry template."},{step:"02",title:"Copy one line of code",desc:"We generate a tiny embed snippet. Paste it on your website — any platform."},{step:"03",title:"Start capturing leads",desc:"Your AI assistant is live. Watch leads flow into your dashboard and phone."}].map(s=>(
              <div key={s.step} style={{ textAlign:"center" }}>
                <div style={{ width:56,height:56,borderRadius:"50%",margin:"0 auto 20px",background:"linear-gradient(135deg,#0e7c6b,#0ea5e9)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,fontFamily:"'Playfair Display',serif" }}>{s.step}</div>
                <h3 style={{ fontSize:17,fontWeight:800,marginBottom:10 }}>{s.title}</h3>
                <p style={{ fontSize:14,lineHeight:1.65,color:"#64748b" }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:48,background:"#0f172a",borderRadius:16,padding:24 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div style={{ display:"flex",gap:6 }}><span style={{ width:10,height:10,borderRadius:"50%",background:"#ef4444" }}></span><span style={{ width:10,height:10,borderRadius:"50%",background:"#f59e0b" }}></span><span style={{ width:10,height:10,borderRadius:"50%",background:"#22c55e" }}></span></div>
              <button onClick={()=>{navigator.clipboard.writeText(embedCode).then(()=>{setEmbedCopied(true);setTimeout(()=>setEmbedCopied(false),2000);});}} style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:6,background:"#1e293b",border:"1px solid #334155",color:embedCopied?"#4ade80":"#94a3b8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}><Icons.Copy /> {embedCopied?"Copied!":"Copy"}</button>
            </div>
            <pre style={{ color:"#e2e8f0",fontSize:13,lineHeight:1.7,fontFamily:"'Fira Code','SF Mono',monospace",overflow:"auto" }}><code>{embedCode}</code></pre>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding:"60px 40px",background:"#f8fafc" }}>
        <div style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>About Us</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>Built for small businesses,{"\n"}by people who get it</h2>
            <p style={{ fontSize:16,color:"#64748b",maxWidth:600,margin:"0 auto",lineHeight:1.7 }}>Latchly was founded to solve one problem: small businesses losing customers after hours. We combine cutting-edge AI with deep industry knowledge to help you capture every opportunity.</p>
          </div>
          <div className="about-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:24 }}>
            {[{icon:"🎯",title:"Mission-Driven",desc:"We exist to level the playing field — giving small businesses enterprise-grade AI tools at a fraction of the cost."},{icon:"🔬",title:"Industry Expertise",desc:"Our team has built AI solutions for 20+ industries. Every template is crafted from real business conversations."},{icon:"🤝",title:"Customer-First",desc:"We measure success by your success. Dedicated support, continuous improvements, and transparent pricing — always."}].map((v,i)=>(
              <div key={i} className="hover-lift" style={{ background:"#fff",borderRadius:18,padding:32,border:"1px solid #f1f5f9",textAlign:"center" }}>
                <div style={{ fontSize:32,marginBottom:16 }}>{v.icon}</div>
                <h3 style={{ fontSize:17,fontWeight:800,marginBottom:10 }}>{v.title}</h3>
                <p style={{ fontSize:14,lineHeight:1.65,color:"#64748b" }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI SECTION */}
      <section style={{ padding:"60px 40px",background:"#f8fafc" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>ROI Comparison</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>AI assistant vs. traditional staffing</h2>
            <p style={{ fontSize:16,color:"#64748b",maxWidth:600,margin:"0 auto" }}>See the real numbers. Latchly doesn't just save money — it captures revenue you're currently leaving on the table.</p>
          </div>
          <div className="roi-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,marginBottom:24 }}>
            {roiComparisons.map((item,i)=>(
              <div key={i} className="hover-lift" style={{ background:"#fff",borderRadius:18,padding:28,border:"1px solid #f1f5f9" }}>
                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                  <div style={{ width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#0e7c6b12,#0ea5e912)",display:"flex",alignItems:"center",justifyContent:"center",color:"#0e7c6b" }}>{item.icon}</div>
                  <h3 style={{ fontSize:17,fontWeight:800 }}>{item.title}</h3>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
                  <div style={{ background:"#0e7c6b08",borderRadius:12,padding:"14px 16px",border:"1px solid #0e7c6b15" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>⚡ Latchly</div>
                    <div style={{ fontSize:16,fontWeight:800,color:"#0e7c6b" }}>{item.ai}</div>
                  </div>
                  <div style={{ background:"#fef2f2",borderRadius:12,padding:"14px 16px",border:"1px solid #fecaca" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>👤 Traditional</div>
                    <div style={{ fontSize:16,fontWeight:800,color:"#dc2626" }}>{item.trad}</div>
                  </div>
                </div>
                <p style={{ fontSize:13.5,lineHeight:1.6,color:"#64748b" }}>{item.detail}</p>
              </div>
            ))}
          </div>
          <div ref={roiStatsRef} className="roi-stats-grid" style={{ background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:20,padding:"36px 40px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,textAlign:"center" }}>
            {[{label:"Avg. cost per lead",value:"$0.50–$2",sub:"vs. $15–$50 traditional"},{label:"Hours covered",value:"168/week",sub:"vs. 40–50 hrs staffed"},{label:"Avg. response time",value:"< 2 sec",sub:"vs. 4–24 hrs by email"},{label:"Missed-lead reduction",value:"Up to 90%",sub:"capture after-hours visitors"}].map((s,i)=>(
              <div key={i} style={{ opacity:countersVisible?1:0,transform:countersVisible?"translateY(0)":"translateY(8px)",transition:`all 0.6s ease ${i*0.15}s` }}><div style={{ fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>{s.label}</div><div style={{ fontSize:24,fontWeight:900,color:"#fff" }}>{s.value}</div><div style={{ fontSize:11,color:"#4ade80",fontWeight:600,marginTop:4 }}>{s.sub}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding:"60px 40px" }}>
        <div style={{ maxWidth:900,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Pricing</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>Simple, transparent pricing</h2>
            <p style={{ fontSize:16,color:"#64748b" }}>Start with a 14-day free trial. No credit card required.</p>
          </div>
          <div className="pricing-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:24,alignItems:"start",marginBottom:20 }}>
            {plans.map(plan=>(
              <div key={plan.id} className="hover-lift" style={{ background:plan.popular?"linear-gradient(135deg,#0e7c6b,#0a6b5c)":"#fff",borderRadius:22,padding:plan.popular?3:0,position:"relative",cursor:"pointer" }} onClick={()=>setSelectedPlan(plan.id)}>
                {plan.popular&&<div style={{ position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",padding:"4px 16px",borderRadius:50,background:"#f59e0b",color:"#fff",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:1 }}>Best Value</div>}
                <div style={{ background:"#fff",borderRadius:plan.popular?20:22,padding:32,border:plan.popular?"none":`2px solid ${selectedPlan===plan.id?"#0e7c6b":"#f1f5f9"}` }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#0e7c6b",marginBottom:4 }}>{plan.name}</div>
                  <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:4 }}><span style={{ fontSize:44,fontWeight:900,letterSpacing:-2 }}>{plan.price}</span><span style={{ fontSize:15,color:"#94a3b8",fontWeight:600 }}>{plan.period}</span></div>
                  <p style={{ fontSize:13,color:"#64748b",marginBottom:24 }}>{plan.desc}</p>
                  <button style={{ width:"100%",padding:"13px",borderRadius:12,border:"none",background:plan.popular?"linear-gradient(135deg,#0e7c6b,#0a6b5c)":"#f1f5f9",color:plan.popular?"#fff":"#1e293b",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit",marginBottom:24 }}>{plan.cta}</button>
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>{plan.features.map(f=><div key={f} style={{ display:"flex",alignItems:"center",gap:10,fontSize:13.5,color:"#475569" }}><span style={{ color:"#0e7c6b",flexShrink:0 }}><Icons.Check /></span>{f}</div>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding:"60px 40px",background:"#f8fafc" }}>
        <div style={{ maxWidth:780,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>FAQ</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5 }}>Common questions</h2>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {faqs.map((faq,i)=>(
              <div key={i} style={{ background:"#fff",borderRadius:14,border:"1px solid #f1f5f9",overflow:"hidden",boxShadow:openFaq===i?"0 4px 12px rgba(0,0,0,0.05)":"none" }}>
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{ width:"100%",padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left" }}>
                  <span style={{ fontSize:15,fontWeight:700,color:"#1e293b" }}>{faq.q}</span>
                  <span style={{ color:"#94a3b8",transition:"transform 0.3s",flexShrink:0,marginLeft:12,transform:openFaq===i?"rotate(180deg)":"rotate(0)" }}><Icons.ChevronDown /></span>
                </button>
                <div style={{ maxHeight:openFaq===i?300:0,overflow:"hidden",transition:"max-height 0.3s ease" }}>
                  <div style={{ padding:"0 22px 18px",fontSize:14,lineHeight:1.7,color:"#64748b" }}>{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding:"60px 40px" }}>
        <div style={{ maxWidth:1000,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:44 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#0e7c6b",textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Contact</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:40,fontWeight:900,letterSpacing:-1.5,marginBottom:16 }}>Get in touch</h2>
            <p style={{ fontSize:16,color:"#64748b",maxWidth:520,margin:"0 auto" }}>Have questions? We&#39;d love to hear from you. Send us a message and we&#39;ll respond as soon as possible.</p>
          </div>
          <div className="contact-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:40,alignItems:"start" }}>
            <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
              {[{icon:"📧",label:"Email",value:"matt@latchlyai.com"},{icon:"📞",label:"Phone",value:"(786) 390-0299"},{icon:"📍",label:"Location",value:"Gainesville, FL"}].map((c,i)=>(
                <div key={i} style={{ background:"#f8fafc",borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",gap:16,border:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize:24 }}>{c.icon}</div>
                  <div><div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1 }}>{c.label}</div><div style={{ fontSize:15,fontWeight:700,color:"#1e293b" }}>{c.value}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff",borderRadius:20,padding:32,border:"1px solid #f1f5f9",boxShadow:"0 4px 12px rgba(0,0,0,0.04)" }}>
              {contactSubmitted ? (
                <div style={{ textAlign:"center",padding:"40px 0" }}><div style={{ fontSize:48,marginBottom:16 }}>✅</div><h3 style={{ fontSize:18,fontWeight:700,marginBottom:8 }}>Message sent!</h3><p style={{ fontSize:14,color:"#64748b" }}>We&#39;ll get back to you within 24 hours.</p></div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
                  {[{key:"name",label:"Name *",type:"text",ph:"Your name"},{key:"email",label:"Email *",type:"email",ph:"you@company.com"},{key:"business",label:"Business Name",type:"text",ph:"Your business"}].map(f=>(
                    <div key={f.key}><label style={{ fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4 }}>{f.label}</label><input type={f.type} placeholder={f.ph} value={contactForm[f.key]} onChange={e=>setContactForm(p=>({...p,[f.key]:e.target.value}))} style={{ width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }} /></div>
                  ))}
                  <div><label style={{ fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:4 }}>Message *</label><textarea placeholder="How can we help?" value={contactForm.message} onChange={e=>setContactForm(p=>({...p,message:e.target.value}))} rows={4} style={{ width:"100%",padding:"10px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",resize:"vertical" }} /></div>
                  <button onClick={async()=>{if(!contactForm.name||!contactForm.email||!contactForm.message)return;setContactSubmitting(true);try{await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(contactForm)});setContactSubmitted(true);}catch(err){console.error(err);}finally{setContactSubmitting(false);}}} disabled={!contactForm.name||!contactForm.email||!contactForm.message||contactSubmitting} style={{ width:"100%",padding:"13px",borderRadius:12,border:"none",background:(contactForm.name&&contactForm.email&&contactForm.message&&!contactSubmitting)?"linear-gradient(135deg,#0e7c6b,#0a6b5c)":"#cbd5e1",color:"#fff",fontWeight:800,fontSize:14,cursor:(contactForm.name&&contactForm.email&&contactForm.message&&!contactSubmitting)?"pointer":"default",fontFamily:"inherit" }}>{contactSubmitting?"Sending...":"Send Message"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"32px 24px" }}>
        <div style={{ maxWidth:800,margin:"0 auto",textAlign:"center",background:"linear-gradient(135deg,#0e7c6b,#0ea5e9)",borderRadius:28,padding:"48px 40px",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",top:-50,right:-50,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.05)" }} />
          <h2 style={{ fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:900,color:"#fff",marginBottom:12,position:"relative" }}>Ready to never miss a lead again?</h2>
          <p style={{ fontSize:16,color:"rgba(255,255,255,0.8)",marginBottom:32,position:"relative" }}>Start your 14-day free trial. Set up in 2 minutes. No credit card required.</p>
          {!emailSubmitted?(
            <div style={{ display:"flex",gap:10,maxWidth:440,margin:"0 auto",position:"relative" }}>
              <input type="email" placeholder="Enter your email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} style={{ flex:1,padding:"14px 18px",borderRadius:12,border:"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.15)",color:"#fff",fontSize:14,fontFamily:"inherit" }} />
              <button onClick={async()=>{if(!emailInput)return;setEmailLoading(true);try{await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emailInput})});setEmailSubmitted(true);}catch(err){console.error('Subscribe failed:',err);setEmailSubmitted(true);}finally{setEmailLoading(false);}}} disabled={emailLoading} style={{ padding:"14px 28px",borderRadius:12,background:"#fff",color:"#0e7c6b",border:"none",fontWeight:800,fontSize:14,cursor:emailLoading?"default":"pointer",fontFamily:"inherit",whiteSpace:"nowrap",opacity:emailLoading?0.7:1 }}>{emailLoading?'Sending...':'Get Started'}</button>
            </div>
          ):<div style={{ color:"#fff",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,position:"relative" }}><Icons.Check /> Check your inbox! We've sent you a setup link.</div>}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:"#0f172a",padding:"60px 40px 0",color:"#cbd5e1" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div className="footer-grid" style={{ display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1.2fr",gap:48,marginBottom:48 }}>
            <div>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16 }}>
                <div style={{ width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#0e7c6b,#0ea5e9)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" }}><Icons.Zap /></div>
                <span style={{ fontWeight:800,fontSize:18,color:"#fff" }}>Latchly</span>
              </div>
              <p style={{ fontSize:14,lineHeight:1.7,color:"#94a3b8",marginBottom:16 }}>AI-powered chat assistants that capture leads 24/7 for service-based businesses.</p>
              <p style={{ fontSize:13,color:"#64748b" }}>📍 Gainesville, FL</p>
            </div>
            <div>
              <h4 style={{ fontSize:13,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:1.5,marginBottom:20 }}>Quick Links</h4>
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {["Home","Features","Demo","Pricing","FAQ","About","Contact"].map(l=><a key={l} href={l==="Home"?"#":`#${l.toLowerCase()}`} onClick={e=>{e.preventDefault();if(l==="Home")window.scrollTo({top:0,behavior:"smooth"});else document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:"smooth"});}} style={{ color:"#94a3b8",textDecoration:"none",fontSize:14,cursor:"pointer" }}>{l}</a>)}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize:13,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:1.5,marginBottom:20 }}>Industries</h4>
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {["Dental","Med Spa","HVAC","Plumbing","Legal","Real Estate","Auto Repair","Salons"].map(l=><span key={l} style={{ color:"#94a3b8",fontSize:14 }}>{l}</span>)}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize:13,fontWeight:700,color:"#fff",textTransform:"uppercase",letterSpacing:1.5,marginBottom:20 }}>Contact</h4>
              <div style={{ display:"flex",flexDirection:"column",gap:12,fontSize:14,color:"#94a3b8" }}>
                <span>📧 matt@latchlyai.com</span>
                <span>📞 (555) 123-4567</span>
                <span>🕐 Mon–Fri, 9am–6pm CT</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop:"1px solid #1e293b",padding:"24px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16 }}>
            <div style={{ fontSize:13,color:"#64748b" }}> 2026 Latchly. All rights reserved.</div>
            <div style={{ display:"flex",gap:24 }}>
              {["Privacy Policy","Terms of Service","Sitemap"].map(l=><a key={l} href="#" style={{ fontSize:13,color:"#64748b",textDecoration:"none" }}>{l}</a>)}
            </div>
          </div>
        </div>
      </footer>

      {/* STICKY CTA BAR */}
      {showStickyCta&&!chatOpen&&<div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:9998,background:"rgba(15,23,42,0.95)",backdropFilter:"blur(12px)",padding:"12px 24px",display:"flex",justifyContent:"center",alignItems:"center",gap:16,borderTop:"1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ color:"#fff",fontSize:14,fontWeight:600 }}>Turn your website into a lead-capturing machine</span>
        <button onClick={()=>setChatOpen(true)} style={{ padding:"10px 24px",borderRadius:10,background:"linear-gradient(135deg,#0e7c6b,#0a6b5c)",color:"#fff",border:"none",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Try Demo</button>
      </div>}

      {/* FAB */}
      {!chatOpen&&<button onClick={()=>setChatOpen(true)} style={{ position:"fixed",bottom:showStickyCta?60:24,right:24,width:60,height:60,borderRadius:18,background:"linear-gradient(135deg,#0e7c6b,#0a6b5c)",color:"#fff",border:"none",cursor:"pointer",zIndex:9999,boxShadow:"0 8px 30px #0e7c6b50",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 3s infinite",transition:"bottom 0.3s" }}><Icons.MessageSquare /><span style={{ position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ef4444",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center" }}>1</span></button>}

      <ChatWidget isOpen={chatOpen} onClose={()=>setChatOpen(false)} industryKey={selectedIndustry} />
    </div>
  );
}
