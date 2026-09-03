# Set up Until

Install the plugin first. Until will guide you through creating or joining a
workspace when you begin using it. You do not need to connect source control
before installation.

## Requirements

- Claude Code, Codex, Factory Droid, OpenCode, Cursor, Pi or Amp
- macOS or Linux
- `python3` on `PATH` for the Claude Code, Factory Droid, OpenCode and Cursor enforcement hooks (Amp enforces in TypeScript inside the plugin)

Windows is not supported yet. The guidance may load, but the hooks that enforce
the Until Rule are not reliably launched or validated there.

## Claude Code

Start Claude Code and install Until:

```text
claude
> /plugin marketplace add until-dev/plugins
> /plugin install until@until
```

Restart the session, run `/mcp` to complete authentication, then start a fresh
conversation. Until will guide you through creating or joining a workspace.

Claude Code loads the enforcement hooks from the plugin. No separate hook
installation is required.

## Codex

Install Until through Codex's plugin marketplace:

```bash
codex plugin marketplace add until-dev/plugins
codex plugin add until@until
```

Restart Codex and start a new task. The plugin registers Until's MCP server
automatically.

## Factory Droid

Install Until from the Factory marketplace:

```bash
droid plugin marketplace add https://github.com/until-dev/plugins
droid plugin install until@until --scope user
```

Restart Droid and start a fresh session. Complete MCP authentication when
Until asks. The plugin supplies skills, MCP configuration and enforcement hooks
from the same root as Claude Code. Droid loads the wrapped Claude-compatible
`hooks.json` from that root; a native `.factory-plugin/` manifest also ships
beside `.claude-plugin/` and points at the same `./` source.

Factory Droid names shell and file tools differently from Claude Code. The
main Droid session is enforced on `Execute` (shell) and `Create`, `Edit`, and
`ApplyPatch` (files). Claude Code uses `Bash`, `Write`, and `Edit` for the
same jobs. The shared commit gate maps each host onto the same enforcement
paths.

While Until is enforcing (a Plan is in flight or the cwd is a `.until-method`
repository), the main session also denies `Task` spawns on Claude Code and
Factory Droid. Idle sessions in unmarked repositories may still use `Task`.

If `python3` cannot run the hook, enforcement fails open and the tool is
allowed — including `Task`. Until is a workflow guard, not a security sandbox.

For local pre-release testing, add this repository's plugin directory as a
marketplace source, then install from it:

```bash
droid plugin marketplace add /absolute/path/to/workspace/plugins
droid plugin install until@until --scope user
```

Windows is not supported for Factory Droid enforcement hooks.

## OpenCode

OpenCode 1.18.23 or later is required.

Install Until in OpenCode's global configuration:

```bash
opencode plugin @until-dev/plugins --global
```

Restart OpenCode and authenticate the Until MCP server:

```bash
opencode mcp auth until
```

Confirm that OpenCode can see the connection:

```bash
opencode mcp list
```

Start a fresh session. Until's initial guidance, on-demand skills and MCP tools
are supplied by the plugin; no repository-local files are required.

OpenCode enforcement covers the built-in `write`, `edit`, `apply_patch` and
`bash` tools. It does not claim to intercept tools supplied by unrelated
OpenCode plugins. The enforcement process requires `python3` and fails open if
the shared hook cannot run. This guard supports the Until workflow but is not a
general-purpose security sandbox.

## Cursor

Clone the plugin into a permanent location:

```bash
git clone https://github.com/until-dev/plugins.git ~/src/until-plugins
mkdir -p ~/.cursor/plugins/local
ln -s ~/src/until-plugins ~/.cursor/plugins/local/until
```

Install the enforcement hooks:

```bash
cd ~/src/until-plugins
./hooks/install-user-hooks.sh
```

If `~/.cursor/hooks.json` already exists, the installer will print the entries
you need to merge into that file without replacing other entries in the same
hook arrays. It will not overwrite your existing hooks.

Reload Cursor with **Developer: Reload Window**, then start a fresh
conversation and complete authentication when Until asks.

Cursor currently loads the plugin's session hook but not all of its enforcement
events. The user-level hook installation closes that gap. In an ordinary
repository, the hooks remain inactive until Plan submission or source-control
setup begins. A repository containing `.until-method` is default-closed, so the
hooks enforce the Until Rule before a Plan exists.

Claude Code, Codex, Factory Droid, OpenCode, Cursor, Pi and Amp expose different plugin interfaces,
so their exact enforcement coverage differs. Amp enforces in TypeScript inside the plugin;
Claude Code, Factory Droid, OpenCode and Cursor use Python hooks where noted.
Pi does not include deterministic enforcement. The guards cover supported coding
actions; they are not a general-purpose security sandbox.

## Pi

Install Until from npm:

```bash
pi install npm:pi-until-loop
```

`pi install npm:@until-dev/plugins` still loads the same plugin if you already
use that name. It is not the catalog listing.

Git remains an alternative:

