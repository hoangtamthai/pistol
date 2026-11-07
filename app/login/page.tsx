import WorkspaceLogin from "@/components/workspace-login";
import { authConfigured } from "@/lib/workspace-auth";
import "../issues.css";

export const dynamic = "force-dynamic";
export default function LoginPage() { return <WorkspaceLogin configured={authConfigured()} />; }
