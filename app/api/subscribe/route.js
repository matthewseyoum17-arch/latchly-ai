import { neon } from "@neondatabase/serverless";

export async function POST(request) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    await sql`
      INSERT INTO subscribers (email)
      VALUES (${email})
      ON CONFLICT (email) DO NOTHING
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const subscribers = await sql`SELECT * FROM subscribers ORDER BY created_at DESC`;
    return Response.json({ subscribers });
  } catch (error) {
    console.error("Subscriber fetch error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
