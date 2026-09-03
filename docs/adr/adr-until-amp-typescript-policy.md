# ADR: Amp Until Rule in TypeScript

## Status

Accepted (ENG-6460 / UNTIL-1053).

## Context

Amp can call Until over MCP and load Until skills, but Claude Code hooks do not run there. Without a host plugin, Amp can edit product code with no submitted Plan if the model ignores the skills.

Other hosts enforce the Until Rule via Python hooks (`until-commit-gate`, `until-track-state`) or by spawning them (OpenCode). Amp needs the same behavior without spawning Python.

## Decision

Implement the Until Rule in TypeScript under `plugins/amp/`:

- `policy.ts` — pure session reduction and gate decisions (no filesystem, no Amp types). Filesystem discovery of `.until-method` lives in `repo.ts`. Path canonicalization (`realpathLoose`) lives in `paths.ts` and is applied by `adapter.ts` before `decideGate`. `GateFacts.untilMethodRoot` comes from `findUntilRepo` on the write **target** for file tools, otherwise the tool or event cwd.
- `path-math.ts` — resolve-only containment used by `policy.ts`.
- `repo.ts` — `.until-method` discovery. Walks parents even when the start path does not exist yet (new-file writes).
- `adapter.ts` — Amp glue: MCP unwrap, tool classification, session file I/O, bootstrap, MCP registration. Home comes only from `process.env.HOME`; a missing or empty `HOME` fail-opens. Spawn names `task` / `oracle` / `subagent` match case-insensitively.
- `index.ts` — Amp plugin entry at the package root. Denied `tool.call` events return `{ action: 'reject-and-continue', message }` (Amp's documented API) and notify with the user-facing copy.

Session files remain at `~/.until/state/session-<thread.id>.json`, matching other hosts. Gate copy matches `until-commit-gate` verbatim.

### Visible bootstrap (accepted)

Amp has no hidden or system-context injection API for plugins. James and Dylan accepted that Until Loop guidance must appear as a visible `thread.append` user message on `session.start` (`until:using-until bootstrap for amp`). That is the host path, not a fallback. A second `session.start` on the same thread is a no-op when the marker is already present.

### First-load MCP (observed 2026-09-02)

A directory plugin at `~/.config/amp/plugins/until` (real files, not a symlink of the whole `plugins/` tree) registered `session.start`, `tool.call`, `tool.result`, and `until_skill`. On first load, Amp listed the Until MCP server as **awaiting approval**. After `amp mcp approve until`, the server connected with 39 Until tools. Workspace trust is separate from MCP approval; tools can be connected while the workspace is still untrusted. Docs must not claim MCP tools appear in the first thread before that approval step.

## Consequences

- TypeScript policy must stay aligned with Python hooks; contract fixtures are transcribed from `plugins/private-evals/until-plugin-contracts/`.
- Pi and OpenCode packaging must remain unchanged (`exports`, `.pi`, `.opencode` paths).
- Amp directory install clones `until-dev/plugins` into `~/.config/amp/plugins/until` or a personal plugin repo; not `amp plugins add <url>`.

## Rejected alternatives

- Spawning Python hooks from Amp (OpenCode pattern) — extra process, fragile on Amp’s runtime.
- Shared npm `@until/policy` package — out of scope for this change.
- Rewriting Python hooks in TypeScript for all hosts — Amp-only port.
