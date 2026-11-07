import { NextRequest } from "next/server";
import { caseStore } from "@/lib/case-store";
import { apiError, readJson, requireOrigin, requireSession } from "@/lib/workspace-auth";
import { text } from "@/lib/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    requireSession(request);
    return Response.json(caseStore().snapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    requireSession(request);
    requireOrigin(request);
    const result = caseStore().execute(await readJson(request), text(request.headers.get("idempotency-key"), "Idempotency key", 100));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
