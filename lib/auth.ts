// Simple password-based auth for the dashboard
// In production, replace with a proper auth solution (NextAuth, Clerk, etc.)

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

export function verifyDashboardAuth(password: string): boolean {
  return password === DASHBOARD_PASSWORD;
}
