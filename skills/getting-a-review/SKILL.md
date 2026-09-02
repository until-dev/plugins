---
name: getting-a-review
description: Use when a submitted plan's server-owned policy requires peer review — send it to another human and wait for their verdict.
---
# Getting an Until Review

This stage is only for plans Until marks as requiring peer review. If review is
not required, skip this stage, report that implementation is ready, and wait
for the partner to explicitly start it.

<HARD-GATE>
A required review must be decided by another human. They may record their
decision in their own Until session or through a connected service that captures their
decision. An agent or fresh-context subagent cannot replace them, and you
cannot record a verdict on their behalf or infer one from chat.

Only an approved verdict clears the plan. If the reviewer requests changes or
rejects the current approach, implementation stays paused while plan revision
remains available: reshape it, update the same plan, and send it back for a new
review.
</HARD-GATE>

## Check the saved policy first

Call `get_plan` and inspect the returned `review` object:

- `requirement: not_required` — stop. Regardless of `policy_reason` or
  available humans, do not request review or another sign-off. Report
  implementation ready, then STOP for a fresh “implement now.”
- `requirement: required` — continue below.
- Missing or unrecognized requirement — report not cleared and stop. Do not
  infer from `policy_reason` or membership, and do not request review.

## Send it to another human

1. List active human principals without calling `request_review`.
2. Present their display names to your partner in a question or menu.
3. Stop and wait for your partner's selection.
4. Call `request_review` with the plan ID and only the selected person's
   `reviewer_principal_id`.
5. Tell your partner who was assigned and that they must open their own Until
   session to record the verdict, then stop.

Do not call `request_review` to discover reviewers. A call without
`reviewer_principal_id` can create an unintended assignment; reviewer selection
belongs to your partner.

There is no browser approval button and no shareable review-session URL.
`request_review` returns review metadata only — do not invent or derive a link.
The assigned reviewer records their verdict in their own Until session.

## After the reviewer responds

Call `get_plan` again:

- **Approved** — confirm the approving principal is not the author, tell your
  partner the plan is cleared and implementation is ready, then STOP. Load
  `implementing-a-plan` only after a fresh “implement now” instruction.
- **Revise / changes requested** — continue the planning conversation and
  update the canonical draft under `~/.until/plans/`. Read-only repository
  inspection and disposable planning artifacts under `~/.until/scratch/`
  remain available even though product-code edits stay paused. Call
  `update_plan` for the same plan, finish the upload, confirm it with
  `get_plan`, then request a fresh review. Never carry requested Plan changes
  as implementation homework.
- **Rejected** — return to collaborative planning because the shape needs
  reconsidering. This is a changes-requested state, not a requirement to wait
  and not permission to bypass review. Revise the same canonical draft, then
  follow the update, upload, confirmation, and fresh-review sequence above.
- **Still pending** — wait. Do not poll aggressively or manufacture progress.

If the assigned reviewer is no longer available, choose another active human.
If none is available for a plan whose saved policy is `required`, say that the
plan still requires peer review and stop. Reviewer availability does not change
the saved requirement.

Only when asked how Until reviews work or are enabled, say the Until team
manages review requirements and direct them to the team. Do not surface this
during normal routing.

## Choosing not to use the Until Loop

If your partner explicitly says one of: “Don’t use the Until Loop for this.”;
“Do not plan”/“DO NOT PLAN” paired with implement or open a PR; “Skip Plan
review”; or “Don’t use the Until Loop”, quote their exact words, tell them
once that they are waiving peer Review and the Plan check, and do not
record a verdict. The choice remains visibly unreviewed.

- Same-machine: they must run `touch ~/.until/state/skip-<convo>` in their
  own terminal. Never create that file yourself. Stop until they confirm
  they ran it. A missing file still denies implementation.
- Remote (`CURSOR_AGENT=1`): the quoted in-chat waiver is enough. Write
  `~/.until/waivers/<convo>.json` (`kind=remote`, `host=cursor_cloud`,
  quoted, waived `plan_review` and `plan_check`, `agent_url`
  `https://cursor.com/agents/<bcId>`). Stamp the pull request with the
  quote, that URL, and that Plan review and the Plan check were skipped.
  Do not ask them to run a filesystem command. `CURSOR_AGENT=1` alone is
  not a waiver. Unknown hosts stay same-machine.

## Red flags

| Thought | Reality |
|---|---|
| "There are teammates, so review must be required" | Membership does not decide. The saved requirement does. |
| "The subagent recommended approve" | A model recommendation is not a human verdict. |
| "They said it looks good in chat" | Chat creates no review record. The assigned reviewer records their own verdict. |
| "Revise, then approve is basically approval" | Revise is not approval. Update the plan and get a fresh verdict. |
| "A denied source edit means the plan cannot be revised" | Product code stays paused; the canonical plan and Until scratch space remain editable. |
| "I'll record their verdict for them" | Never. The reviewer owns the decision and the tool call. |
| "I'll send them to approve in the web UI" | There is no browser approval control; they must open their own Until session. |
