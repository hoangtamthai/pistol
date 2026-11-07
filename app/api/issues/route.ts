import { NextRequest } from "next/server";
import { caseStore } from "@/lib/case-store";
import { issueLifecycle } from "@/lib/lifecycle";
import { apiError, readJson, requireOrigin } from "@/lib/workspace-auth";
import { text } from "@/lib/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const snapshot = caseStore().snapshot();
    const issueId = request.nextUrl.searchParams.get("issue");
    return Response.json(issueId ? issueLifecycle(snapshot, issueId) : snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    const result = caseStore().execute(await readJson(request), text(request.headers.get("idempotency-key"), "Idempotency key", 100));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
