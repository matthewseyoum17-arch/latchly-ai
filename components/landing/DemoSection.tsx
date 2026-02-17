"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, X } from "lucide-react";

const DENTAL_CONTEXT = {
  name: "Gainesville Family Dental",
  greeting:
    "Hi there! 👋 Welcome to Gainesville Family Dental. I can help with appointment booking, insurance questions, or anything else. How can I help you today?",
  quickReplies: [
    "Do you accept Delta Dental?",
    "What are your hours?",
    "I need an emergency appointment",
    "How much is a cleaning?",
  ],
};

interface Message {
  role: "bot" | "user";
  text: string;
}

export default function DemoSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        setMessages([{ role: "bot", text: DENTAL_CONTEXT.greeting }]);
      }, 400);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { role: "user", text: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsTyping(true);
    setShowQuickReplies(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          businessInfo: {
            name: DENTAL_CONTEXT.name,
            phone: "(352) 555-0123",
            pricing:
              "Routine Cleaning: $75–$150, Teeth Whitening: $300–$600, Dental Implant: $1,500–$3,000, Invisalign: $3,500–$6,000, Crown: $800–$1,500. Most insurance accepted.",
            hours:
              "Mon–Fri: 8:00 AM – 6:00 PM, Saturday: 9:00 AM – 2:00 PM, Sunday: Closed. Emergency line: (352) 555-0124",
            services:
              "General Dentistry (cleanings, fillings, exams), Cosmetic Dentistry (veneers, whitening, bonding), Orthodontics (Invisalign, braces), Oral Surgery (extractions, implants), Pediatric Dentistry. We accept Delta Dental, Cigna, Aetna, MetLife, and most PPO plans.",
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
    }
  };

  return (
    <section id="demo" className="py-20 px-5 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            Live Demo
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Try It Right Now
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            See how Latchly handles real customer questions for a dental office
          </p>
        </motion.div>

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
              www.gainesvilledental.com
            </div>
          </div>

          {/* Chat widget header */}
          <div className="bg-gradient-to-br from-brand to-brand-dark px-5 py-3.5 flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              🦷
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">{DENTAL_CONTEXT.name}</div>
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
              {DENTAL_CONTEXT.quickReplies.map((q) => (
                <button
                  key={q}
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
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
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
      </div>
    </section>
  );
}
