# Until plugins — context

Glossary for host integrations in this package.

## Session state

JSON at `~/.until/state/session-<conversation>.json`. Written when Until MCP tools run in a conversation; read by each host’s write-gate to decide allow/deny.

## Amp thread

Amp `thread.id`. Used as the conversation key for session state and skip tokens (`skip-<thread.id>`).
