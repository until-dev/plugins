import { dirname, isAbsolute, resolve } from 'node:path';

const SHELL_SPLIT = /\s*(?:&&|\|\||;|\|)\s*/;

const SAFE_SHELL_COMMANDS = new Set([
  '[',
  'cat',
  'cd',
  'cut',
  'echo',
  'false',
  'head',
  'ls',
  'printf',
  'pwd',
  'rg',
  'stat',
  'test',
  'true',
  'wc',
  'which',
]);

const SAFE_GIT_COMMANDS = new Set([
  'diff',
  'log',
  'ls-files',
  'ls-tree',
  'rev-parse',
  'show',
  'status',
]);

const SAFE_BIN_PREFIXES = [
  '/bin/',
  '/usr/bin/',
  '/usr/local/bin/',
  '/opt/homebrew/bin/',
];

function stripEnvAssignments(tokens: string[]): string[] {
  const out = [...tokens];
  while (out.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(out[0]!)) {
    out.shift();
  }
  return out;
}

function safeGitInspection(tokens: string[]): boolean {
  const unsafeFlags = new Set(['--ext-diff', '--textconv', '--output']);
  if (tokens.some((t) => unsafeFlags.has(t) || t.startsWith('--output='))) {
    return false;
  }
  let index = 1;
  while (index < tokens.length && tokens[index]!.startsWith('-')) {
    if (['-C', '--git-dir', '--work-tree'].includes(tokens[index]!)) {
      index += 2;
    } else {
      index += 1;
    }
  }
  if (index >= tokens.length) return false;
  const subcommand = tokens[index]!;
  const rest = tokens.slice(index + 1);
  if (SAFE_GIT_COMMANDS.has(subcommand)) return true;
  if (subcommand === 'remote') {
    return rest.length > 0 && ['-v', 'get-url'].includes(rest[0]!);
  }
  if (subcommand === 'branch') {
    const safeFlags = new Set([
      '-a',
      '--all',
      '-r',
      '--remotes',
      '-v',
      '-vv',
      '--list',
      '--show-current',
      '--no-color',
    ]);
    return rest.every((t) => safeFlags.has(t) || t.startsWith('--format='));
  }
  if (subcommand === 'symbolic-ref') {
    return (
      rest.length === 1 &&
      rest[0] === 'HEAD' ||
      (rest.length === 2 && rest[0] === '-q' && rest[1] === 'HEAD') ||
      (rest.length === 2 && rest[0] === '--short' && rest[1] === 'HEAD')
    );
  }
  return false;
}

function segmentTokens(segment: string): string[] | null {
  return posixShlexSplit(segment.trim());
}

function posixShlexSplit(segment: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]!;
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inDouble = false;
      else current += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (inSingle || inDouble || escape) return null;
  if (current) tokens.push(current);
  return tokens;
}

function executableAllowed(executablePath: string): boolean {
  if (dirname(executablePath) && isAbsolute(executablePath)) {
    const abs = resolve(executablePath);
    if (!SAFE_BIN_PREFIXES.some((p) => abs.startsWith(p))) return false;
  }
  return true;
}

export function shellIsReadOnly(cmd: string): boolean {
  if (!cmd.trim()) return true;
  if (cmd.includes('`') || cmd.includes('$(')) return false;
  const withoutDevNull = cmd.replace(/\d*>\s*\/dev\/null/g, '');
  if (withoutDevNull.includes('>')) return false;

  for (const segment of cmd.split(SHELL_SPLIT)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    let tokens = segmentTokens(trimmed);
    if (tokens === null) return false;
    tokens = stripEnvAssignments(tokens);
    if (tokens.length === 0) continue;
    if (!executableAllowed(tokens[0]!)) return false;
    const executable = tokens[0]!.includes('/')
      ? tokens[0]!.split('/').pop()!
      : tokens[0]!;
    if (executable === 'git') {
      if (!safeGitInspection(tokens)) return false;
      continue;
    }
    if (!SAFE_SHELL_COMMANDS.has(executable)) return false;
    if (
      executable === 'rg' &&
      tokens.slice(1).some((t) => t === '--pre' || t.startsWith('--pre='))
    ) {
      return false;
    }
  }
  return true;
}

export function isMutatingShell(cmd: string): boolean {
  return !shellIsReadOnly(cmd);
}
