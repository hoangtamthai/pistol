import { NextRequest } from "next/server";
import { caseStore } from "@/lib/case-store";
import { text } from "@/lib/issues";
import { apiError } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(caseStore().job(text((await params).id, "Job ID", 100)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
