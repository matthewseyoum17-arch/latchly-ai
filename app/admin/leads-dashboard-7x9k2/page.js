"use client";
import { useState, useEffect } from "react";

const Stars = ({ count }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} style={{ color: i <= (count || 0) ? "#f59e0b" : "#334155", fontSize: 14 }}>★</span>
    ))}
  </div>
);

const StatCard = ({ label, value, sub }) => (
  <div style={{ background: "#1e293b", borderRadius: 14, padding: "20px 24px", flex: 1 }}>
    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function LeadsDashboard() {
  const [leads, setLeads] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("leads");
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads").then(r => r.json()).then(d => setLeads(d.leads || [])).catch(console.error).finally(() => setLoading(false));
    fetch("/api/subscribe").then(r => r.json()).then(d => setSubscribers(d.subscribers || [])).catch(console.error);
    fetch("/api/contact").then(r => r.json()).then(d => setContacts(d.contacts || [])).catch(console.error);
  }, []);

  const todayCount = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length;
  const industryBreakdown = leads.reduce((acc, l) => { acc[l.industry || "unknown"] = (acc[l.industry || "unknown"] || 0) + 1; return acc; }, {});
  const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  if (loading) return <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>Loading dashboard...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", padding: "32px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: 0 }}>SitePulse AI — Admin Dashboard</h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Real-time lead capture data</p>
          </div>
          <button onClick={() => { setLoading(true); fetch("/api/leads").then(r => r.json()).then(d => setLeads(d.leads || [])).finally(() => setLoading(false)); }} style={{ padding: "8px 16px", borderRadius: 8, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>↻ Refresh</button>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          <StatCard label="Total Leads" value={leads.length} />
          <StatCard label="Today" value={todayCount} sub={todayCount > 0 ? "New leads today" : "No leads yet today"} />
          <StatCard label="Subscribers" value={subscribers.length} />
          <StatCard label="Industries" value={Object.keys(industryBreakdown).length} sub={Object.entries(industryBreakdown).map(([k, v]) => `${k}: ${v}`).join(" · ")} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["leads", "subscribers", "contacts"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", background: activeTab === tab ? "#0e7c6b" : "#1e293b", color: activeTab === tab ? "#fff" : "#94a3b8" }}>{tab === "leads" ? `Leads (${leads.length})` : tab === "subscribers" ? `Subscribers (${subscribers.length})` : `Contact Forms (${contacts.length})`}</button>
          ))}
        </div>

        {activeTab === "contacts" ? (
          <div style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1.2fr 2fr 1fr", padding: "12px 20px", background: "#0f172a", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
              <div>Name</div><div>Email</div><div>Business</div><div>Message</div><div>Date</div>
            </div>
            {contacts.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>No contact form submissions yet.</div>
            ) : contacts.map(c => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1.2fr 2fr 1fr", padding: "14px 20px", borderTop: "1px solid #334155", fontSize: 13, alignItems: "center" }}>
                <div style={{ fontWeight: 600, color: "#fff" }}>{c.name || "—"}</div>
                <div style={{ color: "#94a3b8" }}>{c.email || "—"}</div>
                <div>{c.business || "—"}</div>
                <div style={{ color: "#cbd5e1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.message || "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{fmt(c.created_at)}</div>
              </div>
            ))}
          </div>
        ) : activeTab === "leads" ? (
          <div style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 0.8fr 0.6fr 0.8fr 1.2fr", padding: "12px 20px", background: "#0f172a", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
              <div>Name</div><div>Phone</div><div>Email</div><div>Method</div><div>Rating</div><div>Industry</div><div>Date</div>
            </div>
            {leads.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>No leads captured yet. They'll appear here in real time.</div>
            ) : leads.map((lead, i) => (
              <div key={lead.id}>
                <div onClick={() => setExpandedRow(expandedRow === i ? null : i)} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1.5fr 0.8fr 0.6fr 0.8fr 1.2fr", padding: "14px 20px", borderTop: "1px solid #334155", cursor: "pointer", fontSize: 13, alignItems: "center", background: expandedRow === i ? "#334155" : "transparent", transition: "background 0.2s" }}>
                  <div style={{ fontWeight: 600, color: "#fff" }}>{lead.name || "—"}</div>
                  <div>{lead.phone || "—"}</div>
                  <div style={{ color: "#94a3b8" }}>{lead.email || "—"}</div>
                  <div>{lead.contact_method || "—"}</div>
                  <Stars count={lead.rating} />
                  <div><span style={{ padding: "2px 8px", borderRadius: 6, background: "#0e7c6b20", color: "#4ade80", fontSize: 11, fontWeight: 600 }}>{lead.industry || "—"}</span></div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{fmt(lead.created_at)}</div>
                </div>
                {expandedRow === i && lead.transcript && (
                  <div style={{ padding: "16px 20px", borderTop: "1px solid #334155", background: "#0f172a" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Conversation Transcript</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto" }}>{lead.transcript}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", padding: "12px 20px", background: "#0f172a", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
              <div>Email</div><div>Subscribed</div>
            </div>
            {subscribers.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 14 }}>No subscribers yet.</div>
            ) : subscribers.map(sub => (
              <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr", padding: "14px 20px", borderTop: "1px solid #334155", fontSize: 13 }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>{sub.email}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{fmt(sub.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
