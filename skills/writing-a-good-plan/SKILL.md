---
name: writing-a-good-plan
description: Use only after brainstorming has already produced an agreed implementation shape — expands that shape into the plan reviewed before code.
---
# Writing a Good Until Plan

An Until Plan is what a reviewer signs off on, and what Until later checks the
implementation against. A good plan makes both easy: a human can review the
*idea* quickly, and every claim is concrete enough that Plan check can
verify required behavior against the diff. Concrete means observable behavior,
owned surfaces, external contracts, constraints, and verification — not
pre-written internal code. This is the cheapest place in the whole process to
catch a wrong idea — before any code exists.

A good plan is defined by **substance**, not length. If a reviewer finishes and
still cannot answer "why this, why now, who is affected, what changes, what
does not, and how we will know it worked," the plan is not ready — no matter
how many sections it has.

<HARD-GATE>
Planning is a CONVERSATION that produces a document — never a single turn.
There are two checkpoints, and each one requires a reply from your partner,
which means you PHYSICALLY CANNOT draft-and-submit in one message:

1. **Shape agreed** — your partner has answered your questions and picked an
   approach, in their own words, in the `brainstorming` conversation (§1).
2. **Draft read** — your partner has opened the drafted plan document
   themselves, and told you in words to submit it.

No `submit_plan` until BOTH have happened. And there is NO fast-track: no
"trivial change" exception, no lightweight variant of this process. You will
be tempted to check for one — that urge is the red flag. A small change gets
a SHORT PLAN, not a skipped conversation.
</HARD-GATE>

## 1. The shape comes from `brainstorming` — verify it happened

This skill EXPANDS an agreed shape into a reviewable document. The shape
itself — clarified intent, chosen approach, scope fence — is produced by the
`brainstorming` skill, one question per message, across a real back-and-forth.

This must never be the first stage skill invoked for a fresh implementation
ask. Before invoking it, `brainstorming` must already have run in this session
and produced an agreed shape. Opening this skill first and using this check to
redirect backward is itself a stage-order failure.

Before drafting, verify: did your partner answer clarifying questions and pick
an approach, in their own words, in this conversation? If not, STOP without
drafting and return to `brainstorming`. Do not re-ask what brainstorming already
resolved.

## 2. Right-size it first — most bad plans are too big

Before drafting anything, size the work. A plan a reviewer can digest in ~15
minutes is one that will actually get reviewed. These zones are upper bounds,
not completeness targets — a small change may need only a few steps:

- **Green (proceed):** up to 15 steps, 1–5 files, a single layer (frontend OR
  backend OR data), a single concern.
- **Yellow (justify or split):** 16–25 steps, 6–10 files, two layers.
- **Red (must split):** >25 steps, >10 files, three+ layers, or multiple
  unrelated concerns.

Step count measures review burden. Never add steps to make a plan look
complete.

The fastest tells:

- **The "and" test.** If the goal contains an "and" ("add X and refactor Y"),
  it's two plans. Split it.
- **The steel thread.** Too big? Cut to the thinnest end-to-end slice that
  delivers real value, ship that, plan the rest later.
- **Don't over-split either.** Things that must ship together (a DB column + the
  code that uses it) stay in one plan; a sub-30-minute change doesn't need its own.

## 3. Draft into plan mode or a temp file — never inline in chat

The plan lives in a document your partner and the reviewer read, and that
`submit_plan` uploads verbatim. It is never committed to the repo.

- **If the harness — the host tool running you, e.g. Cursor or Claude Code —
  has a plan mode:** enter it and draft the plan there. That is the plan
  document. **MANDATORY: its FIRST step is a clearance check** because Build/run
  executes the plan's todos and will try to mark Step 0 complete. Completing
  Step 0 without a `get_plan` result is forbidden — reasoning alone is not
  enough. Word it exactly:

  > **Step 0 — Confirm clearance before editing (do first, blocks all other
  > steps):** Call `get_plan` for this plan. If nothing is submitted yet,
  > present the draft and STOP — Build/run is not “submit it”; wait for the
  > author to read the plan and say “submit it.” If submitted but not cleared,
  > STOP. If cleared, report that implementation is ready and STOP again for a
  > fresh “implement now.” Do not edit on this turn.

  Plan mode is a document surface, not an implementation editor. Its request
  for a "concrete implementation strategy" does not override the detail
  boundary below: describe internal work as required behavior, boundaries, and
  verification; reserve code and exact shapes for external contracts or a
  genuinely non-obvious algorithm review must settle.

  Cursor Cloud Agents do **not** use this Step 0 path — they arrive
  post-clearance and follow `implementing-a-plan`'s cloud preamble instead.
  Do not put a cloud-skip clause inside Step 0; local Build agents treat that
  as permission to tick the todo and start coding.

