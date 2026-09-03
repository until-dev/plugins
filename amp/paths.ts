import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { expandHome, shellTokens } from './path-math.ts';

export {
  containedPath,
  expandHome,
  isShapeDoc,
  pendingUploadCommandMatches,
  safeAbsolutePathSubstitution,
  shellTokens,
  targetsStateDir,
} from './path-math.ts';

/** Match Python `os.path.realpath` (non-strict): follow symlinks on the existing prefix. */
export function realpathLoose(target: string): string {
  const absolute = resolve(target);
  try {
    return realpathSync(absolute);
  } catch {
    const missing: string[] = [];
    let current = absolute;
    while (true) {
      const parent = dirname(current);
      if (parent === current) return absolute;
      missing.unshift(basename(current));
      current = parent;
      try {
        return join(realpathSync(current), ...missing);
      } catch {
        continue;
      }
    }
  }
}

export function canonicalizeFsTarget(
  target: string,
  cwd: string | undefined,
  home: string,
): string {
  let path = expandHome(target, home);
  if (!isAbsolute(path)) {
    path = join(cwd ?? process.cwd(), path);
  }
  return realpathLoose(path);
}

function looksLikeFsToken(tok: string): boolean {
  return (
    tok.startsWith('/') ||
    tok.startsWith('~') ||
    tok.startsWith('$HOME') ||
    tok.startsWith('${HOME}') ||
    tok.includes('.until')
  );
}

function replaceFsToken(cmd: string, tok: string, canonical: string): string {
  const quotedSingle = `'${tok}'`;
  if (cmd.includes(quotedSingle)) {
    return cmd.split(quotedSingle).join(`'${canonical}'`);
  }
  const quotedDouble = `"${tok}"`;
  if (cmd.includes(quotedDouble)) {
    return cmd.split(quotedDouble).join(`"${canonical}"`);
  }
  return cmd.split(tok).join(canonical);
}

/** Rewrite filesystem tokens to realpath form before a disk-free decideGate. */
export function rewriteFsTokens(
  cmd: string,
  cwd: string | undefined,
  home: string,
): string {
  const tokens = shellTokens(cmd);
  if (tokens === null) return cmd;
  let rewritten = cmd;
  for (const tok of tokens) {
    if (!looksLikeFsToken(tok)) continue;
    const canonical = canonicalizeFsTarget(tok, cwd, home);
    if (canonical !== tok) {
      rewritten = replaceFsToken(rewritten, tok, canonical);
    }
  }
  return rewritten;
}
