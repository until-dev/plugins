# Source Control setup recovery

Read this only when `submit_plan` returns
`source_control_setup_required` without an `UNTIL-<digits>` plan ID. That
response did not create a plan.

1. Explain that Source Control setup is required and present the live setup
   link from the response. Do not invent a URL.
2. Relay this instruction:

   > Until needs access to this repository to compare the eventual Pull request
   > with your cleared Plan. Complete setup in Until, then return to this
   > conversation and send continue.

3. Say clearly that **no plan has been submitted**.
4. Stop before review or implementation because there is nothing to review.
5. Wait for the partner to confirm in this conversation that setup is complete.
   `continue` is only a suggested reply; an equally clear confirmation also
   authorizes the retry. Do not infer completion from silence or claim that
   another surface will resume automatically.
6. Retry `submit_plan` with the same title, repository, and reviewer.
7. Run the returned upload command before moving to review or implementation,
   then confirm the saved plan with `get_plan`.

A setup-required response without a Plan ID did not begin submission. A real
`UNTIL-<digits>` ID starts the two-step submission, but implementation still
waits for the upload and `get_plan` confirmation.

If the partner explicitly says “Don’t use the Until Loop for this.”, stop the
setup/continue/retry path for this change:

1. Quote their words.
2. Explain once that they waive Plan review and the Plan check.
3. Give them this exact command to run in their own terminal:
   `touch ~/.until/state/skip-<convo>`
   (use the concrete command from session context).
4. Stop until they confirm they ran it. A missing file still denies
   implementation. Never create that token yourself. Do not call
   `submit_plan` again for this change.

There is no Plan ID to approve or delete. This waiver overrides setup-only
local state the same way it overrides the ordinary pre-Plan requirement.
