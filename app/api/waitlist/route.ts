import type { NextRequest } from "next/server";
import { CaseError } from "@/lib/issues";
import { joinWaitlist } from "@/lib/waitlist";
import { readJson, requireOrigin } from "@/lib/workspace-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    joinWaitlist(await readJson(request));
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof CaseError ? error.message : "We couldn’t save your email. Please try again in a moment." }, {
      status: error instanceof CaseError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
