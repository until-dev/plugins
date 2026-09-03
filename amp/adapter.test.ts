import { expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BOOTSTRAP_MARKER,
  buildBootstrapContent,
  mergeUntilMcpConfig,
  untilSkillResult,
  threadHasBootstrap,
  evaluateToolCall,
  PRODUCTION_MCP_URL,
  loadUsingUntilBody,
  classifyAmpToolCall,
  classifyWithAmpHelpers,
  evaluateClassifiedTools,
  type AmpToolHelpers,
} from './adapter.ts';
import {
  createUntilHandlers,
  type AmpEvent,
  type AmpEventContext,
} from '../index.ts';
import type { GateDecision } from './policy.ts';
import {
  parseMcpResult,
  mapUntilMcpTool,
} from './policy.ts';

test('parseMcpResult unwraps content text', () => {
  const inner = { id: 'UNTIL-1', stage: 'submitted' };
  const wrapped = {
    content: [{ type: 'text', text: JSON.stringify(inner) }],
  };
  expect(parseMcpResult(wrapped)).toEqual(inner);
});

test('mapUntilMcpTool by substring', () => {
  expect(mapUntilMcpTool('plugin-until_get_plan')).toBe('get_plan');
  expect(mapUntilMcpTool('submit_plan')).toBe('submit_plan');
  expect(mapUntilMcpTool('other')).toBeNull();
});

test('classify shell file spawn other', () => {
  expect(classifyAmpToolCall('Bash', { command: 'ls' }).kind).toBe('shell');
  expect(classifyAmpToolCall('Write', { file_path: '/tmp/x' }).kind).toBe(
    'file-write',
  );
  expect(classifyAmpToolCall('oracle', {}).kind).toBe('spawn');
  expect(classifyAmpToolCall('Oracle', {}).kind).toBe('spawn');
  expect(classifyAmpToolCall('Task', {}).kind).toBe('spawn');
  expect(classifyAmpToolCall('task', {}).kind).toBe('spawn');
  expect(classifyAmpToolCall('Read', { path: '/tmp/x' }).kind).toBe('other');
});

test('evaluateToolCall fail-open without home override on empty state', () => {
  const decision = evaluateToolCall(
    'thread-1',
    'Write',
    { file_path: '/tmp/product.txt' },
    '/tmp',
    '/tmp/amp-test-home-nonexistent',
  );
  expect(decision.allow).toBe(true);
});

test('until_skill known and unknown', () => {
  const body = untilSkillResult('using-until');
  expect(body).not.toMatch(/^Unknown Until skill:/);
  expect(body).toContain('Using Until');
  expect(untilSkillResult('nope')).toBe('Unknown Until skill: nope');
});

test('bootstrap includes marker mapping and skill body', () => {
  const bootstrap = buildBootstrapContent();
  expect(bootstrap).not.toBeNull();
  expect(bootstrap!).toContain(BOOTSTRAP_MARKER);
  expect(bootstrap!).toContain('already loaded for this Amp session');
  expect(bootstrap!).toContain('## Amp tool mapping');
  expect(bootstrap!).toContain('</EXTREMELY_IMPORTANT>');
  const stripped = loadUsingUntilBody();
  expect(bootstrap!).toContain(stripped!.slice(0, 40));
});

test('threadHasBootstrap detects marker', () => {
  expect(
    threadHasBootstrap([{ content: `hello ${BOOTSTRAP_MARKER} world` }]),
  ).toBe(true);
  expect(threadHasBootstrap([{ content: 'hello' }])).toBe(false);
});

test('mergeUntilMcpConfig sets production when absent', () => {
  const { config, changed } = mergeUntilMcpConfig({});
  expect(changed).toBe(true);
  expect(config.until?.url).toBe(PRODUCTION_MCP_URL);
});

test('mergeUntilMcpConfig preserves existing until server', () => {
  const existing = { until: { url: 'https://custom.example/mcp' } };
  const { config, changed } = mergeUntilMcpConfig(existing);
  expect(changed).toBe(false);
  expect(config.until?.url).toBe('https://custom.example/mcp');
});

