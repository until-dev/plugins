# Plan checks

A Plan check compares the current pull request with the submitted Plan. It
answers one question:

> Did the agent build what the Plan said?

## Before a check can run

Until needs:

- a submitted Plan;
- a source-control connection for the repository;
- a pull request linked to that Plan.

If no Plan was submitted, there is nothing for Until to check.

When repository access is not configured, Until pauses Plan submission and
gives you a setup link. Complete setup, return to the same conversation, and
send `continue`. The agent must retry the original submission and finish saving
the Plan. No submitted Plan exists until that succeeds; Until does not resume
automatically.

A Plan check does not require a peer-Review decision. It requires a fully saved
Plan, repository connection, and linked pull request.

## Linking the pull request

The implementation should include the Until Plan ID in the pull request
description:

```text
Plan ID: UNTIL-42
```

Until can also recognize the Plan ID in the title, branch, or commit messages,
but the pull request description is the clearest place to keep the association.

Until runs a check when the linked pull request opens and checks again when its
head changes.

## Plan differences

A Plan difference is a substantive gap between the Plan and the
implementation. Until may report:

- **Missing**: work required by the Plan is absent.
- **Changed**: the implementation made a materially different decision.
- **Beyond**: the implementation added work the Plan did not call for.
- **Scope**: the implementation crossed an explicit boundary in the Plan.

Each difference includes a summary and a stable slug that Until uses when the
difference is acknowledged.

## Resolve a difference

Fixing the implementation is the default:

1. ask the agent to change the code so it matches the Plan;
2. push the new commit;
3. wait for Until to check the new head.

Until closes the difference when the gap is no longer present.

## Correct an inaccurate Plan

Sometimes the implementation reveals that the submitted Plan itself was wrong
or incomplete. In that case:

1. update the same Plan;
2. complete its content upload and confirm the saved revision;
3. obtain fresh approval if the saved Review policy requires it;
4. let the next Plan check compare the pull request with the corrected Plan.

## Acknowledge an intentional difference

Sometimes a difference is intentional and correct. An authorized person can
acknowledge it on the record with a genuine reason.

An acknowledgement should explain why the implementation differs and why that
difference is acceptable. It is not a shortcut for hiding unfinished work or
making the check appear successful.

Record the acknowledgement in a pull request comment, review comment, commit
message, or pull request description. Include the exact stable slug from the
Plan difference and the genuine explanation. A chat message or a tag such as
`[Missing]` without the slug and reason does not acknowledge it.

The person must be recognized by Until and have permission to acknowledge the
difference. If your account cannot do so, ask an authorized teammate or
workspace administrator.

## When the check is complete

The Until Loop remains open while a blocking Plan difference is neither
resolved nor acknowledged. The Plan check is successful only when no
differences remain. When differences remain but every blocking one has been
acknowledged, the check is neutral and non-blocking rather than successful.

A successful Plan check does not merge the pull request and does not replace
tests, CI, security checks, or implementation-quality review. It confirms that
the implementation and recorded intent agree.

For linking or rerun problems, see [Troubleshooting](troubleshooting.md).
