# Set up Until

Install the plugin first. Until will guide you through creating or joining a
workspace when you begin using it. You do not need to connect source control
before installation.

## Requirements

- Claude Code, Codex, Cursor or Pi
- macOS or Linux
- `python3` on `PATH` for the Claude Code and Cursor enforcement hooks

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

Claude Code and Cursor expose different hook events, so their exact enforcement
coverage differs. The hooks guard supported coding actions; they are not a
general-purpose security sandbox.

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
not include the deterministic enforcement hooks used by Cursor and Claude Code.

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

Refresh the installed Pi package with:

```bash
pi update npm:pi-until-loop
```

Git tags are immutable. To move a Git install to a later Until release, remove
this tagged source and install the newer tagged source.

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

Next: [Run your first Until Loop](first-until-loop.md).
