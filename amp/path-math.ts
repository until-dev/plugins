import { isAbsolute, join, relative, resolve } from 'node:path';

const SHAPE_DOC_DIRS = new Set(['design', 'specs']);

export function expandHome(target: string, home: string): string {
  for (const prefix of ['${HOME}', '$HOME', '~']) {
    if (target === prefix || target.startsWith(prefix + '/')) {
      return home + target.slice(prefix.length);
    }
  }
  return target;
}

export function containedPath(
  target: string,
  root: string | null,
  cwd: string | undefined,
  home: string,
): string | null {
  if (!target) return null;
  target = expandHome(target, home);
  if (!isAbsolute(target)) {
    target = join(cwd ?? process.cwd(), target);
  }
  const resolved = resolve(target);
  if (root === null) return resolved;
  const rootResolved = resolve(root);
  const rel = relative(rootResolved, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return resolved;
}

export function isShapeDoc(
  target: string,
  cwd: string | undefined,
  home: string,
  methodRoot?: string | null,
): boolean {
  const resolved = containedPath(target, null, cwd, home);
  if (!resolved) return false;
  const repo = methodRoot ?? null;
  if (!repo) return false;
  const inRepo = containedPath(resolved, repo, undefined, home);
  if (!inRepo) return false;
  const rel = relative(resolve(repo), inRepo);
  const parts = rel.split(/[/\\]/);
  if (parts.length < 3 || parts[0] !== 'docs' || !SHAPE_DOC_DIRS.has(parts[1]!)) {
    return false;
  }
  const ext = parts[parts.length - 1]!.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'mdx';
}

export function shellTokens(cmd: string): string[] | null {
  const segments = cmd.split(/\s*(?:&&|\|\||;|\|)\s*/);
  const tokens: string[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const parsed = posixShlexSplit(trimmed);
    if (parsed === null) return null;
    tokens.push(...parsed);
  }
  return tokens;
}

export function targetsStateDir(
  cmd: string,
  cwd: string | undefined,
  untilRoot: string,
  stateDir: string,
  home: string,
): boolean {
  const tokens = shellTokens(cmd);
  if (tokens === null) {
    return cmd.includes('.until/state');
  }
  for (const tok of tokens) {
    const untilTarget = containedPath(tok, untilRoot, cwd, home);
    if (untilTarget === resolve(untilRoot)) return true;
    if (containedPath(tok, stateDir, cwd, home)) return true;
  }
  return false;
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

export function safeAbsolutePathSubstitution(value: string): boolean {
  if (/^\/[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return isAbsolute(value);
  }
  if (
    value.length >= 2 &&
    value[0] === value.at(-1) &&
    value[0] === "'" &&
    !value.slice(1, -1).includes("'")
  ) {
    return isAbsolute(value.slice(1, -1));
  }
  if (
    value.length >= 2 &&
    value[0] === value.at(-1) &&
    value[0] === '"' &&
    /^\/[A-Za-z0-9_@%+=:,./ -]+$/.test(value.slice(1, -1))
  ) {
    return isAbsolute(value.slice(1, -1));
  }
  return false;
}

export function pendingUploadCommandMatches(
  state: { pending_upload_command?: string } | null,
  cmd: string,
): boolean {
  const template = state?.pending_upload_command;
  if (typeof template !== 'string' || !template) return false;
  const placeholder = '<plan_file_path>';
  const count = (template.match(/<plan_file_path>/g) ?? []).length;
  if (count === 0) return cmd === template;
  if (count !== 1) return false;
  const [prefix = '', suffix = ''] = template.split(placeholder);
  if (!cmd.startsWith(prefix) || !cmd.endsWith(suffix)) return false;
  const end = suffix ? cmd.length - suffix.length : cmd.length;
  const replacement = cmd.slice(prefix.length, end);
  return safeAbsolutePathSubstitution(replacement);
}
