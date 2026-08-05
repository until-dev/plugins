---
name: using-until
description: Use at the start of any conversation where Until tools are available.
---

# Using Until

Until supports plan-first delivery through the Until Loop. Agree what to build,
submit the Plan, follow its Review policy, implement it, then run a Plan check
against the Pull request.

## Route the current request

Before asking questions, reading files, or acting, classify the deliverable
requested in this turn:

- **Admin, tracker, or copy:** answer questions, query systems, or produce
  paste-ready text directly. Describing a future feature does not make the
  current copy task an implementation.
- **Shape-only:** use `brainstorming`, produce only the requested design,
  planning, or specification artifact, then stop. Do not choose an implementer
  or continue into delivery.
- **Actual repository implementation:** changes to product behavior, source,
  configuration, tests, repository skills, or anything shipped or deployed.
  Enter the implementation route below.

Shape-only repository artifacts are allowed only when the partner explicitly
requests uncommitted Markdown below `docs/plans/`, `docs/design/`, or
`docs/specs/`. Every other repository edit is implementation.

## Route implementation from its current stage

- Cursor Cloud Agent implementation → `implementing-a-plan`; start from the
  cleared implementation handoff supplied by the host
- Shape not agreed → `brainstorming`
- Shape agreed, no submitted plan → `writing-a-good-plan`
- Submitted plan requires peer review → `getting-a-review`
- Submitted plan does not require review → report ready; wait for fresh
  “implement now”
- Required review approved by another human → report ready; wait for fresh
  “implement now”
- Cleared plan plus a fresh post-clearance implementation instruction →
  `implementing-a-plan`
- Pull request has Plan differences → `checking-plan-differences`

A question-tool or menu selection is the partner's answer during shaping.
Once the shape is agreed, continue to `writing-a-good-plan`; never stop on,
repeat, or reinterpret a selected option, and do not ask the same question
again.

Non-cloud delegated agents may read directly. They may edit only when their
prompt names the submitted, cleared plan and assigns work within it.

## Confirm local clearance before implementation

Local implementation waits until upload is confirmed and `get_plan` shows:

- `review.requirement: not_required`; or
- `review.requirement: required` with an approved verdict from another human.

`policy_reason` and membership never route; missing or unknown requirements do
not clear.

Chat approval, Build, model advice, and an author-recorded verdict do not clear
a plan. Changes require
`update_plan`, a completed upload, and another clearance check.

Clearance does not itself authorize edits. The first time clearance is
observed, report that implementation is ready and STOP. Only a fresh
post-clearance “implement now” or equally explicit instruction starts
`implementing-a-plan`; the original implementation ask, submission consent,
and review approval cannot be reused.

## Work with the partner

Speak in product terms: Plan, Review, implementation, and Plan differences. Do not
expose skill loading, protocol calls, enforcement internals, session state, or
identifiers. Lead with the outcome, not installed components.

Your partner remains in control. If your partner explicitly says “Don’t use
the Until Loop for this.”, quote their words, explain once that they waive Plan
review and the Plan check, then comply without recording a verdict. A vague
go-ahead, accepted draft, or Build click does not bypass the Until Loop.
