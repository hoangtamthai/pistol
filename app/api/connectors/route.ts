import { NextRequest } from "next/server";
import { caseStore } from "@/lib/case-store";
import { connectorStatus, connectorTickets, intakeCommand } from "@/lib/connectors";
import { clusters } from "@/lib/agent-playbooks";
import { apiError, requireOrigin } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tickets = connectorTickets.map(({ provider, externalId, title, customer, contact, category, severity, issueType, playbook }) => ({ provider, ref: externalId.slice(provider.length + 1), title: title.slice(customer.length + 2), customer, contact, category, severity, issueType, ...playbook }));
    return Response.json({ simulated: true, connectors: connectorStatus(caseStore().snapshot()), clusters, tickets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

/** Simulated sync: replays the fixed mock tickets through normal intake. Re-running is idempotent. */
export async function POST(request: NextRequest) {
  try {
    requireOrigin(request);
    const store = caseStore();
    const before = connectorStatus(store.snapshot()).reduce((total, connector) => total + connector.pulled, 0);
    for (const ticket of connectorTickets) {
      const { key, body } = intakeCommand(ticket);
      store.execute(body, key);
    }
    const connectors = connectorStatus(store.snapshot());
    const after = connectors.reduce((total, connector) => total + connector.pulled, 0);
    return Response.json({ simulated: true, pulled: after - before, total: after, connectors }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
