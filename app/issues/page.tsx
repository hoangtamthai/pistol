import IssueWorkspace from "@/components/issue-workspace";
import "../issues.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default function IssuesPage() {
  return <IssueWorkspace />;
}
