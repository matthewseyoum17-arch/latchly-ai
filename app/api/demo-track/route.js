import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) {
      return new Response(PIXEL, {
        status: 200,
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
      });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "";
    const referrer = request.headers.get("referer") || "";

    const sql = neon(process.env.DATABASE_URL);

    // Fire-and-forget insert — don't block the pixel response
    sql`
      INSERT INTO demo_visits (demo_slug, ip, user_agent, referrer)
      VALUES (${slug}, ${ip}, ${userAgent}, ${referrer})
    `.catch((err) => console.error("demo-track insert error:", err));

    return new Response(PIXEL, {
      status: 200,
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("demo-track error:", err);
    return new Response(PIXEL, {
      status: 200,
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  }
}
