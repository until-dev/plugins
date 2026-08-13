# Troubleshooting

Start with the symptom you can observe. Avoid changing several parts of the
installation at once.

- [Installation and authentication](#installation-and-authentication)
- [Enforcement](#enforcement)
- [Expected pauses](#expected-pauses)
- [Pull requests and Plan checks](#pull-requests-and-plan-checks)
- [Custom Loops](#custom-loops)
- [Updates and support](#updates-and-support)

## Installation and authentication

### Until guidance does not activate

**Likely cause:** the plugin is not installed, was installed from the wrong
directory, or the editor was not restarted.

**Try:**

1. Confirm the Until plugin is installed and enabled. See
   [Set up Until](setup.md) for platform-specific steps.
2. For Cursor, confirm the local plugin or symlink still points to the cloned
   repository.
3. Restart Claude Code or reload Cursor with **Developer: Reload Window**.
4. Start a new conversation and ask the agent to implement a small change.
   Until should begin by shaping the change and drafting a Plan before writing
   code.

Existing conversations do not receive a new session-start hook retroactively.

### Authentication or workspace setup does not complete

**Likely cause:** MCP authentication is incomplete or the login flow was closed
before the workspace was created or selected.

**Try:**

1. In Claude Code, run `/mcp` and complete authentication.
2. In Cursor, open settings, find MCP, and confirm the Until server is
   authenticated.
3. Return to the same conversation after the browser flow.
4. If Until presents a setup link, use that exact link rather than guessing a
   workspace URL.
5. Start a fresh conversation after authentication if the existing session
   still cannot see the workspace.

Do not include OAuth tokens or other credentials in a support issue.

## Enforcement

### The agent starts implementing before there is a Plan

In an ordinary repository, the user-level enforcement hooks are inactive before
Plan submission begins. Pre-Plan behaviour depends on the session-start
guidance loading correctly.

**Try:**

1. Start a fresh conversation and confirm Until begins by shaping the change
   and drafting a Plan.
2. Confirm the plugin installation using
   [Until guidance does not activate](#until-guidance-does-not-activate).
3. If the repository contains a `.until-method` marker, continue with
   [Until enforcement hooks do not run](#until-enforcement-hooks-do-not-run).

A repository with `.until-method` is default-closed: its enforcement hooks
block implementation changes before a Plan has been cleared. Repositories
without that marker are protected after Plan submission or source-control setup
begins, but not before.

On Windows, the guidance may load while enforcement does not. Windows is not a
supported environment for the current hooks.

### Until enforcement hooks do not run

**Likely cause:** the Cursor user hooks are missing or incomplete, `python3` is
not available, or `~/.cursor/hooks.json` points to a clone that was moved or
deleted.

**Try:**

1. Confirm `python3 --version` succeeds.
2. Open `~/.cursor/hooks.json` and confirm it is valid JSON:

   ```bash
   python3 -m json.tool ~/.cursor/hooks.json
   ```

3. Confirm all three Until entries are present:
   - `afterMCPExecution` runs `until-track-state`;
   - `beforeShellExecution` runs `until-commit-gate`;
   - `preToolUse` runs `until-commit-gate`.
4. Confirm each command points to an existing executable in the current,
   permanent Until clone.
5. Inspect `~/.until/hooks.log` for recent `track-state` and `commit-gate`
   activity.
6. Reload Cursor after changing the hook configuration.

The installer reports that hooks are already present when it finds an existing
`until-commit-gate` entry. That message does not prove the installation is
complete or that its paths are current.

If paths are stale, edit them manually. Alternatively, remove the old Until
entries and then run `./hooks/install-user-hooks.sh` from the permanent clone.
Rerunning the installer while an old `until-commit-gate` entry remains does not
update it.

## Expected pauses

These states are deliberate stops in the Until Loop rather than installation
failures.

### Plan submission asks for source-control setup

This is expected the first time Until needs access to a repository. No Plan has
been submitted when the response contains no Plan ID.

**Try:**

1. Open the exact setup link Until provides.
2. Connect the correct source-control provider and repository.
3. Return to the same conversation and send `continue`.
4. The agent must retry `submit_plan` with the original details, run the
   returned upload command, and confirm the saved Plan with `get_plan`.

Until does not resume submission automatically. Do not begin implementation
until the retry, upload, and confirmation have succeeded.

If Until reports an unsupported repository provider, there is no setup link or
`continue` loop. Use a repository URL hosted by a provider supported by the
Until workspace.

### A Plan has an ID but is still saving

Receiving an `UNTIL-<number>` ID begins submission, but the Plan body still has
to be uploaded.

**Try:**

1. Ask Until for the current Plan.
2. If it is waiting for upload, retry `submit_plan` or `update_plan` to obtain a
   fresh upload command.
3. Run that exact command.
4. Confirm the saved Plan with `get_plan`.

Upload authorizations expire. Do not reuse an expired upload command.

### A Plan is ready but implementation does not start

A ready Plan makes implementation available but does not start it
automatically. Give Until a fresh instruction:

> Implement now.

See [Run your first Until Loop](first-until-loop.md#4-run).

### A Plan remains awaiting approval

**Likely cause:** approval is required and no other person has recorded an
approved decision.

**Try:**

1. Confirm that another eligible person is available in the Until workspace.
2. Ask Until to send the Plan to that reviewer.
3. Have the reviewer read the actual Plan in their own Until session.
4. Wait for their recorded decision.

Chat agreement, the Plan author's own decision, and an agent recommendation do
not satisfy required approval. See [Plan approvals](plan-approvals.md).

### A Plan review requests changes

Implementation remains paused, but the same Plan can be revised.

**Try:**

1. Discuss the requested changes and revise the Plan.
2. Read the revised Plan.
3. Call `update_plan` for the same Plan, run its upload command, and confirm the
   saved revision with `get_plan`.
4. Request a fresh human review.

Do not carry unresolved Plan decisions into implementation as TODOs.

### Implementation remains blocked after approval

The local enforcement state only clears after Until confirms the current Plan.

**Try:**

1. Ask Until to call `get_plan` for the same Plan ID.
2. Confirm the Plan upload completed.
3. Confirm the current lifecycle is approved, or that review is not required.
4. Retry implementation only after that confirmation.

## Pull requests and Plan checks

### The pull request is not linked to its Plan

**Likely cause:** the pull request does not contain a recognizable Plan ID or
the repository is not connected to the same Until workspace.

**Try:**

1. Add the friendly Plan ID to the pull request description:

   ```text
   Plan ID: UNTIL-42
   ```

2. Confirm the pull request belongs to the repository attached to the Plan.
3. Push or update the pull request so Until processes the new reference.

Until can also recognize the ID in the pull request title, branch, or commit
messages, but the description is the clearest durable reference.

### A Plan check does not start

**Likely cause:** the pull request is not linked, the repository connection is
missing, or no Plan was fully submitted.

**Try:**

1. Resolve pull request linking first.
2. Confirm the Plan upload completed.
3. Confirm the repository connection remains active.
4. Ask Until for the current Plan and pull request status.

No submitted Plan means there is nothing to check.

### A Plan check does not rerun after a push

**Try:**

1. Confirm the pull request head SHA changed.
2. Confirm the pull request remains open and linked to the Plan.
3. Ask Until for the check associated with the current pull request head.
4. Wait for an active check to complete before pushing another diagnostic
   change.

Checks are associated with a particular pull request head. A completed check
for an older commit does not describe the current implementation.

### Plan differences do not clear

**Try:**

1. Ask Until for the check associated with the current pull request head.
2. For each difference, either fix the implementation and push a new commit or
   have an authorized person acknowledge the intentional difference with a
   genuine reason.
3. Wait for the new head to be checked.
4. Confirm that no blocking unacknowledged differences remain. A check with
   acknowledged differences is neutral; only a check with no differences is
   successful.

See [Plan checks](plan-checks.md) for the full difference-resolution flow.

## Custom Loops

### A Custom Loop is missing

**Likely cause:** Until has not ingested the default-branch commit, the file is
outside the supported directory, or the front matter is invalid.

**Try:**

1. Put new loops under `.until/loops/` with a `.md` extension.
2. Confirm the file was merged into the connected repository's default branch.
3. Include `name`, `event_schema: until`, and `on` in the front matter.
4. Ask Until to list your Custom Loops and inspect any ingestion error.

See [Custom Loops](custom-loops.md).

### A Custom Loop appears but does not run

**Likely cause:** the event did not occur or the CEL filter evaluated to false.

**Try:**

1. Confirm the event name against `until://loops/syntax`.
2. Check that CEL front-matter fields use snake_case.
3. Simplify the filter while keeping it narrow enough for safe testing.
4. Trigger a new matching event in a test repository.
5. Inspect the latest Custom Loop runs and their triggering events.

Do not leave a broad unfiltered trigger in place if it would run on every event
in production.

### A Custom Loop cannot use Slack or Linear

Those integrations are optional and must be connected before a loop can use
them.

Connect the integration through Until, then trigger a new matching event. If
you do not want the integration, change the loop so it exits cleanly when the
tool is unavailable. See [Custom Loop integrations](custom-loops.md#integrations).

## Updates and support

### Updating does not change the behaviour

**Try:**

1. Confirm you updated the same clone the editor loads.
2. Reload the editor.
3. Start a fresh conversation.
4. For Cursor, verify the existing user-hook entries and paths using
   [Until enforcement hooks do not run](#until-enforcement-hooks-do-not-run).

After an ordinary `git pull` in an unmoved clone, rerunning the hook installer
is unnecessary and does not rewrite existing entries.

### Opening a support issue

Include:

- Claude Code or Cursor and its version;
- operating system;
- Until plugin version or commit;
- the step and documentation section followed;
- the exact error with secrets removed;
- whether the failure also happens in a fresh conversation.

Open issues at
[github.com/until-dev/plugins/issues](https://github.com/until-dev/plugins/issues).
