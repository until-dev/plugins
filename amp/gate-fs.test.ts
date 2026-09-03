import { expect, test } from 'bun:test';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateClassifiedTools } from './adapter.ts';
import { canonicalizeFsTarget, rewriteFsTokens } from './paths.ts';
import { containedPath, targetsStateDir } from './path-math.ts';
import { findUntilRepo } from './repo.ts';

test('findUntilRepo walks parents when the start path does not exist yet', () => {
  const home = join(import.meta.dir, '.test-home-missing-start');
  const repo = join(home, 'marked');
  mkdirSync(repo, { recursive: true });
  writeFileSync(join(repo, '.until-method'), '');
  try {
    expect(
      findUntilRepo(join(repo, 'does-not-exist-yet', 'new-file.ts'), home),
    ).toBe(repo);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('adapter realpath makes symlink aliases containable with resolve-only math', () => {
  const home = join(import.meta.dir, '.test-home-symlink-state');
  const untilRoot = join(home, '.until');
  const stateDir = join(untilRoot, 'state');
  const alias = join(home, 'state-alias');
  mkdirSync(stateDir, { recursive: true });
  symlinkSync(stateDir, alias);
  try {
    const skipAlias = join(alias, 'skip-x');
    expect(containedPath(skipAlias, stateDir, '/tmp', home)).toBeNull();
    expect(
      containedPath(
        canonicalizeFsTarget(skipAlias, '/tmp', home),
        canonicalizeFsTarget(stateDir, undefined, home),
        '/tmp',
        home,
      ),
    ).not.toBeNull();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('state-dir shell tokens through a symlink are denied after adapter canonicalize', () => {
  const home = join(import.meta.dir, '.test-home-symlink-shell');
  const untilRoot = join(home, '.until');
  const stateDir = join(untilRoot, 'state');
  const alias = join(home, 'state-alias');
  mkdirSync(stateDir, { recursive: true });
  symlinkSync(stateDir, alias);
  try {
    const cmd = `touch '${join(alias, 'skip-x')}'`;
    expect(targetsStateDir(cmd, '/tmp', untilRoot, stateDir, home)).toBe(false);
    const rewritten = rewriteFsTokens(cmd, '/tmp', home);
    expect(
      targetsStateDir(
        rewritten,
        '/tmp',
        canonicalizeFsTarget(untilRoot, undefined, home),
        canonicalizeFsTarget(stateDir, undefined, home),
        home,
      ),
    ).toBe(true);
    const decision = evaluateClassifiedTools(
      'symlink-shell',
      [
        {
          kind: 'file-write',
          targetPath: join(alias, 'skip-convo'),
          cwd: '/tmp',
        },
      ],
      '/tmp',
      home,
    );
    expect(decision.allow).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
