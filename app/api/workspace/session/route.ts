import { NextRequest, NextResponse } from "next/server";
import { apiError, createSession, passwordMatches, readJson, requireOrigin, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/workspace-auth";
import { CaseError, object, text } from "@/lib/issues";

export const runtime = "nodejs";
let attempts: number[] = [];
export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    attempts = attempts.filter(time => Date.now() - time < 60_000);
    if (attempts.length >= 10) throw new CaseError("Too many sign-in attempts. Wait a minute.", 429);
    attempts.push(Date.now());
    const body = object(await readJson(request));
    if (!passwordMatches(text(body.password, "Password", 1000))) throw new CaseError("Incorrect password or workspace authentication is not configured.", 401);
    const response = NextResponse.json({ signedIn: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, createSession(), { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    requireOrigin(request);
    const response = NextResponse.json({ signedIn: false });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
