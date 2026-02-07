import { neon } from "@neondatabase/serverless";

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        contact_method TEXT,
        rating INT,
        industry TEXT,
        transcript TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        business TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return Response.json({ success: true, message: "Tables created successfully: leads, subscribers, contacts" });
  } catch (error) {
    console.error("Setup error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
