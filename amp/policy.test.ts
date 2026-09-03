import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  decideGate,
  pendingUploadHasExpired,
  reduceSession,
  type ClassifiedTool,
  type GateFacts,
  type SessionState,
  type UntilMcpTool,
} from './policy.ts';
import {
  SHELL_STOP_SUFFIX,
  STATE_DIR_USER_MESSAGE,
  DEFAULT_CLOSED_USER_MESSAGE,
  SETUP_REQUIRED_USER_MESSAGE,
  changesRequestedAgentMessage,
  changesRequestedUserMessage,
  defaultClosedAgentMessage,
  inFlightPeerReviewAgentMessage,
  inFlightPeerReviewUserMessage,
  pendingUploadExpiredAgentMessage,
  pendingUploadExpiredUserMessage,
  reviewNotRequiredPendingAgentMessage,
  reviewNotRequiredPendingUserMessage,
  setupRequiredAgentMessage,
  stateDirFileWriteAgentMessage,
  stateDirShellAgentMessage,
  unrecognizedReviewAgentMessage,
  unrecognizedReviewUserMessage,
} from './messages.ts';

const fixturesDir = join(import.meta.dir, 'fixtures');
const pythonContractsDir = join(
  import.meta.dir,
  '..',
  'private-evals',
  'until-plugin-contracts',
);
const PYTHON_CONTRACT_FILES = [
  'test_session_stage.py',
  'test_review_requirement.py',
  'test_tool_classification.py',
  'test_setup_required_waiver.py',
] as const;

type ReduceFixture = {
  file: string;
  source: string;
  kind: 'reduce';
  tool: UntilMcpTool;
  prior: SessionState | null;
  toolInput: Record<string, unknown> | null;
  result: Record<string, unknown>;
  expected: {
    action: 'write' | 'delete' | 'noop';
    state?: SessionState;
  };
};

type GateFixture = {
  file: string;
  source: string;
  kind: 'gate';
  facts: GateFacts & { now: string };
  tool: ClassifiedTool;
  expected: {
    allow: boolean;
    agentMessage?: string;
    userMessage?: string;
  };
};

async function loadFixtures(): Promise<Array<ReduceFixture | GateFixture>> {
  const names = (await readdir(fixturesDir)).filter((n) => n.endsWith('.json'));
  const out: Array<ReduceFixture | GateFixture> = [];
  for (const name of names) {
    const parsed = JSON.parse(await readFile(join(fixturesDir, name), 'utf8'));
    out.push({ ...parsed, file: name });
  }
  return out;
}

const fixtures = await loadFixtures();

for (const fixture of fixtures) {
  test(`fixture ${fixture.file} (${fixture.source})`, () => {
    if (fixture.kind === 'reduce') {
      const now = new Date('2026-09-02T14:00:00.000Z');
      const result = reduceSession(
        fixture.prior,
        fixture.tool,
        fixture.toolInput,
        fixture.result,
        now,
      );
      expect(result.action).toBe(fixture.expected.action);
      if (result.action === 'write') {
        expect('updated_at' in result.state).toBe(false);
        if (fixture.expected.state) {
          expect(result.state).toEqual(fixture.expected.state);
        }
      }
      return;
    }
    const facts: GateFacts = {
      ...fixture.facts,
      now: new Date(fixture.facts.now),
    };
    const decision = decideGate(facts, fixture.tool);
    expect(decision.allow).toBe(fixture.expected.allow);
    if (!fixture.expected.allow && !decision.allow) {
      expect(decision.agentMessage).toBe(fixture.expected.agentMessage);
      expect(decision.userMessage).toBe(fixture.expected.userMessage);
    }
  });
}

test('JSON fixtures name every Python contract test', async () => {
  const sources = new Set(fixtures.map((f) => f.source.split('[')[0]!));
  const missing: string[] = [];
  for (const file of PYTHON_CONTRACT_FILES) {
    const text = await readFile(join(pythonContractsDir, file), 'utf8');
    for (const match of text.matchAll(/def (test_[A-Za-z0-9_]+)/g)) {
      const name = match[1]!;
      if (!sources.has(name)) missing.push(`${file}::${name}`);
    }
  }
  expect(missing).toEqual([]);
});

