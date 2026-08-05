---
name: checking-plan-differences
description: Use after opening a Pull request for a submitted Plan — resolve every Plan difference produced by the Plan check.
---

# Checking Plan Differences

After a Pull request is pushed, Until runs a Plan check against the submitted
Plan. Each substantive gap is a Plan difference with a Difference tag and
Difference slug. Your job is to close every Plan difference honestly.

This applies whether the Plan required peer review or not. A Plan check needs
the Plan and repository connection, not a Review decision. If no Plan was
submitted, there is nothing to check.

<HARD-GATE>
Do not consider the work done, and do not ask for human review or merge, while
unresolved Plan differences remain. Each Plan difference is either resolved by
fixing the implementation or acknowledged on the record by an authorized
person with a real reason.
</HARD-GATE>

## Read the Plan differences

Read the Plan check surface and call `get_plan` for Until's record of the Pull
request. For each Plan difference, note its Difference tag, Difference slug,
and the Plan claim it maps to.

## For each Plan difference, choose one — honestly

1. **Resolve it (default).** Change the implementation to match the Plan and
   push. Until checks the new commit and closes the difference when the gap is
   gone.
2. **Acknowledge it.** If the difference is intentional and correct, an
   authorized person records a genuine reason against its Difference slug.
3. **Fix the Plan.** If the difference reveals that the Plan was wrong or
   incomplete, call `update_plan`, complete the required Review again, and let
   the next Plan check compare against the corrected Plan.

## Bias toward fixing

Acknowledgement is for genuine, intentional Plan differences, not for changing
the Plan check outcome without addressing the gap. If in doubt, resolve it.

## Done means

Every Plan difference is resolved, acknowledged with a Difference slug and
reason, or closed by a reviewed Plan update, and the Plan check outcome is
successful. The Pull request is ready for implementation-quality review.

## Red Flags — STOP

| Thought | Reality |
|--------|---------|
| "These are just nitpicks" | A Plan difference is a Plan-versus-reality gap. Close it. |
| "I'll acknowledge them all" | Each acknowledgement needs an authorized person and a real reason. |
| "The Plan was wrong, I'll leave the code" | Update and review the Plan instead of leaving it inconsistent. |
| "I'll merge and deal with differences later" | Unresolved Plan differences keep the Until Loop open. |