test('in-flight write blocked via evaluateToolCall', () => {
  const home = join(import.meta.dir, '.test-home');
  const stateDir = join(home, '.until', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, 'session-t1.json'),
    JSON.stringify({ plan_id: 'UNTIL-501', stage: 'submitted' }),
  );
  try {
    const decision = evaluateToolCall(
      't1',
      'Write',
      { file_path: '/tmp/product.txt' },
      '/tmp',
      home,
    );
    expect(decision.allow).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('mergeUntilMcpConfig preserves until key without url', () => {
  const existing = { until: { command: 'npx', args: ['until-mcp'] } };
  const { config, changed } = mergeUntilMcpConfig(existing);
  expect(changed).toBe(false);
  expect(config.until).toEqual(existing.until);
});

test('evaluateToolCall fail-open when HOME is unset', () => {
  const previous = process.env.HOME;
  delete process.env.HOME;
  try {
    const decision = evaluateToolCall(
      'thread-missing-home',
      'Write',
      { file_path: '/tmp/product.txt' },
      '/tmp',
    );
    expect(decision.allow).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.HOME;
    else process.env.HOME = previous;
  }
});

test('deny path exposes agent and user strings', () => {
  const home = join(import.meta.dir, '.test-home-deny');
  const stateDir = join(home, '.until', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, 'session-t2.json'),
    JSON.stringify({
      plan_id: 'UNTIL-501',
      stage: 'submitted',
      review_requirement: 'required',
    }),
  );
  try {
    const decision = evaluateToolCall(
      't2',
      'Write',
      { file_path: '/tmp/product.txt' },
      '/tmp',
      home,
    );
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.agentMessage).toContain('UNTIL GATE');
      expect(decision.userMessage).toContain('awaiting peer review');
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('session.start appends exact bootstrap once', async () => {
  const expected = buildBootstrapContent();
  expect(expected).not.toBeNull();
  const appended: Array<{ role: string; content: string }> = [];
  const handlers = createUntilHandlers();
  const thread = {
    id: 'thread-bootstrap',
    append: async (msg: { role: string; content: string }) => {
      appended.push(msg);
    },
  };
  const event: AmpEvent = { thread, messages: [] };
  const ctx: AmpEventContext = { thread };
  await handlers.handleSessionStart(event, ctx);
  expect(appended).toEqual([{ role: 'user', content: expected! }]);
  await handlers.handleSessionStart(
    { thread, messages: [{ content: expected! }] },
    ctx,
  );
  expect(appended).toHaveLength(1);
});

test('evaluate throw fail-opens tool.call', async () => {
  const handlers = createUntilHandlers({
    evaluate: () => {
      throw new Error('classifier exploded');
    },
  });
  const result = await handlers.handleToolCall(
    {
      thread: { id: 't-throw' },
      tool: { name: 'Write', input: { file_path: '/tmp/x' } },
    },
    {},
  );
  expect(result).toEqual({ action: 'allow' });
});

test('deny returns reject-and-continue and notifies', async () => {
  const decision: GateDecision = {
    allow: false,
    agentMessage: 'agent-deny',
    userMessage: 'user-deny',
  };
  const notified: string[] = [];
  const handlers = createUntilHandlers({
    evaluate: () => decision,
  });
  const result = await handlers.handleToolCall(
    {
      thread: { id: 't-deny' },
      tool: { name: 'Write', input: { file_path: '/tmp/x' } },
    },
    { ui: { notify: (message) => notified.push(message) } },
  );
  expect(notified).toEqual(['user-deny']);
  expect(result).toEqual({
    action: 'reject-and-continue',
    message: 'agent-deny',
  });
});

test('deny still rejects when notify is absent', async () => {
  const handlers = createUntilHandlers({
    evaluate: () => ({
      allow: false,
      agentMessage: 'agent-deny',
      userMessage: 'user-deny',
    }),
  });
  const result = await handlers.handleToolCall(
    {
      thread: { id: 't-deny-no-ui' },
      tool: { name: 'Write', input: { file_path: '/tmp/x' } },
    },
    {},
  );
  expect(result).toEqual({
    action: 'reject-and-continue',
    message: 'agent-deny',
  });
});

test('Amp helpers classify shell instead of regex fallback', () => {
  const helpers: AmpToolHelpers = {
    shellCommandFromToolCall: () => ({ command: 'git commit -m test' }),
    filesModifiedByToolCall: () => null,
  };
  const classified = classifyWithAmpHelpers(
    { tool: 'some_host_shell', input: {} },
    helpers,
    '/tmp',
  );
  expect(classified).toEqual([
    { kind: 'shell', command: 'git commit -m test', cwd: '/tmp' },
  ]);
});

test('Amp helpers classify every modified file URI', () => {
  const helpers: AmpToolHelpers = {
    shellCommandFromToolCall: () => null,
    filesModifiedByToolCall: () => ['file:///tmp/a.ts', 'file:///tmp/b.ts'],
    filePathFromURI: (uri) => uri.replace('file://', ''),
  };
  const classified = classifyWithAmpHelpers(
    { tool: 'edit', input: {} },
    helpers,
    '/tmp',
  );
  expect(classified).toEqual([
    { kind: 'file-write', targetPath: '/tmp/a.ts', cwd: '/tmp' },
    { kind: 'file-write', targetPath: '/tmp/b.ts', cwd: '/tmp' },
  ]);
});

test('Amp helpers empty file list is an unknown-path write', () => {
  const helpers: AmpToolHelpers = {
    shellCommandFromToolCall: () => null,
    filesModifiedByToolCall: () => [],
  };
  expect(
    classifyWithAmpHelpers(
      { tool: 'apply_patch', input: {} },
      helpers,
      '/tmp',
    ),
  ).toEqual([{ kind: 'file-write', targetPath: '', cwd: '/tmp' }]);
});

test('default-closed file write discovers the marked repo from the target path', () => {
  const home = join(import.meta.dir, '.test-home-method-target');
  const repo = join(home, 'marked-repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(home, '.until', 'state'), { recursive: true });
  writeFileSync(join(repo, '.until-method'), '');
  try {
    const decision = evaluateToolCall(
      'method-target',
      'Write',
      { file_path: join(repo, 'does-not-exist-yet', 'new.ts') },
      '/tmp',
      home,
    );
    expect(decision.allow).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('method discovery uses the classified tool cwd from the shell helper', () => {
  const home = join(import.meta.dir, '.test-home-method-cwd');
  const repo = join(home, 'marked-repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(home, '.until', 'state'), { recursive: true });
  writeFileSync(join(repo, '.until-method'), '');
  try {
    const decision = evaluateClassifiedTools(
      'method-cwd',
      [{ kind: 'shell', command: 'git commit -m test', cwd: repo }],
      '/tmp',
      home,
    );
    expect(decision.allow).toBe(false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('handleToolCall uses Amp helpers on a native tool.call payload', async () => {
  const helpers: AmpToolHelpers = {
    shellCommandFromToolCall: () => ({ command: 'git commit -m test' }),
    filesModifiedByToolCall: () => null,
  };
  const live = createUntilHandlers({ helpers });
  const home = join(import.meta.dir, '.test-home-helpers');
  const stateDir = join(home, '.until', 'state');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    join(stateDir, 'session-helpers.json'),
    JSON.stringify({
      plan_id: 'UNTIL-501',
      stage: 'submitted',
      review_requirement: 'required',
    }),
  );
  const previous = process.env.HOME;
  process.env.HOME = home;
  try {
    const result = await live.handleToolCall(
      {
        thread: { id: 'helpers' },
        tool: 'Bash',
        input: { ignored: true },
        cwd: '/tmp',
      },
      {},
    );
    expect(result.action).toBe('reject-and-continue');
  } finally {
    if (previous === undefined) delete process.env.HOME;
    else process.env.HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});
