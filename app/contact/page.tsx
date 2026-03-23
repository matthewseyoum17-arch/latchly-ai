"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Send, Zap } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", business: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav bar */}
      <nav className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center h-16 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white shadow-glow-brand">
              <Zap size={16} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-[19px] tracking-tight text-slate-900">Latchly</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-16">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left — info */}
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 mb-4">
              Get in Touch
            </h1>
            <p className="text-slate-500 leading-relaxed mb-8">
              Have a question about Latchly? Want to see a custom demo for your business?
              We&apos;d love to hear from you.
            </p>
            <div className="space-y-4 text-sm text-slate-600">
              <div>
                <div className="font-bold text-slate-800 mb-1">Email</div>
                <a href="mailto:matt@latchlyai.com" className="text-brand hover:underline">matt@latchlyai.com</a>
              </div>
              <div>
                <div className="font-bold text-slate-800 mb-1">Phone</div>
                <a href="tel:+17863900299" className="text-brand hover:underline">(786) 390-0299</a>
              </div>
              <div>
                <div className="font-bold text-slate-800 mb-1">Hours</div>
                <span>Mon – Fri, 9am – 6pm ET</span>
              </div>
              <div>
                <div className="font-bold text-slate-800 mb-1">Location</div>
                <span>Gainesville, FL</span>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div>
            {submitted ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <CheckCircle size={40} className="text-brand mx-auto mb-4" />
                <h2 className="font-display text-2xl font-black text-slate-900 mb-2">Message Sent</h2>
                <p className="text-sm text-slate-500">We&apos;ll get back to you within 1 business day.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Business Name</label>
                  <input
                    type="text"
                    value={form.business}
                    onChange={(e) => setForm({ ...form, business: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send Message"}
                  {!loading && <Send size={14} />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
