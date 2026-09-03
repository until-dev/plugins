import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideGate,
  mapUntilMcpTool,
  parseMcpResult,
  reduceSession,
  type ClassifiedTool,
  type GateDecision,
  type GateFacts,
  type SessionState,
} from './policy.ts';
import { findUntilRepo } from './repo.ts';
import {
  canonicalizeFsTarget,
  realpathLoose,
  rewriteFsTokens,
} from './paths.ts';

export const PRODUCTION_MCP_URL = 'https://run.until.dev/mcp';
export const BOOTSTRAP_MARKER = 'until:using-until bootstrap for amp';
const IMPORTANT_MARKER = '<EXTREMELY_IMPORTANT>';

export const REGISTERED_SKILLS = [
  'using-until',
  'brainstorming',
  'writing-a-good-plan',
  'getting-a-review',
  'implementing-a-plan',
  'checking-plan-differences',
] as const;

const adapterDir = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(adapterDir, '..');
const skillsDir = join(packageRoot, 'skills');

export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return (match?.[1] ?? content).trim();
}

export function ampToolMapping(): string {
  const sorted = [...REGISTERED_SKILLS].sort().join(', ');
  return `## Amp tool mapping

Amp qualifies Until skills as \`until:<name>\`. When an Until instruction names a skill, call \`until_skill\` with that skill name before following it, or load the Amp skill \`until:<name>\`.

Available Until skills: ${sorted}.

Until is connected as the \`until\` MCP server. When an Until instruction names a tool such as \`submit_plan\`, \`update_plan\`, or \`get_plan\`, call the corresponding tool from that server.`;
}

