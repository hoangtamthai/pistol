import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let sessionRequests: number[] = [];
const SESSION_WINDOW_MS = 60_000;
const MAX_SESSIONS_PER_WINDOW = 6;

function configured() {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID);
}

export async function GET() {
  return NextResponse.json({ configured: configured() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
  if (!origin || origin !== expectedOrigin) {
    return NextResponse.json({ error: "Start a voice session from this app’s own browser tab." }, { status: 403 });
  }
  if (!configured()) {
    return NextResponse.json({ error: "Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to .env.local, configure the agent using docs/elevenlabs.md, then restart the app." }, { status: 503 });
  }
  const now = Date.now();
  sessionRequests = sessionRequests.filter(time => now - time < SESSION_WINDOW_MS);
  if (sessionRequests.length >= MAX_SESSIONS_PER_WINDOW) {
    return NextResponse.json({ error: "Too many session requests. Try again in a minute." }, { status: 429 });
  }
  sessionRequests.push(now);

  try {
    const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
    url.searchParams.set("agent_id", process.env.ELEVENLABS_AGENT_ID!);
    const response = await fetch(url, {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "ElevenLabs could not create a session. Check your agent ID, API key permissions, and account credits." }, { status: 502 });
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("token" in result) || typeof result.token !== "string") {
      return NextResponse.json({ error: "ElevenLabs returned an invalid session response." }, { status: 502 });
    }
    return NextResponse.json({ token: result.token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Couldn’t reach ElevenLabs. Check the connection and try again. Guided demo mode is still available." }, { status: 502 });
  }
}
