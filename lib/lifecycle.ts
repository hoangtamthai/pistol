import { affectedAccounts, CaseError, type Snapshot } from "./issues";

export const lifecycleStages = ["Report received", "Collect context", "Assign & prioritize", "Investigate", "Prepare fix plan", "Human review", "Deploy & verify", "Customer follow-up", "Recovery confirmed"] as const;

export function issueLifecycle(snapshot: Snapshot, issueId: string) {
  const issue = snapshot.issues.find(item => item.id === issueId);
  if (!issue) throw new CaseError("Issue not found.", 404);
  const reportIds = new Set(snapshot.relationships.filter(edge => edge.toId === issueId && edge.type === "REPORTS" && edge.status === "confirmed").map(edge => edge.fromId));
  const reports = snapshot.reports.filter(report => reportIds.has(report.id));
  const evidence = snapshot.evidence.filter(item => item.issueId === issueId);
  const investigation = evidence.findLast(item => item.kind === "reviewed_investigation");
  const proposal = snapshot.proposals.findLast(item => item.issueId === issueId && item.kind === "fix");
  const affected = affectedAccounts(snapshot, issueId);
  const outcomes = snapshot.outcomes.filter(item => item.issueId === issueId);
  const confirmed = affected.length > 0 && affected.every(account => outcomes.some(outcome => outcome.accountId === account.id && outcome.state === "confirmed"));
  const currentApproval = proposal?.status === "approved" && proposal.inputRevision === issue.revision;
  const deployedPlan = proposal?.status === "simulated" && issue.deployed;
  const ownerAssigned = !/^(triage|unassigned)$|\bunassigned\b|\(proposed\)/i.test(issue.owner.trim());
  let step = issue.workflowStep ?? 0;
  if (step >= 2 && !ownerAssigned) step = 2;
  if (step >= 3 && !investigation) step = 3;
  if (step >= 5 && step <= 6 && !deployedPlan && (!proposal || proposal.status === "stale" || proposal.inputRevision !== issue.revision)) step = 4;
  if (step === 8 && (!confirmed || issue.state !== "resolved")) step = 7;
  const ready = [reports.length > 0, reports.length > 0, ownerAssigned, !!investigation, !!investigation, !!currentApproval, !!deployedPlan, !!deployedPlan && confirmed, false];
  const reasons = [
    "No report is linked. A human must supply the original report.",
    "No customer context is available. A human must supply it.",
    "Confirm the responsible owner and operational priority.",
    "Supply investigation findings, a proposed fix, and a verification plan. No repository has been inspected automatically.",
    "Investigation evidence is required before preparing a fix plan.",
    "Review the exact fix plan and acknowledge the evidence and tradeoffs before approving.",
    "Record explicit simulated deployment verification. This app cannot deploy code.",
    "Verify customer identity and record a separate reply for every affected account. A deployment is not recovery.",
    "Every verified affected account has confirmed recovery.",
  ];
  return { issue, reports, evidence, investigation, proposal, accounts: snapshot.accounts, affected, outcomes,
    lifecycle: { step, title: lifecycleStages[step], stages: lifecycleStages, canAdvance: ready[step], finished: step === 8, reason: reasons[step] } };
}
