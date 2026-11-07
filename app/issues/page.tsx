import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import IssueWorkspace from "@/components/issue-workspace";
import { SESSION_COOKIE, validSession } from "@/lib/workspace-auth";
import "../issues.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function IssuesPage() {
  if (!validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  return <IssueWorkspace />;
}