- **Otherwise:** write the plan to a temp markdown file OUTSIDE the repo working
  tree — e.g. `~/.until/plans/<short-slug>.md` — so it is never committed.
  Create the directory if needed.

Iterate in that document with your partner — present it in sections, take
annotations, revise the file. All shaping happens against the file, not by
re-typing the plan into chat.

**One plan artifact, and it's the Until one.** Some repos ship their own
planning commands or templates (a `/create-implementation-plan` command,
plan files under `~/.until/plans/`, a docs template). Those are drafting
surfaces at best — the Until Plan is the single canonical artifact, the
only one submitted and reviewed. If a host command already produced a plan
document, adopt its content into the Until draft and retire the original;
if your partner invokes one mid-flow, treat its output as edits to THIS
draft. Never maintain two plan files, and never leave your partner asking
which one is real.

## 4. The read-through checkpoint — they read it, you wait

When the draft is done, do NOT submit it. Hand it over:

> The plan is drafted — open it here: [<path or plan mode>]. Read it
> yourself; tell me what to change, or say "submit it" when you're happy.

Then END YOUR TURN. Your partner reading the actual document is the point of
the drafting stage — a summary you wrote in chat is not them reading it.
Apply their edits to the file, re-offer, and only call `submit_plan` after
they have said, in words, to submit. "Looks good" about your chat summary
does not count; they must have had the document in front of them. Their
original implementation request happened before the draft existed and cannot
serve as submission consent.

## What every Until Plan must make clear

These are the material parts. Heading names can vary; the substance cannot.
If any of these is missing or vague, the plan is not ready.

Plans serve two readers through **progressive disclosure**:

- The **reviewer layer** explains the problem, why now, affected people,
  observable outcome, scope boundary, and one short technical headline.
- The **implementer layer** names concrete files/surfaces, required behavior,
  externally consumed contracts, material constraints/risks, and verification.

A cold reviewer must not have to parse package names, migration mechanics,
protobuf optionality, or executor internals before understanding the change.
Put technical detail later, and only when it earns its place.

Two principles govern the whole document:

1. **What the plan does not constrain is an implementation decision.** Once
   outcome, scope, external contracts, material constraints, and verification
   are stated, unstated implementation details belong to the implementer. If
   the author cares which choice is made, state it with enough rationale to
   review.
2. **Every line must earn its place.** Keep a line only when removing it would
   deprive the reviewer of material context or a decision, or deprive the
   implementer of required behavior, a constraint, contract, risk, or
   verification target.
3. **Constrain what Until must check later.** If a choice affects behavior,
   compatibility, persisted/wire data, safety, scope, or proof of completion,
   state it in the plan so Plan check can compare it with the build.
   Everything else remains implementation decision-space.
4. **Define each contract once.** Give every material behavior, invariant, or
   external contract one canonical definition. Decisions explain why it was
   chosen, implementation steps say where it lands, and verification says how
   it is proved — none of those sections should restate the full contract.

### Reviewer layer (why this work exists)

1. **Problem** — what is wrong, missing, or risky *today*. Name the failure
   mode a reviewer can recognize, not a solution slogan.
2. **Why now** — what makes this the right next slice: a block, regression,
   customer need, milestone dependency, dogfood pain, or safety risk. "We
   should eventually" is not why now.
3. **Who cares** — who is affected if this ships or does not: customer,
   tenant, operator, internal user, or a concrete team process. If impact is
   only "cleaner code," say so explicitly and keep the plan small.
4. **Where this sits** — the Linear/ENG ticket, project-plan phase, ADR, or
   prior plan this continues. Floating work is harder to review and easier to
   over-scope.

Put 1–4 up front in an **executive summary or equivalent** (Goal / Context /
Problem). That front section must cover, in whatever shape fits the work:
**who is affected**, **why now**, **scope edges + done**, and a short
**technical headline** of what changes. Heading names and paragraph count can
vary; those four beats cannot. The front section is the door, not decoration.

**Reviewer-layer fence:** begin with the observable problem in the vocabulary
of the user or investigation, not the traced implementation mechanisms. Before
the short technical headline, do not use file paths, code fences,
language-level signatures, package/type names, SQL/protobuf details, or
internal routing labels such as "custom loop executor".
Those belong in the implementer layer. The technical headline may name the
minimum mechanism needed to orient review, but it must remain understandable
without the sections below.