export function loadUsingUntilBody(): string | null {
  try {
    const path = join(skillsDir, 'using-until', 'SKILL.md');
    return stripFrontmatter(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function buildBootstrapContent(usingUntilBody?: string): string | null {
  const body = usingUntilBody ?? loadUsingUntilBody();
  if (!body) return null;
  return `${IMPORTANT_MARKER}
${BOOTSTRAP_MARKER}

You have Until.

The using-until skill content is included below and is already loaded for this Amp session. Follow it now. Do not try to load using-until again.

${body}

${ampToolMapping()}
</EXTREMELY_IMPORTANT>`;
}

export function loadSkillBody(name: string): string | null {
  try {
    const path = join(skillsDir, name, 'SKILL.md');
    return stripFrontmatter(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function untilSkillResult(name: string): string {
  const body = loadSkillBody(name);
  if (!body) return `Unknown Until skill: ${name}`;
  return body;
}

export function threadHasBootstrap(
  messages: Array<{ content?: unknown }>,
): boolean {
  for (const message of messages) {
    const content = message.content;
    if (typeof content === 'string' && content.includes(BOOTSTRAP_MARKER)) {
      return true;
    }
    if (Array.isArray(content)) {
      for (const part of content) {
        if (
          part &&
          typeof part === 'object' &&
          (part as { type?: string }).type === 'text' &&
          typeof (part as { text?: string }).text === 'string' &&
          (part as { text: string }).text.includes(BOOTSTRAP_MARKER)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function resolveUntilPaths(home: string | undefined): {
  untilRoot: string;
  stateDir: string;
} | null {
  if (!home) return null;
  const untilRoot = resolve(home, '.until');
  const stateDir = join(untilRoot, 'state');
  return { untilRoot, stateDir };
}

export function sessionPath(stateDir: string, threadId: string): string {
  return join(stateDir, `session-${threadId}.json`);
}

export function skipTokenPath(stateDir: string, threadId: string): string {
  return join(stateDir, `skip-${threadId}`);
}

export function readSessionFile(path: string): SessionState | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SessionState;
  } catch {
    return null;
  }
}

export function skipExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

export function writeSessionFile(path: string, state: SessionState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.tmp';
  const recorded = {
    ...state,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  writeFileSync(tmp, JSON.stringify(recorded, null, 2));
  renameSync(tmp, path);
}

export function deleteSessionFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // missing file is fine
  }
}

export function envHome(override?: string): string | undefined {
  if (override !== undefined) {
    return override === '' ? undefined : override;
  }
  const home = process.env.HOME;
  return home && home.length > 0 ? home : undefined;
}

export function buildGateFacts(
  threadId: string,
  cwd: string | undefined,
  home?: string,
): GateFacts | null {
  const resolvedHome = envHome(home);
  const paths = resolveUntilPaths(resolvedHome);
  if (!paths) return null;
  const { untilRoot, stateDir } = paths;
  const sessionFile = sessionPath(stateDir, threadId);
  const skipFile = join(stateDir, `skip-${threadId}`);
  const state = readSessionFile(sessionFile);
  const skipped = skipExists(skipFile);
  const untilMethodRoot = findUntilMethodRoot(cwd, resolvedHome);
  return {
    state,
    skipped,
    untilMethodRoot: untilMethodRoot ? realpathLoose(untilMethodRoot) : null,
    untilRoot: realpathLoose(untilRoot),
    stateDir: realpathLoose(stateDir),
    skipPath: skipFile,
    now: new Date(),
  };
}

function findUntilMethodRoot(
  cwd: string | undefined,
  home: string | undefined,
): string | null {
  if (!home) return null;
  return findUntilRepo(cwd, home);
}

export function applyToolResult(
  threadId: string,
  toolName: string,
  toolInput: Record<string, unknown> | null,
  rawResult: unknown,
  home?: string,
): void {
  const mapped = mapUntilMcpTool(toolName);
  if (!mapped) return;
  const result = parseMcpResult(rawResult);
  if (!result) return;
  const paths = resolveUntilPaths(envHome(home));
  if (!paths) return;
  const sessionFile = sessionPath(paths.stateDir, threadId);
  const prior = readSessionFile(sessionFile);
  const reduced = reduceSession(
    prior,
    mapped,
    toolInput,
    result,
    new Date(),
  );
  if (reduced.action === 'write') {
    writeSessionFile(sessionFile, reduced.state);
  } else if (reduced.action === 'delete') {
    deleteSessionFile(sessionFile);
  }
}

export function evaluateToolCall(
  threadId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  cwd?: string,
  home?: string,
): ReturnType<typeof decideGate> {
  try {
    const classified = classifyAmpToolCall(toolName, toolInput, cwd);
    return evaluateClassifiedTools(threadId, [classified], cwd, home);
  } catch {
    return { allow: true };
  }
}

export type McpServerConfig = Record<string, { url?: string; command?: string; args?: string[] }>;

export function mergeUntilMcpConfig(
  existing: McpServerConfig | undefined,
): { config: McpServerConfig; changed: boolean } {
  const base = existing ? { ...existing } : {};
  if (Object.prototype.hasOwnProperty.call(base, 'until')) {
    return { config: base, changed: false };
  }
  return {
    config: { ...base, until: { url: PRODUCTION_MCP_URL } },
    changed: true,
  };
}

export function defaultHome(): string | undefined {
  return envHome();
}

/** Frozen from Amp's agent options: oracle/subagent plus Task-style spawns. */
export const SPAWN_TOOL_NAMES = new Set(['task', 'oracle', 'subagent']);

const EDIT_TOOL_PAT =
  /write|edit|str_?replace|multi_?edit|apply_?patch|search_replace|delete|notebook|create/i;

const PATH_KEYS = [
  'file_path',
  'path',
  'target_file',
  'absolute_path',
  'filePath',
  'target_notebook',
] as const;

export type AmpNativeToolCall = {
  toolUseID?: string;
  tool: string;
  input: Record<string, unknown>;
};

export type AmpToolHelpers = {
  shellCommandFromToolCall: (
    event: AmpNativeToolCall,
  ) => { command: string; cwd?: string } | null;
  filesModifiedByToolCall: (event: AmpNativeToolCall) => string[] | null;
  filePathFromURI?: (uri: string) => string;
};

export function isSpawnToolName(toolName: string): boolean {
  return SPAWN_TOOL_NAMES.has(toolName.toLowerCase());
}

export function extractTargetPath(
  toolInput: Record<string, unknown>,
): string {
  for (const key of PATH_KEYS) {
    const value = toolInput[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function pathFromHelperUri(
  uri: string,
  filePathFromURI?: (uri: string) => string,
): string {
  if (filePathFromURI) return filePathFromURI(uri);
  if (uri.startsWith('file://')) {
    try {
      return decodeURIComponent(new URL(uri).pathname);
    } catch {
      return uri.replace(/^file:\/\//, '');
    }
  }
  return uri;
}

/**
 * Classify using Amp's host helpers when present. Policy only sees ClassifiedTool.
 * Shell helper wins (covers in-place sed). A non-null files array, even empty,
 * is a write (ApplyPatch with no path).
 */
export function classifyWithAmpHelpers(
  event: AmpNativeToolCall,
  helpers: AmpToolHelpers,
  cwd?: string,
): ClassifiedTool[] | null {
  const shell = helpers.shellCommandFromToolCall(event);
  if (shell && typeof shell.command === 'string') {
    return [
      {
        kind: 'shell',
        command: shell.command,
        cwd: shell.cwd ?? cwd,
      },
    ];
  }
  const files = helpers.filesModifiedByToolCall(event);
  if (files !== null) {
    if (files.length === 0) {
      return [{ kind: 'file-write', targetPath: '', cwd }];
    }
    return files.map((uri) => ({
      kind: 'file-write' as const,
      targetPath: pathFromHelperUri(uri, helpers.filePathFromURI),
      cwd,
    }));
  }
  if (isSpawnToolName(event.tool)) {
    return [{ kind: 'spawn', cwd }];
  }
  return null;
}

export function classifyAmpToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  cwd?: string,
): ClassifiedTool {
  if (isSpawnToolName(toolName)) {
    return { kind: 'spawn', cwd };
  }
  const shellCommand =
    typeof toolInput.command === 'string'
      ? toolInput.command
      : typeof toolInput.cmd === 'string'
        ? toolInput.cmd
        : undefined;
  if (
    shellCommand !== undefined ||
    /bash|shell|execute|run_terminal|terminal/i.test(toolName)
  ) {
    return {
      kind: 'shell',
      command: shellCommand ?? '',
      cwd,
    };
  }
  if (EDIT_TOOL_PAT.test(toolName)) {
    return {
      kind: 'file-write',
      targetPath: extractTargetPath(toolInput),
      cwd,
    };
  }
  return { kind: 'other', cwd };
}

function canonicalizeClassifiedTool(
  tool: ClassifiedTool,
  home: string,
): ClassifiedTool {
  const cwd = tool.cwd
    ? canonicalizeFsTarget(tool.cwd, undefined, home)
    : tool.cwd;
  return {
    ...tool,
    cwd,
    targetPath: tool.targetPath
      ? canonicalizeFsTarget(tool.targetPath, cwd ?? tool.cwd, home)
      : tool.targetPath,
    command: tool.command
      ? rewriteFsTokens(tool.command, cwd ?? tool.cwd, home)
      : tool.command,
  };
}

export function evaluateClassifiedTools(
  threadId: string,
  tools: ClassifiedTool[],
  cwd?: string,
  home?: string,
): GateDecision {
  for (const tool of tools) {
    const discoveryStart =
      tool.kind === 'file-write' && tool.targetPath
        ? tool.targetPath
        : (tool.cwd ?? cwd);
    const facts = buildGateFacts(threadId, discoveryStart, home);
    if (!facts) return { allow: true };
    const resolvedHome = envHome(home);
    const classified =
      resolvedHome !== undefined
        ? canonicalizeClassifiedTool(tool, resolvedHome)
        : tool;
    const decision = decideGate(facts, classified);
    if (!decision.allow) return decision;
  }
  return { allow: true };
}
