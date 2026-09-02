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
requests uncommitted Markdown below `docs/design/` or `docs/specs/`. Every
other repository edit is implementation.

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

Your partner remains in control. The only exception is an explicit Until
Loop waiver from your partner in this conversation. Closed set (quote
their exact words; all must be theirs):

- “Don’t use the Until Loop for this.”
- “Do not plan” / “DO NOT PLAN” paired with implement or open a PR
- “Skip Plan review”
- “Don’t use the Until Loop”

A vague go-ahead, accepted draft, “just do it”, or Build click does not
bypass the Until Loop. After quoting, tell them once that they waive Plan
review and the Plan check. Do not record a Review verdict.

Proof depends on the session class:

- Same-machine (local Cursor, Claude Code, Codex, Droid, OpenCode, Pi, and
  any host not detected as remote): give them this conversation’s exact
  command to run in their own terminal:

  touch ~/.until/state/skip-<convo>

  Use the concrete command from session context in place of `<convo>`.
  Never create that file yourself. Stop until they confirm they ran it.
  A missing file still denies implementation.

- Remote (Cursor Cloud: host env `CURSOR_AGENT=1`): the quoted in-chat
  waiver is the proof. Do not ask them to run a filesystem command.
  Write `~/.until/waivers/<convo>.json` with `kind=remote`,
  `host=cursor_cloud`, non-empty `quoted`,
  `waived: ["plan_review", "plan_check"]`, and `agent_url`
  `https://cursor.com/agents/<bcId>`. Stamp the pull request with the
  quoted text, that agent URL, and that Plan review and the Plan check
  were skipped. `CURSOR_AGENT=1` alone is not a waiver. Unknown hosts
  stay same-machine.

Do not call `submit_plan` again for this change. This includes after
Source Control setup is required and no Plan has been submitted.
