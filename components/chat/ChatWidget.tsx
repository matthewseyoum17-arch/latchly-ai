"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, MessageSquare, Star, Check, CalendarCheck, ExternalLink } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BusinessHours {
  [key: string]: string;
}

export interface ChatWidgetConfig {
  brandColor?: string;
  businessName?: string;
  logoUrl?: string;
  avatarUrl?: string;
  greeting?: string;
  businessType?: "dental" | "hvac" | "legal" | "medspa" | "plumbing" | "realestate" | "salon";
  hours?: BusinessHours;
  nudgeDelay?: number;
  plan?: "solo" | "team" | "multi";
  calendlyUrl?: string;
}

interface Message {
  role: "bot" | "user";
  text: string;
  time: Date;
}

// ── Quick Reply Presets ────────────────────────────────────────────────────────

const QUICK_REPLIES: Record<string, string[]> = {
  dental: ["Book an appointment", "Insurance questions", "Emergency care", "Office hours"],
  hvac: ["Schedule service", "Emergency repair", "Get a quote", "Service area"],
  legal: ["Free consultation", "Practice areas", "Office hours", "Contact attorney"],
  medspa: ["Book a consultation", "Treatment pricing", "Hours & location", "Current specials"],
  plumbing: ["Get a quote", "Emergency plumbing", "Hours & service area", "Drain cleaning"],
  realestate: ["Search listings", "Home valuation", "Hours & location", "Selling my home"],
  salon: ["Book Appointment", "Services & Pricing", "Hours & Location", "Stylists & Specials"],
};

// ── Business Hours Helpers ─────────────────────────────────────────────────────

function isCurrentlyOpen(hours?: BusinessHours): boolean {
  if (!hours) return true;
  const now = new Date();
  const dayIndex = now.getDay();
  const currentDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayIndex];

  let matchedValue: string | undefined;
  for (const [key, val] of Object.entries(hours)) {
    const parts = key.toLowerCase().split("-");
    if (parts.length === 2) {
      const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      const startIdx = dayOrder.indexOf(parts[0]);
      const endIdx = dayOrder.indexOf(parts[1]);
      const curIdx = dayOrder.indexOf(currentDay);
      if (startIdx !== -1 && endIdx !== -1 && curIdx >= startIdx && curIdx <= endIdx) {
        matchedValue = val;
        break;
      }
    } else if (parts[0] === currentDay) {
      matchedValue = val;
      break;
    }
  }

  if (!matchedValue || matchedValue.toLowerCase() === "closed") return false;

  const timeMatch = matchedValue.match(/(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)/i);
  if (!timeMatch) return true;

  let openHour = parseInt(timeMatch[1]);
  const openAmPm = timeMatch[2].toLowerCase();
  let closeHour = parseInt(timeMatch[3]);
  const closeAmPm = timeMatch[4].toLowerCase();

  if (openAmPm === "pm" && openHour !== 12) openHour += 12;
  if (openAmPm === "am" && openHour === 12) openHour = 0;
  if (closeAmPm === "pm" && closeHour !== 12) closeHour += 12;
  if (closeAmPm === "am" && closeHour === 12) closeHour = 0;

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const nowMinutes = currentHour * 60 + currentMin;
  return nowMinutes >= openHour * 60 && nowMinutes < closeHour * 60;
}

// ── Typing Indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full bg-slate-300 inline-block"
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Proactive Nudge ────────────────────────────────────────────────────────────