function baseFacts(overrides: Partial<GateFacts> = {}): GateFacts {
  return {
    state: null,
    skipped: false,
    untilMethodRoot: null,
    untilRoot: '/home/test/.until',
    stateDir: '/home/test/.until/state',
    skipPath: '/home/test/.until/state/skip-convo',
    now: new Date('2026-09-02T14:00:00.000Z'),
    ...overrides,
  };
}

test('no session allows product write', () => {
  const decision = decideGate(baseFacts(), {
    kind: 'file-write',
    targetPath: '/tmp/product.txt',
    cwd: '/tmp',
  });
  expect(decision.allow).toBe(true);
});

test('no session default-closed repo denies write', () => {
  const decision = decideGate(
    baseFacts({ untilMethodRoot: '/repo' }),
    { kind: 'file-write', targetPath: '/repo/src/a.ts', cwd: '/repo' },
  );
  expect(decision.allow).toBe(false);
});

test('submitted denies mutating shell with suffix', () => {
  const decision = decideGate(
    baseFacts({
      state: { plan_id: 'UNTIL-42', stage: 'submitted', review_requirement: 'required' },
    }),
    { kind: 'shell', command: 'git commit -m test', cwd: '/tmp' },
  );
  expect(decision.allow).toBe(false);
  if (!decision.allow) {
    expect(decision.agentMessage.endsWith(SHELL_STOP_SUFFIX.trim())).toBe(true);
  }
});

test('submitted allows read-only shell', () => {
  const decision = decideGate(
    baseFacts({
      state: { plan_id: 'UNTIL-42', stage: 'submitted', review_requirement: 'required' },
    }),
    { kind: 'shell', command: 'git status', cwd: '/tmp' },
  );
  expect(decision.allow).toBe(true);
});

test('approved allows write shell spawn', () => {
  for (const kind of ['file-write', 'shell', 'spawn'] as const) {
    const tool: ClassifiedTool =
      kind === 'file-write'
        ? { kind, targetPath: '/tmp/x', cwd: '/tmp' }
        : kind === 'shell'
          ? { kind, command: 'git commit -m x', cwd: '/tmp' }
          : { kind, cwd: '/tmp' };
    const decision = decideGate(
      baseFacts({ state: { plan_id: 'UNTIL-42', stage: 'approved' } }),
      tool,
    );
    expect(decision.allow).toBe(true);
  }
});

test('review_not_required allows write', () => {
  const decision = decideGate(
    baseFacts({ state: { plan_id: 'UNTIL-42', stage: 'review_not_required' } }),
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
  );
  expect(decision.allow).toBe(true);
});

test('skipped allows product write', () => {
  const decision = decideGate(
    baseFacts({
      skipped: true,
      state: { plan_id: 'UNTIL-42', stage: 'submitted' },
    }),
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
  );
  expect(decision.allow).toBe(true);
});

test('skipped still denies state dir write', () => {
  const decision = decideGate(
    baseFacts({
      skipped: true,
      state: { plan_id: 'UNTIL-42', stage: 'submitted' },
    }),
    {
      kind: 'file-write',
      targetPath: '/home/test/.until/state/session-x.json',
      cwd: '/tmp',
    },
  );
  expect(decision.allow).toBe(false);
});

test('pending upload allows only issued command', () => {
  const cmd =
    "curl -fsS -X PUT --data-binary @'/tmp/plan.md' 'https://example/upload'";
  const template =
    "curl -fsS -X PUT --data-binary @<plan_file_path> 'https://example/upload'";
  const decision = decideGate(
    baseFacts({
      state: {
        plan_id: 'UNTIL-42',
        stage: 'pending_upload',
        pending_upload_command: template,
        pending_upload_expires_at: '2099-01-01T00:00:00Z',
      },
    }),
    { kind: 'shell', command: cmd, cwd: '/tmp' },
  );
  expect(decision.allow).toBe(true);
  const blocked = decideGate(
    baseFacts({
      state: {
        plan_id: 'UNTIL-42',
        stage: 'pending_upload',
        pending_upload_command: template,
        pending_upload_expires_at: '2099-01-01T00:00:00Z',
      },
    }),
    { kind: 'shell', command: 'git commit -m x', cwd: '/tmp' },
  );
  expect(blocked.allow).toBe(false);
});

