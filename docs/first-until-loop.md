# Run your first Until Loop

The Until Loop starts before implementation and ends when the pull request
matches its Plan.

```text
Brainstorm → Plan → Submit → Run → Check
```

This walkthrough uses a small example:

> Add an empty state to the search results page.

## 1. Brainstorm

Ask your coding agent to implement the change as you normally would.

Until first helps you understand the problem and agree on the shape of the
solution. It asks one question at a time and keeps implementation paused while
important decisions are still cheap to change.

If the repository contains `.until-method`, the enforcement hooks also block
implementation changes before a Plan is cleared. See
[Set up Until](setup.md#cursor) for the hook setup.

For the example, those decisions might include:

- when the empty state appears;
- what action it offers;
- whether an error state is separate;
- what proves the change works.

If you only ask for an outline, design, or specification, Until stops after
producing that artifact. Asking to implement the change continues into
planning.

## 2. Plan

Once the shape is clear, Until drafts a Plan. The Plan explains the problem,
the intended outcome, the boundaries of the change, and how the result will be
verified.

A good Plan gives the agent enough direction to implement the change without
making important product decisions for you. It should make clear:

- what problem the change solves and who it affects;
- the intended behaviour and important decisions already made;
- what is inside and outside the change;
- any constraints the implementation must preserve;
- how you will know the result works.

A Plan does not need to prescribe every implementation detail. Its job is to
define the outcome and boundaries clearly enough that differences can be
detected later.

For this example, “add an empty state” is not enough. The Plan should say when
it appears, what it contains, how it differs from loading and error states, and
what tests or checks will prove it works.

The agent saves the draft under `~/.until/plans/` and gives you its path. Open
and read that file yourself rather than relying on a chat summary. Ask for
changes if it does not capture your intent.

Saying that the conversation “looks good” does not submit the Plan. When the
document is ready, tell Until:

> Submit it.

Until begins submission and confirms whether repository setup, upload, or
Review remains before implementation can begin.

## 3. Submit

Plan approval is off by default. In the normal solo flow, the Plan becomes
ready after its upload is confirmed and Until reports that Review is not
required.

Teams can require another person to approve a Plan first. That path is covered
in [Plan approvals](plan-approvals.md).

The first time Until needs access to the repository, it may pause submission
and give you a source-control setup link. Complete setup, return to the same
conversation, and send `continue`. The agent must retry the original submission
and finish saving the Plan; Until does not resume automatically.

## 4. Run

A ready Plan makes implementation available, but it does not start
implementation automatically. Until stops and waits for a fresh instruction.

Tell it:

> Implement now.

The agent implements the submitted Plan on a branch, runs the relevant checks,
and opens a draft pull request. Until assigns the Plan a friendly ID; the pull
request description should include it:

```text
Plan ID: UNTIL-42
```

## 5. Check

Until links the pull request to its Plan and checks the current implementation
against it. The check reports work that is missing, changed, or outside the
Plan.

For each reported difference:

- ask the agent to fix the implementation and push again; or
- if the difference is intentional, have an authorized person acknowledge it
  with a real reason.

Until checks each new push. The loop ends when no unresolved Plan differences
remain.

See [Plan checks](plan-checks.md) for the full flow.

## Deliberate stops

Until requires separate instructions at important transitions:

- approving the shape does not submit the Plan;
- submitting the Plan does not begin implementation;
- opening a pull request does not mean the implementation matches the Plan.

These stops keep intent, implementation, and verification distinct without
requiring you to supervise every tool call.

## Bypassing the Until Loop

If the loop does not fit a particular change, tell the agent:

> Don't use the Until Loop for this.

Until explains that you are giving up Plan review and the Plan check, then
stands aside. When enforcement is active, it gives you a session-specific
bypass command that you must run in your own terminal; the agent cannot run it
for you. Clicking Build, accepting a draft, or saying “looks good” does not
bypass the loop.

Next: [Understand Plan checks](plan-checks.md).