### Decisions already made

5. **Material resolved questions** — carry forward only decisions that affect
   outcome, scope, compatibility, security/privacy, externally consumed
   contracts, or implementation direction. Record decision + rationale (or a
   material rejected alternative) so review does not re-litigate the chat.
   Explain *why* here; state the actual build requirement once in the
   implementer layer rather than duplicating it across sections. Do not
   preserve every conversational branch merely because it occurred. Open
   questions that remain must be called out as blockers, not buried.

### Implementer layer (what ships)

6. **Single concern** — one goal, no smuggled "and".
7. **Anchored claims** — every behavioral change names the concrete surface
   it lives on: file, endpoint, table/column, config key, event, or a function
   when that function is materially constrained.
   *"In `sync.go`, retry transient fetch failures up to the agreed limit"* —
   NOT *"make syncing more reliable."* This is what lets Until verify the build
   against the plan without dictating the helper structure.
8. **External contracts are exact; internal design is delegated** — spell the
   concrete name and shape for externally consumed APIs, MCP/tool schemas,
   persisted fields, events, wire formats, and caller-visible behavior
   (parameters/types, return/error shape, request/response fields, tool params,
   table/column names). For persisted data this includes material type,
   allowed values, nullability/default/backfill semantics, and compatibility
   constraints. For wire data this includes field numbers/keys and enum values.
   For caller-visible failures this includes the observable status/error/result
   contract. These are expensive to walk back and belong in review.
   For an MCP/tool contract, exact means the tool name, JSON input/output
   fields, and observable success/error behavior. It does NOT mean Go/TypeScript
   struct definitions, dependency fields, constructors, internal interfaces,
   or method bodies.
   Internal package boundaries may be named when they constrain the build, but
   routine internal types, interfaces, helper signatures, control flow, and
   code belong to the implementer unless a genuinely non-obvious algorithm
   must be agreed here. Their absence is deliberate delegation, not an
   incomplete plan.
9. **Scope fence** — state what this plan does NOT do.
10. **Done means** — one sentence: the observable outcome when it ships.
11. **Tests / verification** — name the behaviors that prove it works (not
    the implementation surface), or a one-line reason none fits. Include
    dogfood or manual validation when automated coverage cannot see the
    failure mode. "Test later" is not allowed.

For each material change, the implementer layer must collectively make five
things recoverable without guesswork:

- **Surface** — where the change lands.
- **Required behavior** — what must become true.
- **Invariant** — what must remain true.
- **External/Plan difference contract** — the exact caller-, wire-, storage-, safety-,
  or scope-sensitive choice Until must later compare, when one exists.
- **Proof** — the test or check that demonstrates the behavior, invariant, and
  contract.

Do not turn these into repetitive headings or restate the same requirement five
times. Put each material contract in one canonical place. Elsewhere, reference
its short name or the behavior being proved instead of reproducing field lists,
enum values, error shapes, or scope prose. If a material change has no
external/Plan difference contract, leave that internal choice to the implementer
rather than inventing one.

Code blocks are optional. Include one only when it materially clarifies an
external contract or a genuinely non-obvious algorithm that review must
settle. Never pre-write routine internal implementation in the plan.

Optional and useful, but not a substitute for the above: a todo list for the
implementer, diagrams, wire formats, doc deliverables. Add them only when a
reviewer or implementer would lose something material without them.

## Pre-submit check — verify before you hand it over

Before handing the draft over for the read-through (§4), re-read the
document against the criteria above. This is author due-diligence, and it is
done SILENTLY — never grade the plan in chat, recite criteria numbers at
your partner, or report a self-assessment alongside the handoff. The
document itself, with the evidence folded in, is what they read.

The check is about evidence, not scoring:

- **Name (to yourself) the riskiest claim** — the single claim most likely
  to sink this plan. If it rests on nothing — no command run, file read, or
  doc checked in this session backs it up — the plan is not ready: go
  verify it (run the command, read the deploy pipeline, check what the
  managed service owns) and fold the evidence into the plan BEFORE the
  handoff. Deferring it to the build is how the hard parts get skipped.
- **Mechanisms touched but never traced are riskiest-claim candidates by
  default:** how the change actually deploys, how it rolls back, and what
  external or managed systems own parts of the surface. If the plan changes
  something it never traced, that IS the riskiest claim.