test('untilRoot paths always writable', () => {
  const decision = decideGate(
    baseFacts({
      state: { plan_id: 'UNTIL-42', stage: 'submitted' },
    }),
    {
      kind: 'file-write',
      targetPath: '/home/test/.until/plans/x.plan.md',
      cwd: '/tmp',
    },
  );
  expect(decision.allow).toBe(true);
});

test('shape doc writable when not in flight', () => {
  const repo = resolve('/tmp/until-shape-repo');
  const decision = decideGate(
    baseFacts({ untilMethodRoot: repo }),
    {
      kind: 'file-write',
      targetPath: join(repo, 'docs/design/shape.md'),
      cwd: repo,
    },
  );
  expect(decision.allow).toBe(true);
});

test('submit_plan setup_required without plan_id', () => {
  const result = reduceSession(
    null,
    'submit_plan',
    null,
    { status: 'source_control_setup_required' },
    new Date(),
  );
  expect(result.action).toBe('write');
  if (result.action === 'write') {
    expect(result.state.stage).toBe('setup_required');
    expect(result.state.plan_id).toBeUndefined();
  }
});

test('submit_plan with upload window', () => {
  const result = reduceSession(
    null,
    'submit_plan',
    null,
    {
      id: 'UNTIL-99',
      upload: { expires_at: '2099-01-01T00:00:00Z' },
      next_action: { command: 'curl example' },
    },
    new Date(),
  );
  expect(result.action).toBe('write');
  if (result.action === 'write') {
    expect(result.state.stage).toBe('pending_upload');
    expect(result.state.plan_id).toBe('UNTIL-99');
  }
});

test('delete_plan requires exact match', () => {
  const ok = reduceSession(
    { plan_id: 'UNTIL-7', stage: 'submitted' },
    'delete_plan',
    { id: 'UNTIL-7' },
    { id: 'UNTIL-7', deleted: true },
    new Date(),
  );
  expect(ok.action).toBe('delete');
  const noop = reduceSession(
    { plan_id: 'UNTIL-7', stage: 'submitted' },
    'delete_plan',
    { id: 'UNTIL-8' },
    { id: 'UNTIL-8', deleted: true },
    new Date(),
  );
  expect(noop.action).toBe('noop');
});

test('customer-facing in-flight peer review copy exact', () => {
  const facts = baseFacts({
    state: { plan_id: 'UNTIL-501', stage: 'submitted', review_requirement: 'required' },
  });
  const decision = decideGate(facts, {
    kind: 'file-write',
    targetPath: '/tmp/x',
    cwd: '/tmp',
  });
  expect(decision.allow).toBe(false);
  if (!decision.allow) {
    expect(decision.agentMessage).toBe(
      inFlightPeerReviewAgentMessage({
        planId: 'UNTIL-501',
        skipPath: facts.skipPath,
      }),
    );
    expect(decision.userMessage).toBe(
      inFlightPeerReviewUserMessage({ planId: 'UNTIL-501', skipPath: facts.skipPath }),
    );
  }
});

test('pending upload expiry helper', () => {
  expect(
    pendingUploadHasExpired(
      { pending_upload_expires_at: '2000-01-01T00:00:00Z' },
      new Date('2026-01-01T00:00:00Z'),
    ),
  ).toBe(true);
});

function expectExactDeny(
  facts: GateFacts,
  tool: ClassifiedTool,
  agentMessage: string,
  userMessage: string,
): void {
  const decision = decideGate(facts, tool);
  expect(decision.allow).toBe(false);
  if (!decision.allow) {
    expect(decision.agentMessage).toBe(agentMessage);
    expect(decision.userMessage).toBe(userMessage);
  }
}

test('exact copy: setup_required file write', () => {
  const facts = baseFacts({ state: { stage: 'setup_required' } });
  expectExactDeny(
    facts,
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
    setupRequiredAgentMessage({ planId: 'unavailable', skipPath: facts.skipPath }),
    SETUP_REQUIRED_USER_MESSAGE,
  );
});

