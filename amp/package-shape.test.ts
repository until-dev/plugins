import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pluginRoot = resolve(import.meta.dir, '..');
const pkg = JSON.parse(
  readFileSync(resolve(pluginRoot, 'package.json'), 'utf8'),
);

test('exports only server entry', () => {
  expect(Object.keys(pkg.exports)).toEqual(['./server']);
});

test('pi extensions unchanged', () => {
  expect(pkg.pi.extensions).toEqual(['./.pi/extensions/until.ts']);
});

test('files includes amp plugin artifacts', () => {
  expect(pkg.files).toContain('index.ts');
  expect(pkg.files.some((f: string) => f === 'amp' || f === 'amp/')).toBe(true);
});

test('package scripts add only the Amp test script', () => {
  expect(Object.keys(pkg.scripts).sort()).toEqual(
    ['test:amp', 'validate:package'].sort(),
  );
  expect(pkg.scripts['test:amp']).toContain('tsc --noEmit');
  expect(pkg.scripts['test:amp']).toContain('bun test amp/');
});
