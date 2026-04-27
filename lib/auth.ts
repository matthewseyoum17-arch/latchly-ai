import { createHmac, timingSafeEqual } from "crypto";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || DASHBOARD_PASSWORD;

export const DASHBOARD_SESSION_COOKIE = "latchly_dashboard_session";

export function verifyDashboardAuth(password: string): boolean {
  return Boolean(DASHBOARD_PASSWORD) && password === DASHBOARD_PASSWORD;
}

export function createDashboardSessionToken(): string {
  if (!SESSION_SECRET || !DASHBOARD_PASSWORD) return "";
  const digest = createHmac("sha256", SESSION_SECRET)
    .update(`dashboard:${DASHBOARD_PASSWORD}`)
    .digest("hex");
  return `v1.${digest}`;
}

export function verifyDashboardSessionToken(token?: string | null): boolean {
  const expected = createDashboardSessionToken();
  if (!token || !expected) return false;

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  if (tokenBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function verifyDashboardRequest(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): boolean {
  return verifyDashboardSessionToken(request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value);
}