- **A weakness your partner should weigh stays visible.** If the re-read
  leaves you with a genuine concern, say it at the handoff in one plain
  sentence ("one thing worth flagging before you read: ..."). Otherwise
  hand the document over without ceremony — no scores, no "n/11", no
  criteria numbers in chat.
- **Apply the deletion test to every line.** Ask: "If this line disappeared,
  would a reviewer lose material context or a decision, or would the
  implementer lose required behavior, a constraint, contract, risk, or
  verification target?" If not, remove it. If removal would make the plan
  ambiguous, ungrounded, or non-executable, keep it. What remains unstated
  after this pass is intentionally delegated implementation decision-space.
- **Mechanically inspect code-shaped detail.** Any fenced implementation code,
  or prose spelling a new internal `func`, `type`, `interface`, constructor,
  struct field list, or method body, is presumed implementer-owned. Replace it
  with behavior/boundary prose unless it is an externally consumed contract or
  the non-obvious algorithm review explicitly needs to settle.
- **Run the Plan difference question.** For every behavior, invariant, external
  contract, safety boundary, and scope exclusion the author cares about, could
  Until determine from the final diff and test evidence whether it was honored?
  If not, make the requirement or its proof more concrete. Do not solve this by
  specifying internal helper design.
- **Deduplicate after the Plan difference question.** When the same requirement
  appears in Decisions, What changes, External contracts, Done means, and
  Verification, keep its full definition only in the canonical contract
  location. Retain only rationale, location, observable outcome, or proof in
  the other sections. Repetition is not extra precision.

## Submit

Once the pre-submit check is clean and your partner has read the file and
said to submit (§4):

1. Resolve the repository from the current checkout's `git remote origin`.
   Do not infer it from README text, fixture provenance, package metadata, or
   conversation wording when the remote is available.
2. Call `submit_plan` with the title, resolved repo, and (if named) reviewer,
   using the drafted file as the plan body.
3. Run the shell command it returns to upload the plan body.
4. Call `get_plan` to confirm the plan landed and read its server-owned
   `review.requirement`.
5. If it is `not_required`, do not request review or another reviewer,
   regardless of `policy_reason` or membership. Report implementation ready,
   then STOP for a fresh “implement now” before loading `implementing-a-plan`.
6. If it is `required`, load `getting-a-review`.
7. Otherwise, report not cleared and STOP; never infer from `policy_reason`.

### Source Control setup required

If `submit_plan` returns `source_control_setup_required` without an
`UNTIL-<digits>`
plan ID, read and follow [source-control-setup.md](source-control-setup.md).
That response is a blocker, not a submission. Do not continue to review or
implementation until the recovery instructions finish with an uploaded,
confirmed plan.

## THE TRAP: harness plan modes have their own "build" exit — do not take it

Cursor's local Plan Mode ends with a Build button. **Build is neither submission
nor implementation consent.** Step 0's first action under Build is `get_plan`:
no plan yet → present the draft and stop for “submit it”; submitted but not
cleared → stop; cleared → report ready and stop for a fresh “implement now.”
Never mark Step 0 complete without that `get_plan` result, and never edit on
the Build turn. Cursor Cloud Agents skip this local path entirely via
`implementing-a-plan`, not via a skip clause inside Step 0.

## Red Flags — the plan is not ready

| Signal | Do this |
|--------|---------|
| Goal contains "and" | Split into separate plans |
| ">15 min to review" / >5 files / multiple layers | Cut to the steel thread |
| "We'll figure out details while building" | Anchor the claims now |
| Can't name the endpoint/table/function | Understand the surface before planning it |
| Can't spell an externally consumed API/tool contract | Its caller-visible shape is contract; read more, don't defer it to the build |
| Internal code/signatures appear without an external-contract or non-obvious-algorithm reason | Return to required behavior, boundaries, and verification; delegate the implementation |
| A sentence survives only because it sounds thorough | Delete it unless a reviewer or implementer loses something material |
| The same contract is fully restated in several sections | Keep one canonical definition; make the other sections reference rationale, location, outcome, or proof |
| "Update the service" with no files, behavior, contracts, or tests | Add executable grounding — delegation is not vagueness |
| No way to tell if it worked | Add "done means" + tests / verification |
| Opens with solution, never states the problem | Add problem + why now before the technical body |
| No one is named as affected | Add who cares, or explicitly mark internal-only and keep scope tight |
| Reviewer would have to re-ask brainstorming questions | Move those answers into Resolved questions |
| Plan is long but still vague on impact | Cut padding; fix substance — length is not quality |
