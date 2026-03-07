import { NextRequest, NextResponse } from "next/server";
import { sendLeadNotification, LeadData } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body: LeadData = await request.json();

    if (!body.name || !body.phone) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    const result = await sendLeadNotification(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send notification", details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: result.emailId });
  } catch (error: any) {
    console.error("Notification API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
