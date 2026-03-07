import { neon } from "@neondatabase/serverless";

export async function POST(request) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { name, email, business, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json({ error: "Name, email, and message are required" }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO contacts (name, email, business, message)
      VALUES (${name}, ${email}, ${business || null}, ${message})
      RETURNING id, created_at
    `;

    return Response.json({ success: true, id: result[0].id, created_at: result[0].created_at });
  } catch (error) {
    console.error("Contact insert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const contacts = await sql`SELECT * FROM contacts ORDER BY created_at DESC`;
    return Response.json({ contacts });
  } catch (error) {
    console.error("Contact fetch error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
