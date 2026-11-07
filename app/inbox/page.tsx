import type { Metadata } from "next";
import Workspace from "@/components/workspace";

export const metadata: Metadata = {
  title: "Signal inbox · Relay",
  description: "Customer requests across five fictional accounts, with preserved conversations and linked decisions.",
};

export default function InboxPage() {
  return <Workspace />;
}
