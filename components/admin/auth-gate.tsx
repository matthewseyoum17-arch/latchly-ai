"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

const SESSION_KEY = "latchly-admin-auth";

interface AuthGateProps {
  onAuth: () => void;
  title?: string;
  subtitle?: string;
}

// Single AuthGate used by every admin route through the shared layout. The
// session-storage key is unified ("latchly-admin-auth") so signing in once
// flows through to CRM, Cold Email, Pipeline, and any future page. Earlier
// pages used per-page keys (e.g. "latchly-leads-crm-auth"), which made the
// user re-sign-in when navigating between them.
export function AuthGate({
  onAuth,
  title = "Latchly Admin",
  subtitle = "Enter your dashboard password",
}: AuthGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Invalid password");
        return;
      }
      sessionStorage.setItem(SESSION_KEY, "1");
      onAuth();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 w-full max-w-sm">
        <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-5">
          <Lock size={20} />
        </div>
        <h1 className="text-xl font-bold text-center text-slate-950">{title}</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">{subtitle}</p>
        <form onSubmit={submit}>
          <div className="relative mb-4">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 pr-10 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showPw ? "Hide password" : "Show password"}
              title={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-teal-700 text-white font-bold text-sm disabled:opacity-50 hover:bg-teal-600 transition-colors"
          >
            {loading ? "Checking..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function isClientAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function clearClientAuth() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  // Clean up legacy keys from before unification.
  sessionStorage.removeItem("latchly-leads-crm-auth");
  sessionStorage.removeItem("latchly-pipeline-auth");
}

export const ADMIN_AUTH_SESSION_KEY = SESSION_KEY;
