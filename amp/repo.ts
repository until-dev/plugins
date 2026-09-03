import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { expandHome } from './paths.ts';

/** Walk cwd parents looking for `.until-method`. Adapter-only; keep out of policy.ts. */
export function findUntilRepo(
  start: string | undefined,
  home: string,
): string | null {
  if (!start) return null;
  let p = resolve(expandHome(start, home));
  try {
    if (statSync(p).isFile()) {
      p = dirname(p);
    }
  } catch {
    // Missing path: still walk parents, matching until-commit-gate.
  }
  for (let i = 0; i < 30; i++) {
    if (existsSync(join(p, '.until-method'))) return p;
    const parent = dirname(p);
    if (parent === p) return null;
    p = parent;
  }
  return null;
}
