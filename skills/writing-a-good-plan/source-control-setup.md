# Source Control setup recovery

Read this when `submit_plan` returns a source-control block **without** an
`UNTIL-<digits>` plan ID. That response did not create a plan.

## `source_control_setup_required`

Setup can resolve the block. Present the live setup link from the response; do
not invent a URL.

1. Explain that Source Control setup is required and present the setup link.
2. Relay this instruction:

   > Until needs access to this repository to compare the eventual Pull request
   > with your cleared Plan. Complete setup in Until, then return to this
   > conversation and send continue.

3. Say clearly that **no plan has been submitted**.
4. Stop before review or implementation because there is nothing to review.
5. Wait for the partner to confirm setup is complete, then retry `submit_plan`
   with the same title, repository, and reviewer.
6. Run the returned upload command before moving to review or implementation,
   then confirm the saved plan with `get_plan`.

For GitHub shared installations, setup may mean **ATTACH** OAuth plus requesting
a repository-scoped grant from the Integrations page rather than installing the
App again.

## `source_control_approval_pending`

The workspace already requested access; an existing grant holder must approve.
There is **no** setup URL — do not send the partner to Integrations as if they
can fix it alone.

1. Explain that approval from a workspace admin who already holds access on that
   GitHub App installation is required.
2. Say clearly that **no plan has been submitted**.
3. Stop before review or implementation. Wait for approval, then retry
   `submit_plan`.

## `source_control_unavailable`

The caller's GitHub user cannot reach this repository on a shared installation
(ATTACH evidence omits it). There is **no** setup URL.

1. Explain that Until cannot offer a setup action that would grant access — the
   repository is outside what their GitHub account can see on that installation.
2. Say clearly that **no plan has been submitted**.
3. Stop before review or implementation unless the partner can obtain GitHub
   access or use a different workspace/repository.

## Until Loop waiver

If the partner explicitly says “Don’t use the Until Loop for this.” (or
another closed-set waiver: “Do not plan”/“DO NOT PLAN” paired with
implement or open a PR, “Skip Plan review”, “Don’t use the Until Loop”),
stop the setup/continue/retry path for this change:

1. Quote their words.
2. Explain once that they waive Plan review and the Plan check.
3. Follow the session class:
   - Same-machine: give them this exact command to run in their own
     terminal: `touch ~/.until/state/skip-<convo>` (use the concrete
     command from session context). Stop until they confirm they ran it.
     A missing file still denies implementation. Never create that token
     yourself.
   - Remote (`CURSOR_AGENT=1`): the quoted in-chat waiver is the proof.
     Write `~/.until/waivers/<convo>.json` (`kind=remote`,
     `host=cursor_cloud`, quoted, waived `plan_review` and `plan_check`,
     `agent_url` `https://cursor.com/agents/<bcId>`). Stamp the pull
     request with the quote, that URL, and that Plan review and the Plan
     check were skipped. Do not ask them to run a filesystem command.
     `CURSOR_AGENT=1` alone is not a waiver. Unknown hosts stay
     same-machine.
4. Do not call `submit_plan` again for this change.

There is no Plan ID to approve or delete. This waiver overrides setup-only
local state the same way it overrides the ordinary pre-Plan requirement.
