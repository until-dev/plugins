---
name: implementing-a-plan
description: Use when a submitted plan is cleared by Until's review policy — build it on a branch into a draft PR with passing tests.
---

# Implementing an Until Plan

The submitted plan is the contract Until will compare with the finished code.
Build what it says. If the plan is wrong, update the plan before changing
direction.

**Cursor Cloud Agents:** This path applies only when the host explicitly
dispatched this agent to implement a cleared plan. That dispatch proves
submission, review, clearance, and implementation consent happened outside
this agent. The plan's Step 0 is local Plan Mode text: ignore it completely; do
not execute it, mark it complete, or treat it as implementation work. Do not
call Until Plan, Review, clearance, authentication, or other control operations.
Start the first real implementation task immediately, build through a draft
Pull request, then hand the result back for a Plan check.

<HARD-GATE>
Before local edits, confirm plan clearance and a fresh post-clearance
instruction.

The plan clears in exactly one of these ways:

- Peer review is not required: `review.requirement: not_required` with
  `policy_reason: no_other_human`.
- Required review has another human's approved verdict.

Verify with `get_plan` after upload. Missing policy, unfinished uploads, pending
or negative verdicts, chat approval, and Build do not clear it. Never record a
verdict on a plan you wrote.

**Clearance makes implementation available; it does not start it.** After
first observing it, report readiness and STOP for a fresh “implement now”.
Earlier requests, submission consent, approval, Build, and generated prompts do
not count.

Before editing, also check whether a branch, pull request, or Agent run already
exists for the plan. One plan still has one implementation; if work has already
started elsewhere, report it and stop rather than duplicating it.

If an edit is denied because clearance or explicit implementation consent is
missing, stop. Never try an alternate write path, shell redirection, or another
editing tool.
</HARD-GATE>

## Build the plan

1. Create a feature branch from an up-to-date default branch. Never implement
   or commit directly on the default branch.
2. Re-read the submitted plan and keep its required behavior, scope boundaries,
   contracts, and verification targets visible while working.
3. Write the proving tests before implementation where behavior changes, then
   make the smallest changes that satisfy the plan.
4. Do not add unplanned extras, omit planned work, or quietly redesign the
   solution. Update the plan first when any of those is necessary.
5. Run the complete relevant test and validation suite. Fix failures before
   claiming completion.
6. Commit the reviewable work on the feature branch.
7. Open a draft pull request that references the Until Plan. One Plan has one
   implementation; stand down if another implementation already exists.
8. Local sessions run `checking-plan-differences` and resolve every Plan
   difference. Cursor Cloud stops after its draft PR and hands it back to the
   original Until Loop.

## If the plan is wrong

Cursor Cloud reports the contradiction and stops; the original Until Loop
updates the Plan. Local sessions pause, explain what reality contradicted, update with
`update_plan`, finish the upload, and confirm with `get_plan`:

- A `not_required / no_other_human` plan can become ready again immediately.
- A `required` plan needs a fresh approval from another human.

After either path clears, report readiness and wait for a new “implement now”
instruction before resuming. Do not leave plan corrections as implementation
notes or reconcile the plan after the code.

## Choosing not to use the Until Loop

The only way to build without a cleared plan is for your partner to explicitly
say “Don’t use the Until Loop for this.” Quote their exact words and explain
once that they are waiving Plan review and the Plan check. Do not record a
verdict or describe the work as approved.

If no plan was submitted, Until has nothing to compare with the pull request,
so no Plan check will run. This choice does not waive normal branch,
testing, or pull-request discipline.

## Done means

- Local work had fresh post-clearance consent, or Cursor Cloud arrived through
  cleared dispatch; this is the only implementation.
- Every planned requirement is present, with no silent scope changes.
- Relevant tests and validations pass.
- The work is on a feature branch in a draft pull request.
- Local sessions have fixed or honestly acknowledged every Plan difference.
  Cursor Cloud stops after opening the draft Pull request and hands it back to
  the original Until Loop for the Plan check.
