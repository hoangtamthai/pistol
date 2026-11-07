import type { Metadata } from "next";
import Workspace from "@/components/workspace";

export const metadata: Metadata = {
  title: "Signal inbox · Pistol",
  description: "Customer requests pulled from Slack, Jira, Zendesk, and seven more tools, with preserved conversations and linked decisions.",
};

export default function InboxPage() {
  return <Workspace />;
}
