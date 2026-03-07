"use client";

export default function DashboardPreview() {
  const stats = [{label:"Total Chats",value:"1,247",change:"+18%"},{label:"Leads Captured",value:"342",change:"+24%"},{label:"After-Hours Leads",value:"156",change:"+31%"},{label:"Conversion Rate",value:"27.4%",change:"+5.2%"}];
  const leads = [{name:"Sarah M.",time:"2 min ago",source:"After hours",rating:5},{name:"James K.",time:"18 min ago",source:"Mobile",rating:4},{name:"Lisa P.",time:"1 hr ago",source:"Quick reply",rating:5},{name:"Mike R.",time:"3 hrs ago",source:"After hours",rating:4}];
  return (
    <div style={{ background:"#0f172a",borderRadius:20,padding:28,color:"#fff",boxShadow:"0 40px 80px rgba(0,0,0,0.3)" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div><div style={{ fontSize:11,color:"#64748b",fontWeight:600,textTransform:"uppercase",letterSpacing:1.5 }}>Owner Dashboard</div><div style={{ fontSize:20,fontWeight:800,marginTop:2 }}>This Week&#39;s Performance</div></div>
        <div style={{ padding:"6px 14px",borderRadius:8,background:"#1e293b",fontSize:12,color:"#94a3b8" }}>Jan 27 – Feb 2</div>
      </div>
      <div className="dashboard-stats-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24 }}>
        {stats.map(s=><div key={s.label} style={{ background:"#1e293b",borderRadius:14,padding:"16px 14px" }}><div style={{ fontSize:11,color:"#64748b",fontWeight:600,marginBottom:6 }}>{s.label}</div><div style={{ fontSize:22,fontWeight:800 }}>{s.value}</div><div style={{ fontSize:12,color:"#4ade80",fontWeight:600,marginTop:2 }}>↑ {s.change}</div></div>)}
      </div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:24 }}>
        {[{label:"Captured",count:12,bg:"#334155"},{label:"Contacted",count:8,bg:"#2563eb"},{label:"Booked",count:6,bg:"#10b981"},{label:"Completed",count:5,bg:"#065f46"}].map((stage,i,arr)=>(
          <div key={stage.label} style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ background:stage.bg,borderRadius:12,padding:"10px 20px",textAlign:"center",minWidth:90 }}>
              <div style={{ fontSize:18,fontWeight:800 }}>{stage.count}</div>
              <div style={{ fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:1 }}>{stage.label}</div>
            </div>
            {i<arr.length-1&&<span style={{ color:"#475569",fontSize:16,fontWeight:700 }}>›</span>}
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <div style={{ background:"#1e293b",borderRadius:14,padding:16 }}>
          <div style={{ fontSize:13,fontWeight:700,marginBottom:12 }}>Recent Leads</div>
          {leads.map((l,i)=><div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:i?"1px solid #2d3a4f":"none" }}><div><div style={{ fontSize:13,fontWeight:600 }}>{l.name}</div><div style={{ fontSize:11,color:"#64748b" }}>{l.time} • {l.source}</div></div><div style={{ color:"#f59e0b" }}>{Array(l.rating).fill(0).map((_,j)=><span key={j} style={{ fontSize:10 }}>★</span>)}</div></div>)}
        </div>
        <div style={{ background:"#1e293b",borderRadius:14,padding:16 }}>
          <div style={{ fontSize:13,fontWeight:700,marginBottom:12 }}>Top Questions This Week</div>
          {["What are your hours?","How much does it cost?","Do you accept insurance?","Can I book same-day?","Where are you located?"].map((q,i)=><div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:i?"1px solid #2d3a4f":"none",fontSize:12.5 }}><span style={{ color:"#cbd5e1" }}>{q}</span><span style={{ color:"#64748b",fontWeight:600 }}>{[89,67,54,41,38][i]}</span></div>)}
        </div>
      </div>
    </div>
  );
}