test('exact copy: setup_required mutating shell includes suffix', () => {
  const facts = baseFacts({ state: { stage: 'setup_required' } });
  expectExactDeny(
    facts,
    { kind: 'shell', command: 'git commit -m test', cwd: '/tmp' },
    setupRequiredAgentMessage({ planId: 'unavailable', skipPath: facts.skipPath }) +
      SHELL_STOP_SUFFIX,
    SETUP_REQUIRED_USER_MESSAGE,
  );
});

test('exact copy: pending_upload expired file and shell', () => {
  const facts = baseFacts({
    state: {
      plan_id: 'UNTIL-42',
      stage: 'pending_upload',
      pending_upload_expires_at: '2000-01-01T00:00:00Z',
    },
  });
  const params = { planId: 'UNTIL-42', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
    pendingUploadExpiredAgentMessage(params),
    pendingUploadExpiredUserMessage(params),
  );
  expectExactDeny(
    facts,
    { kind: 'shell', command: 'git commit -m test', cwd: '/tmp' },
    pendingUploadExpiredAgentMessage(params) + SHELL_STOP_SUFFIX,
    pendingUploadExpiredUserMessage(params),
  );
});

test('exact copy: review_not_required pending upload', () => {
  const facts = baseFacts({
    state: {
      plan_id: 'UNTIL-42',
      stage: 'pending_upload',
      review_requirement: 'not_required',
      pending_upload_expires_at: '2099-01-01T00:00:00Z',
    },
  });
  const params = { planId: 'UNTIL-42', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
    reviewNotRequiredPendingAgentMessage(params),
    reviewNotRequiredPendingUserMessage(params),
  );
});

test('exact copy: unrecognized review requirement', () => {
  const facts = baseFacts({
    state: { plan_id: 'UNTIL-42', stage: 'submitted' },
  });
  const params = { planId: 'UNTIL-42', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
    unrecognizedReviewAgentMessage(params),
    unrecognizedReviewUserMessage(params),
  );
});

test('exact copy: changes_requested file and shell', () => {
  const facts = baseFacts({
    state: {
      plan_id: 'UNTIL-42',
      stage: 'changes_requested',
      review_requirement: 'required',
    },
  });
  const params = { planId: 'UNTIL-42', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    { kind: 'file-write', targetPath: '/tmp/x', cwd: '/tmp' },
    changesRequestedAgentMessage(params),
    changesRequestedUserMessage(params),
  );
  expectExactDeny(
    facts,
    { kind: 'shell', command: 'git commit -m test', cwd: '/tmp' },
    changesRequestedAgentMessage(params) + SHELL_STOP_SUFFIX,
    changesRequestedUserMessage(params),
  );
});

test('exact copy: default-closed mutating shell includes suffix', () => {
  const facts = baseFacts({ untilMethodRoot: '/repo' });
  const params = { planId: 'unavailable', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    { kind: 'shell', command: 'git commit -m test', cwd: '/repo' },
    defaultClosedAgentMessage(params) + SHELL_STOP_SUFFIX,
    DEFAULT_CLOSED_USER_MESSAGE,
  );
});

test('exact copy: state-dir file write and shell', () => {
  const facts = baseFacts({ skipped: true });
  const params = { planId: 'unavailable', skipPath: facts.skipPath };
  expectExactDeny(
    facts,
    {
      kind: 'file-write',
      targetPath: '/home/test/.until/state/session-x.json',
      cwd: '/tmp',
    },
    stateDirFileWriteAgentMessage(params),
    STATE_DIR_USER_MESSAGE,
  );
  expectExactDeny(
    facts,
    {
      kind: 'shell',
      command: "touch '/home/test/.until/state/skip-convo'",
      cwd: '/tmp',
    },
    stateDirShellAgentMessage(params),
    STATE_DIR_USER_MESSAGE,
  );
});

test('docs/plans is not a shape-doc exception', () => {
  const repo = resolve('/tmp/until-shape-repo');
  const decision = decideGate(baseFacts({ untilMethodRoot: repo }), {
    kind: 'file-write',
    targetPath: join(repo, 'docs/plans/feature.md'),
    cwd: repo,
  });
  expect(decision.allow).toBe(false);
});

test('frozen GateFacts has no home field', () => {
  const facts = baseFacts();
  expect('home' in facts).toBe(false);
});
