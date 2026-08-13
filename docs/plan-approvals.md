# Plan approvals

Plan approval is optional and off by default. Most individual users submit
their own Plans and continue without another person's approval.

Teams can enable approval when another person should agree that a Plan is ready
to guide implementation.

## What approval means

Approving a Plan means:

> I understand the intended change and agree that this Plan is ready to become
> the target for implementation.

The reviewer is reviewing the problem, approach, boundaries, and definition of
done while they are still written in plain language.

Plan approval is not approval of finished code. Tests, security checks, and any
implementation-quality review your team requires still happen after the code
exists.

## Who can approve

A required approval must come from another person:

- the Plan author cannot approve their own Plan;
- an agent cannot replace a human reviewer;
- Until cannot infer approval from chat;
- “looks good” does not record a verdict.

To enable required Plan approval for your workspace, contact the Until team at
[engineering@until.dev](mailto:engineering@until.dev) or through your existing
Until support channel.

## Requesting approval

After the Plan is submitted, Until confirms that approval is required and asks
you to choose an available reviewer. Until sends the Plan to that person's own
Until session.

The web surface is not an approval button. The reviewer reads the actual Plan
and records their decision through their session.

## Reviewer decisions

The reviewer can:

- **Approve** the Plan, making implementation available.
- **Request changes**, rejecting the current revision and keeping
  implementation paused while the same Plan is revised.

Approval still does not start implementation. After Until confirms that the
Plan is ready, the author must explicitly ask it to implement the Plan in a
fresh turn.

## When changes are requested

Work with Until to revise the same Plan. The implementation remains paused, but
you can continue discussing the approach and updating the Plan.

When the revision is ready:

1. ask the agent to update the same Plan;
2. complete the new content upload;
3. confirm that Until saved the revision;
4. send it for a fresh human Review.

A previous approval does not automatically cover a changed Plan.

## What approval does not guarantee

Approval records agreement about intent. It does not prove that:

- the implementation matches the Plan;
- the code is correct or secure;
- tests and CI pass;
- the change is ready to merge.

The [Plan check](plan-checks.md) answers whether the implementation matches the
Plan. Your normal engineering checks remain responsible for the rest.

Continue to [Plan checks](plan-checks.md), or return to
[your first Until Loop](first-until-loop.md).