function ProactiveNudge({
  businessName,
  onDismiss,
  onClick,
}: {
  businessName: string;
  onDismiss: () => void;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-[72px] right-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 cursor-pointer"
      onClick={onClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
      >
        <X size={10} />
      </button>
      <p className="text-sm text-slate-700 leading-relaxed pr-4">
        Hi! Need help? I can answer questions about{" "}
        <span className="font-bold text-slate-900">{businessName}</span> 24/7
      </p>
      {/* Tail arrow */}
      <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-slate-200/80 rotate-45" />
    </motion.div>
  );
}

// ── Main Chat Widget ───────────────────────────────────────────────────────────

// ── Booking Intent Detection ───────────────────────────────────────────────────

const BOOKING_KEYWORDS = [
  "book", "schedule", "appointment", "consultation", "estimate",
  "reserve", "set up a time", "available times", "open slots",
  "make an appointment", "book a time", "schedule a visit",
];

function detectBookingIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

export default function ChatWidget({ config = {} }: { config?: ChatWidgetConfig }) {
  const {
    brandColor = "#0e7c6b",
    businessName = "Latchly Demo",
    logoUrl,
    avatarUrl,
    greeting,
    businessType = "dental",
    hours,
    nudgeDelay = 5000,
    plan = "solo",
    calendlyUrl,
  } = config;

  const hasBooking = (plan === "team" || plan === "multi") && !!calendlyUrl;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [chatPhase, setChatPhase] = useState<"chat" | "booking" | "rating" | "leadCapture" | "complete">("chat");
  const [bookingForm, setBookingForm] = useState({ name: "", email: "", phone: "", service: "" });
  const [bookingStep, setBookingStep] = useState(0);
  const [rating, setRating] = useState(0);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "" });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = isCurrentlyOpen(hours);
  const quickReplies = QUICK_REPLIES[businessType] || QUICK_REPLIES.dental;

  const getGreeting = useCallback(() => {
    if (greeting) return greeting;
    if (!open) {
      return `We're currently closed, but I can still help! Leave your info and our team will follow up first thing tomorrow.`;
    }
    return `Hi there! 👋 Welcome to ${businessName}. I can answer questions, qualify your needs, and ${hasBooking ? "book an appointment" : "connect you with our team"}. How can I help?`;
  }, [greeting, open, businessName, hasBooking]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const timer = setTimeout(() => {
        setMessages([{ role: "bot", text: getGreeting(), time: new Date() }]);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length, getGreeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 500);
  }, [isOpen]);

  // Proactive nudge
  useEffect(() => {
    if (isOpen || nudgeDismissed) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("latchly-nudge-dismissed")) {
      setNudgeDismissed(true);
      return;
    }
    const timer = setTimeout(() => {
      if (!isOpen) setShowNudge(true);
    }, nudgeDelay);
    return () => clearTimeout(timer);
  }, [isOpen, nudgeDismissed, nudgeDelay]);

  const dismissNudge = () => {
    setShowNudge(false);
    setNudgeDismissed(true);
    if (typeof window !== "undefined") sessionStorage.setItem("latchly-nudge-dismissed", "1");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { role: "user", text: text.trim(), time: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsTyping(true);
    setShowQuickReplies(false);

    // Booking intent detection
    if (detectBookingIntent(text.trim())) {
      setTimeout(() => {
        if (hasBooking) {
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              text: "I'd love to help you book an appointment! Let me collect a few details first.",
              time: new Date(),
            },
          ]);
          setIsTyping(false);
          setChatPhase("booking");
          setBookingStep(0);
        } else {
          // Solo plan: no booking, offer callback
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              text: "Appointment booking is available on the Team plan. I can still capture your info so the team can call you back to schedule. Would you like to leave your contact details?",
              time: new Date(),
            },
          ]);
          setIsTyping(false);
        }
      }, 600);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          businessInfo: {
            name: businessName,
            phone: "(352) 555-0123",
            pricing: "Contact us for pricing details.",
            hours: hours ? JSON.stringify(hours) : "Mon-Fri 8am-5pm",
            services: "Full range of services. Ask me for details!",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "bot", text: data.text, time: new Date() }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Sorry, I'm having trouble connecting right now. Please try again!",
          time: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleLeadSubmit = async () => {
    if (!leadForm.name || !leadForm.phone) return;
    setLeadSubmitting(true);
    try {
      const transcript = messages.map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${m.text}`).join("\n");
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadForm.name,
          phone: leadForm.phone,
          email: leadForm.email,
          rating,
          industry: businessType,
          transcript,
        }),
      });
    } catch (err) {
      console.error("Lead save failed:", err);
    } finally {
      setLeadSubmitting(false);
      setChatPhase("complete");
    }
  };

  // CSS custom properties for brand color
  const brandStyle = { "--brand": brandColor } as React.CSSProperties;

  return (
    <div style={brandStyle}>
      {/* FAB + Nudge */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-[9999]"
          >
            {/* Nudge bubble */}
            <AnimatePresence>
              {showNudge && !isOpen && (
                <ProactiveNudge
                  businessName={businessName}
                  onDismiss={dismissNudge}
                  onClick={() => {
                    dismissNudge();
                    setIsOpen(true);
                  }}
                />
              )}
            </AnimatePresence>

            {/* FAB button */}
            <button
              onClick={() => {
                setIsOpen(true);
                dismissNudge();
              }}
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
              className="w-14 h-14 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center relative cursor-pointer"
            >
              <MessageSquare size={22} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center">
                1
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[10000] border border-slate-100 max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:h-full max-sm:rounded-none"
          >
            {/* Header */}
            <div
              style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
              className="text-white px-5 py-4 flex items-center gap-3 shrink-0"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">
                  {businessType === "dental" && "🦷"}
                  {businessType === "hvac" && "❄️"}
                  {businessType === "legal" && "⚖️"}
                  {businessType === "medspa" && "💆"}
                  {businessType === "plumbing" && "🔧"}
                  {businessType === "realestate" && "🏠"}
                  {businessType === "salon" && "💅"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{businessName}</div>
                <div className="text-xs opacity-80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                  Online now · Replies instantly
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Chat Phase ── */}
            {chatPhase === "chat" && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
                    >
                      {/* Avatar for bot messages */}
                      {msg.role === "bot" && avatarUrl && (
                        <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-1" />
                      )}
                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line ${
                          msg.role === "user"
                            ? "text-white rounded-2xl rounded-br-sm"
                            : "bg-white text-slate-700 rounded-2xl rounded-bl-sm shadow-sm"
                        }`}
                        style={msg.role === "user" ? { background: brandColor } : undefined}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                {showQuickReplies && messages.length > 0 && messages.length <= 2 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1.5 bg-slate-50">
                    {quickReplies.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                        style={{
                          border: `1px solid ${brandColor}33`,
                          color: brandColor,
                          background: `${brandColor}08`,
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="px-4 py-3 border-t border-slate-100 bg-white flex gap-2 items-center shrink-0">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                    placeholder="Type your message..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50 transition-colors"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={isTyping || !input.trim()}
                    style={{ background: brandColor }}
                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={16} />
                  </button>
                </div>

                {/* End conversation */}
                <div className="px-4 pb-2 bg-white flex justify-end">
                  <button
                    onClick={() => setChatPhase("rating")}
                    className="text-[10px] text-red-500 font-semibold hover:underline cursor-pointer"
                  >
                    End conversation
                  </button>
                </div>
              </>
            )}

            {/* ── Booking Phase (Team+ only) ── */}
            {chatPhase === "booking" && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${brandColor}15`, color: brandColor }}
                  >
                    <CalendarCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Book an Appointment</h3>
                    <p className="text-xs text-slate-400">We just need a few details</p>
                  </div>
                </div>

                {/* Step-by-step booking form, one question at a time */}
                {bookingStep >= 0 && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Your name *</label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      value={bookingForm.name}
                      onChange={(e) => setBookingForm((p) => ({ ...p, name: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && bookingForm.name && setBookingStep(1)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50"
                      autoFocus
                    />
                  </div>
                )}

                {bookingStep >= 1 && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Phone number *</label>
                    <input
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={bookingForm.phone}
                      onChange={(e) => setBookingForm((p) => ({ ...p, phone: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && bookingForm.phone && setBookingStep(2)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50"
                      autoFocus
                    />
                  </div>
                )}

                {bookingStep >= 2 && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">Email *</label>
                    <input
                      type="email"
                      placeholder="john@email.com"
                      value={bookingForm.email}
                      onChange={(e) => setBookingForm((p) => ({ ...p, email: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && bookingForm.email && setBookingStep(3)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50"
                      autoFocus
                    />
                  </div>
                )}

                {bookingStep >= 3 && (
                  <div className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">What service do you need?</label>
                    <input
                      type="text"
                      placeholder="e.g. Cleaning, consultation, emergency"
                      value={bookingForm.service}
                      onChange={(e) => setBookingForm((p) => ({ ...p, service: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50"
                      autoFocus
                    />
                  </div>
                )}

                {/* Progress + Next button */}
                {bookingStep < 3 && (
                  <button
                    onClick={() => setBookingStep((s) => s + 1)}
                    disabled={
                      (bookingStep === 0 && !bookingForm.name) ||
                      (bookingStep === 1 && !bookingForm.phone) ||
                      (bookingStep === 2 && !bookingForm.email)
                    }
                    style={{
                      background:
                        (bookingStep === 0 && bookingForm.name) ||
                        (bookingStep === 1 && bookingForm.phone) ||
                        (bookingStep === 2 && bookingForm.email)
                          ? brandColor
                          : "#cbd5e1",
                    }}
                    className="w-full py-2.5 rounded-xl text-white font-bold text-sm mt-2 cursor-pointer disabled:cursor-default"
                  >
                    Next
                  </button>
                )}

                {/* Final: open Calendly with prefilled info */}
                {bookingStep >= 3 && (
                  <div className="mt-3 space-y-2">
                    <a
                      href={`${calendlyUrl}?name=${encodeURIComponent(bookingForm.name)}&email=${encodeURIComponent(bookingForm.email)}&a1=${encodeURIComponent(bookingForm.phone)}&a2=${encodeURIComponent(bookingForm.service)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        // Save lead with booking intent
                        const transcript = messages.map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${m.text}`).join("\n");
                        fetch("/api/leads", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: bookingForm.name,
                            phone: bookingForm.phone,
                            email: bookingForm.email,
                            industry: businessType,
                            contactMethod: "booking",
                            transcript: transcript + `\n[Booking intent: ${bookingForm.service}]`,
                          }),
                        }).catch((err) => console.error("Lead save failed:", err));
                      }}
                      style={{ background: brandColor }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-bold text-sm"
                    >
                      <CalendarCheck size={16} /> Choose a Time on Calendly <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => setChatPhase("complete")}
                      className="w-full py-2 text-xs text-slate-500 font-semibold hover:text-slate-700 cursor-pointer"
                    >
                      I already booked / Done
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Rating Phase ── */}
            {chatPhase === "rating" && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="text-5xl mb-4">💬</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">How was your experience?</h3>
                <p className="text-sm text-slate-500 mb-6">Your feedback helps us improve</p>
                <div className="flex gap-2 mb-6">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setRating(s)}
                      className="p-1 cursor-pointer transition-transform"
                      style={{ transform: s <= rating ? "scale(1.2)" : "scale(1)" }}
                    >
                      <Star
                        size={24}
                        className={s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-300"}
                      />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setChatPhase("leadCapture")}
                  disabled={!rating}
                  style={{ background: rating ? brandColor : "#cbd5e1" }}
                  className="px-8 py-3 rounded-xl text-white font-bold text-sm cursor-pointer disabled:cursor-default"
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Lead Capture Phase ── */}
            {chatPhase === "leadCapture" && (
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Stay connected!</h3>
                <p className="text-sm text-slate-500 mb-5">
                  {!open
                    ? "Leave your info and we'll follow up first thing tomorrow."
                    : "Leave your info and we'll follow up personally."}
                </p>
                {[
                  { key: "name" as const, label: "Full Name *", type: "text", ph: "John Smith" },
                  { key: "phone" as const, label: "Phone Number *", type: "tel", ph: "(555) 000-0000" },
                  { key: "email" as const, label: "Email (optional)", type: "email", ph: "john@email.com" },
                ].map((f) => (
                  <div key={f.key} className="mb-3">
                    <label className="text-xs font-semibold text-slate-500 block mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.ph}
                      value={leadForm[f.key]}
                      onChange={(e) => setLeadForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50"
                    />
                  </div>
                ))}
                <button
                  onClick={handleLeadSubmit}
                  disabled={!leadForm.name || !leadForm.phone || leadSubmitting}
                  style={{
                    background: leadForm.name && leadForm.phone && !leadSubmitting ? brandColor : "#cbd5e1",
                  }}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm mt-3 cursor-pointer disabled:cursor-default"
                >
                  {leadSubmitting ? "Submitting..." : "Send my info →"}
                </button>
              </div>
            )}

            {/* ── Complete Phase ── */}
            {chatPhase === "complete" && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: `${brandColor}15`, color: brandColor }}
                >
                  <Check size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">You&apos;re all set! 🎉</h3>
                <p className="text-sm text-slate-500 mb-6">The team will reach out shortly.</p>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ background: brandColor }}
                  className="px-8 py-3 rounded-xl text-white font-bold text-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-1.5 text-center text-[10px] text-slate-400 bg-white shrink-0">
              🔒 We don&apos;t store payment info · Powered by{" "}
              <span className="font-bold" style={{ color: brandColor }}>
                Latchly
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
