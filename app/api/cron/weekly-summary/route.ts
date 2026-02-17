import { NextRequest, NextResponse } from "next/server";
import { sendWeeklySummary } from "@/lib/weeklySummary";

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendWeeklySummary();
    if (!result.success) {
      return NextResponse.json({ error: "Failed to send summary", details: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, emailId: result.emailId });
  } catch (error: any) {
    console.error("Cron weekly summary error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
