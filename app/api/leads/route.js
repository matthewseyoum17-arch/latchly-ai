import { neon } from "@neondatabase/serverless";

export async function POST(request) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { name, phone, email, contactMethod, rating, industry, transcript } = await request.json();

    const result = await sql`
      INSERT INTO leads (name, phone, email, contact_method, rating, industry, transcript)
      VALUES (${name || null}, ${phone || null}, ${email || null}, ${contactMethod || null}, ${rating || null}, ${industry || null}, ${transcript || null})
      RETURNING id, created_at
    `;

    return Response.json({ success: true, id: result[0].id, created_at: result[0].created_at });
  } catch (error) {
    console.error("Lead insert error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const leads = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
    return Response.json({ leads });
  } catch (error) {
    console.error("Lead fetch error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
