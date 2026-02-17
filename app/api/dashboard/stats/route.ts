import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const [totalLeads] = await sql`SELECT COUNT(*) as count FROM leads`;
    const [todayLeads] = await sql`SELECT COUNT(*) as count FROM leads WHERE created_at >= CURRENT_DATE`;
    const [weekLeads] = await sql`SELECT COUNT(*) as count FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`;
    const [avgRating] = await sql`SELECT COALESCE(AVG(rating), 0) as avg FROM leads WHERE rating IS NOT NULL`;

    const recentLeads = await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 10`;

    const industryBreakdown = await sql`
      SELECT industry, COUNT(*) as count 
      FROM leads 
      WHERE industry IS NOT NULL 
      GROUP BY industry 
      ORDER BY count DESC
    `;

    return NextResponse.json({
      stats: {
        totalLeads: Number(totalLeads.count),
        todayLeads: Number(todayLeads.count),
        weekLeads: Number(weekLeads.count),
        avgRating: Number(Number(avgRating.avg).toFixed(1)),
      },
      recentLeads,
      industryBreakdown,
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