```bash
pi install git:github.com/until-dev/plugins@v0.2.5
```

For local pre-release testing, install this repository's plugin directory:

```bash
pi install /absolute/path/to/workspace/plugins
```

Start Pi and authenticate the bundled MCP adapter:

```text
/mcp-auth until
```

Complete the browser flow, then run `/mcp` to confirm that the Until server is
available. Start a fresh Pi session so the Until startup guidance is loaded.

Pi support includes the Until skills, startup guidance and MCP tools. It does
not include the deterministic enforcement hooks used by Claude Code, Factory
Droid, Cursor and OpenCode.

## Amp

Amp requires a directory plugin. Do not use `amp plugins add <url>` — that installs single-file plugins only and cannot register skills.

**System plugin (CLI on this machine):**

```bash
git clone https://github.com/until-dev/plugins.git ~/.config/amp/plugins/until
```

Reload Amp (`plugins: reload` or restart). The directory name must be `until`.

**Personal plugins (CLI and website):**

```bash
amp clone user-plugins
git clone https://github.com/until-dev/plugins.git <that-repo>/until
```

Commit if Amp asks. Personal plugins sync to [ampcode.com](https://ampcode.com).

On first load the plugin merges `until` into `amp.mcpServers` pointing at `https://run.until.dev/mcp` unless you already configured Until. Amp then lists that server as **awaiting approval** until you run `amp mcp approve until` (or approve it in Settings). Until tools do not appear in the first thread before that approval. After approval, `amp mcp doctor` should show Until connected (39 tools in the 2026-09-02 CLI check). Complete OAuth when prompted.

**Verify:** `amp plugins list` shows `until`; after `amp mcp approve until`, `amp mcp doctor` shows `until` connected; a new thread includes `until:using-until bootstrap for amp` as a visible user message (Amp has no hidden plugin context).

**Update:** `git -C ~/.config/amp/plugins/until pull` or `git -C <user-plugins>/until pull`, then reload.

**Uninstall:** delete the `until` directory; remove `amp.mcpServers.until` if added by the plugin; reload.

**MCP recovery:** Settings → MCP → add `https://run.until.dev/mcp` (website), or `amp mcp add until https://run.until.dev/mcp` (CLI).

Orbs are not supported.

## Source control

You can install Until and begin shaping a change before connecting source
control. When Until needs to submit a Plan for work that will become a pull
request, it will give you a setup link.

Complete setup through that link, return to the same conversation, and send
`continue`. The agent must retry the original submission and finish saving the
Plan; Until does not resume automatically. Source control lets Until link the
eventual pull request to its Plan and run Plan checks.

## Verify the installation

Start a fresh conversation and ask your agent to implement a small change.
Until should begin by helping you understand and shape the change. It should
not write implementation code immediately.

Continue until you have read and submitted a Plan. After its upload and Review
policy clearance are confirmed, Until should stop again and wait for you to
explicitly start implementation.

If either stop is missing, see [Troubleshooting](troubleshooting.md).

## Updating

Claude Code updates Until through its plugin manager.

Update Until through Codex's plugin manager, then restart Codex.

Update Factory Droid through its plugin manager, then restart Droid.

Refresh Until in OpenCode and restart it:

```bash
opencode plugin @until-dev/plugins --global --force
```

Refresh the installed Pi package with:

```bash
pi update npm:pi-until-loop
```

Git tags are immutable. To move a Git install to a later Until release, remove
this tagged source and install the newer tagged source.

For Amp:

```bash
git -C ~/.config/amp/plugins/until pull
```

Or `git -C <user-plugins>/until pull`, then reload Amp.

For Cursor, update the clone:

```bash
cd ~/src/until-plugins
git pull
```

Reload Cursor after updating. Existing hook entries point into the clone, so an
ordinary pull does not require reinstalling them. If the clone moved or the
entries are missing, follow [Troubleshooting](troubleshooting.md#until-enforcement-hooks-do-not-run).

## Uninstalling

In Claude Code, remove Until through the plugin manager.

In Codex, remove Until and its marketplace:

```bash
codex plugin remove until@until
codex plugin marketplace remove until
```

In Factory Droid, remove Until through the plugin manager.

In OpenCode, remove `@until-dev/plugins` from the `plugin` array in
`~/.config/opencode/opencode.json`, then restart OpenCode.

In Cursor, remove the local plugin or symlink. Then remove the Until entries
from `~/.cursor/hooks.json` if you installed them there.

In Pi, remove the source you installed:

```bash
pi remove npm:pi-until-loop
```

A Git install is removed with the same source you used to install it:

```bash
pi remove git:github.com/until-dev/plugins@v0.2.5
```

For a local pre-release installation, pass the same absolute plugin path to
`pi remove`.

For Amp, delete `~/.config/amp/plugins/until` or `<user-plugins>/until`, remove
`amp.mcpServers.until` if the plugin added it, and reload Amp.

Next: [Run your first Until Loop](first-until-loop.md).
