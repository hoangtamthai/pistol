import { redirect } from "next/navigation";

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ issue?: string | string[] }> }) {
  const { issue } = await searchParams;
  redirect(typeof issue === "string" && issue ? `/context/issues/${encodeURIComponent(issue)}` : "/context/issues");
}
