import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { CaseError } from "./issues";

export const SESSION_COOKIE = "relay-session";
export const SESSION_SECONDS = 8 * 60 * 60;
export function authConfigured() { return (process.env.RELAY_WORKSPACE_PASSWORD?.length || 0) >= 16; }
function digest(value: string) { return createHash("sha256").update(value).digest(); }
export function passwordMatches(password: string) {
  return authConfigured() && timingSafeEqual(digest(password), digest(process.env.RELAY_WORKSPACE_PASSWORD!));
}
function sign(value: string) { return createHmac("sha256", process.env.RELAY_WORKSPACE_PASSWORD!).update(`relay-local-session:${value}`).digest("hex"); }
export function createSession(time = Date.now()) {
  if (!authConfigured()) throw new CaseError("Set RELAY_WORKSPACE_PASSWORD to at least 16 characters in .env.local.", 503);
  const expires = String(time + SESSION_SECONDS * 1000);
  return `${expires}.${sign(expires)}`;
}
export function validSession(token: string | undefined, time = Date.now()) {
  if (!authConfigured() || !token || token.length > 100) return false;
  const [expires, signature, extra] = token.split(".");
  if (extra || !/^\d+$/.test(expires) || Number(expires) <= time || Number(expires) > time + SESSION_SECONDS * 1000 || !/^[a-f0-9]{64}$/.test(signature || "")) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(expires), "hex"));
}
export function requireSession(request: NextRequest) {
  if (!authConfigured()) throw new CaseError("Set RELAY_WORKSPACE_PASSWORD (at least 16 characters) in .env.local and restart.", 503);
  if (!validSession(request.cookies.get(SESSION_COOKIE)?.value)) throw new CaseError("Sign in to the local workspace.", 401);
}
export function requireOrigin(request: NextRequest) {
  const expected = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
  if (request.headers.get("origin") !== expected) throw new CaseError("Use this app’s own browser tab.", 403);
}
export async function readJson(request: Request): Promise<unknown> {
  const maxBytes = 20_000;
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new CaseError("Send application/json.", 415);
  if (!request.body) throw new CaseError("Request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) { await reader.cancel(); throw new CaseError("Request exceeds 20 KB.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) { if (error instanceof CaseError) throw error; throw new CaseError("Invalid JSON body."); }
  finally { reader.releaseLock(); }
}
export function apiError(error: unknown) {
  return Response.json({ error: error instanceof CaseError ? error.message : "The local operation failed. Retry with the same request key or check database permissions." }, { status: error instanceof CaseError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
