"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, X } from "lucide-react";

const DEMO_PRESETS = {
  dental: {
    id: "dental",
    name: "Dental Office Demo",
    emoji: "🦷",
    greeting: "Hi there! 👋 Welcome to our dental office. I can help with appointment booking, insurance questions, or anything else. How can I help you today?",
    quickReplies: ["Do you accept Delta Dental?", "What are your hours?", "I need an emergency appointment", "How much is a cleaning?"],
    phone: "(352) 555-0123",
    pricing: "Routine Cleaning: $75 to $150, Teeth Whitening: $300 to $600, Dental Implant: $1,500 to $3,000, Crown: $800 to $1,500. Most insurance accepted.",
    hours: "Mon to Fri: 8:00 AM to 6:00 PM, Saturday: 9:00 AM to 2:00 PM, Sunday: Closed.",
    services: "General Dentistry, Cosmetic Dentistry, Orthodontics, Oral Surgery, Pediatric Dentistry. We accept Delta Dental, Cigna, Aetna, MetLife.",
  },
  hvac: {
    id: "hvac",
    name: "HVAC Company Demo",
    emoji: "❄️",
    greeting: "Hi there! 👋 Welcome to our HVAC company. I can help with scheduling, pricing, or answering any questions. How can I assist you today?",
    quickReplies: ["Do you service my area?", "What are your hours?", "I need emergency repair", "How much for AC repair?"],
    phone: "(352) 555-0456",
    pricing: "AC Repair: $85 to $250, Furnace Repair: $100 to $300, Installation: $3,000 to $8,000, Maintenance: $79 to $150.",
    hours: "Mon to Fri: 7:00 AM to 7:00 PM, Saturday: 8:00 AM to 5:00 PM, Sunday: Emergency calls only.",
    services: "AC Repair, Furnace Repair, Installation, Maintenance, Duct Cleaning, Thermostat Installation. Residential and commercial.",
  },
  medspa: {
    id: "medspa",
    name: "Med Spa Demo",
    emoji: "✨",
    greeting: "Hi there! 👋 Welcome to our med spa. I can help with treatments, pricing, or booking a consultation. How can I help you today?",
    quickReplies: ["What treatments do you offer?", "Do you offer consultations?", "What are your hours?", "How much is Botox?"],
    phone: "(352) 555-0789",
    pricing: "Botox: $12 to $15 per unit, Dermal Fillers: $500 to $800, Facials: $75 to $200, Laser Treatments: $200 to $1,500.",
    hours: "Mon to Fri: 9:00 AM to 6:00 PM, Saturday: 10:00 AM to 4:00 PM, Sunday: Closed.",
    services: "Botox, Dermal Fillers, Laser Treatments, Facials, Chemical Peels, Microneedling, Body Contouring.",
  },
  legal: {
    id: "legal",
    name: "Law Firm Demo",
    emoji: "⚖️",
    greeting: "Hi there! 👋 Welcome to our law firm. I can help answer questions about our services or schedule a consultation. How can I assist you today?",
    quickReplies: ["What types of cases do you handle?", "Do you offer free consultations?", "What are your hours?", "How do I schedule?"],
    phone: "(352) 555-0321",
    pricing: "Consultation: Free, Personal Injury: Contingency fee, Family Law: $200 to $400/hr, Criminal Defense: Flat fee or hourly.",
    hours: "Mon to Fri: 8:30 AM to 5:30 PM, Saturday: By appointment, Sunday: Closed.",
    services: "Personal Injury, Family Law, Criminal Defense, Estate Planning, Business Law, Real Estate Law.",
  },
};

type DemoPreset = keyof typeof DEMO_PRESETS;

interface Message {
  role: "bot" | "user";
  text: string;
}

export default function DemoSection() {
  const [selectedPreset, setSelectedPreset] = useState<DemoPreset>("dental");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef<number>(0);

  const currentPreset = DEMO_PRESETS[selectedPreset];

  useEffect(() => {
    const scrollYBefore = window.scrollY;
    setMessages([]);
    setShowQuickReplies(true);
    setTimeout(() => {
      setMessages([{ role: "bot", text: currentPreset.greeting }]);
      requestAnimationFrame(() => {
        if (window.scrollY !== scrollYBefore) {
          window.scrollTo(0, scrollYBefore);
        }
      });
    }, 400);
  }, [selectedPreset]);

  // Auto-scroll within the chat container only, never the page
  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const scrollYBefore = window.scrollY;
    scrollLockRef.current = scrollYBefore;
    
    const userMsg: Message = { role: "user", text: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsTyping(true);
    setShowQuickReplies(false);

    // Immediate scroll lock
    requestAnimationFrame(() => {
      if (window.scrollY !== scrollLockRef.current) {
        window.scrollTo(0, scrollLockRef.current);
      }
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          businessInfo: {
            name: currentPreset.name,
            phone: currentPreset.phone,
            pricing: currentPreset.pricing,
            hours: currentPreset.hours,
            services: currentPreset.services,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "bot", text: data.text }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
        },
      ]);
    } finally {
      setIsTyping(false);
      // Restore scroll position after all state updates
      setTimeout(() => {
        if (window.scrollY !== scrollLockRef.current) {
          window.scrollTo(0, scrollLockRef.current);
        }
      }, 0);
    }
  };

  return (
    <section id="demo" className="py-10 px-5 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-5"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            Live Demo
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Try It Right Now
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            See how Latchly qualifies leads and answers customer questions in real time
          </p>
        </motion.div>

        {/* Demo preset toggle */}
        <div className="flex justify-center gap-2 mb-4">
          {(Object.keys(DEMO_PRESETS) as DemoPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSelectedPreset(preset)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                selectedPreset === preset
                  ? "bg-brand text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-brand/50"
              }`}
            >
              {DEMO_PRESETS[preset].emoji} {DEMO_PRESETS[preset].name.replace(" Demo", "")}
            </button>
          ))}
        </div>

        {/* Browser frame mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-2xl mx-auto"
        >
          {/* Browser bar */}
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 border border-slate-200 font-mono">
              demo.yourbusiness.com
            </div>
          </div>

          {/* Chat widget header */}
          <div className="bg-gradient-to-br from-brand to-brand-dark px-5 py-3.5 flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {currentPreset.emoji}
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">{currentPreset.name}</div>
              <div className="text-xs opacity-80 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Online now · Replies instantly
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div className="h-80 overflow-y-auto p-4 bg-slate-50 space-y-3">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-brand text-white rounded-2xl rounded-br-sm"
                      : "bg-white text-slate-700 rounded-2xl rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-slate-300 inline-block"
                      style={{
                        animation: `bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          {showQuickReplies && messages.length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2 bg-slate-50">
              {currentPreset.quickReplies.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-brand/25 text-brand bg-brand/5 hover:bg-brand/10 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 border-t border-slate-100 bg-white flex gap-2 items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isTyping || !input.trim()}
              className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-brand-dark transition-colors cursor-pointer"
            >
              <Send size={16} />
            </button>
          </div>
        </motion.div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Sample demo experience. Not a real customer.
        </p>
      </div>
    </section>
  );
}
