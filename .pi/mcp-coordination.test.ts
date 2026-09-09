import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MCP_RUNTIME_REGISTER_EVENT,
  UNTIL_SERVER_ALREADY_REGISTERED,
  createMcpCoordinator,
  type McpCoordinatorPi,
} from './mcp-coordination.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function writeConfig(
  until: unknown,
  extra?: Record<string, unknown>,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'until-mcp-coordination-'));
  tempDirs.push(dir);
  const path = join(dir, 'mcp.json');
  await writeFile(
    path,
    `${JSON.stringify({ mcpServers: { until, ...extra } }, null, 2)}\n`,
  );
  return path;
}

function createPi(options?: {
  tools?: unknown[];
  onRegister?: (request: Record<string, unknown>) => void;
}): McpCoordinatorPi {
  return {
    events: {
      emit(channel: string, data: unknown) {
        if (channel !== MCP_RUNTIME_REGISTER_EVENT) {
          return;
        }
        options?.onRegister?.(data as Record<string, unknown>);
      },
    },
    getAllTools: () => options?.tools ?? [],
  };
}

test('a compatible external adapter receives one until registration', async () => {
  const configPath = await writeConfig({
    type: 'http',
    url: 'https://run.until.dev/mcp',
    headers: { Authorization: 'Bearer secret' },
  });
  const registrations: Array<Record<string, unknown>> = [];
  const dispose = async () => {};
  const pi = createPi({
    onRegister(request) {
      registrations.push(structuredClone(request));
      request.result = {
        ok: true,
        registration: { dispose },
      };
    },
  });
  let bundled = 0;
  const errors: string[] = [];
  const coordinator = createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  });

  coordinator.discover();
  coordinator.discover();

  expect(registrations).toHaveLength(1);
  expect(registrations[0]).toMatchObject({
    version: 1,
    name: 'until',
    definition: {
      url: 'https://run.until.dev/mcp',
      headers: { Authorization: 'Bearer secret' },
    },
  });
  expect(registrations[0]?.['definition']).not.toHaveProperty('type');
  expect(bundled).toBe(0);
  expect(errors).toEqual([]);
});

test('an existing until registration wins without replacement', async () => {
  const configPath = await writeConfig({
    url: 'https://run.until.dev/mcp',
  });
  let registerCalls = 0;
  const pi = createPi({
    onRegister(request) {
      registerCalls += 1;
      request.result = {
        ok: false,
        error: new Error(UNTIL_SERVER_ALREADY_REGISTERED),
      };
    },
  });
  let bundled = 0;
  const errors: string[] = [];
  const coordinator = createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  });

  coordinator.discover();
  await coordinator.dispose();
  await coordinator.dispose();

  expect(registerCalls).toBe(1);
  expect(bundled).toBe(0);
  expect(errors).toEqual([]);
});

test('an existing until server with a different URL is left untouched', async () => {
  const configPath = await writeConfig({
    url: 'https://run.until.dev/mcp',
  });
  const pi = createPi({
    onRegister(request) {
      request.result = {
        ok: false,
        error: new Error(UNTIL_SERVER_ALREADY_REGISTERED),
      };
    },
  });
  let bundled = 0;
  const errors: string[] = [];
  createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  }).discover();

  expect(bundled).toBe(0);
  expect(errors).toEqual([]);
});

test('an external registration rejection reports once and never starts a second adapter', async () => {
  const configPath = await writeConfig({
    url: 'https://run.until.dev/mcp',
    headers: { Authorization: 'Bearer secret-token' },
  });
  const pi = createPi({
    onRegister(request) {
      request.result = {
        ok: false,
        error: new Error('server name is reserved'),
      };
    },
  });
  let bundled = 0;
  const errors: string[] = [];
  const coordinator = createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  });

  coordinator.discover();
  coordinator.discover();

  expect(bundled).toBe(0);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('server name is reserved');
  expect(errors[0]).not.toContain('https://run.until.dev/mcp');
  expect(errors[0]).not.toContain('secret-token');
  expect(errors[0]).not.toContain('Authorization');
});

test('an old adapter that owns MCP tools produces upgrade guidance', async () => {
  const configPath = await writeConfig({ url: 'https://run.until.dev/mcp' });
  const pi = createPi({ tools: [{ name: 'mcpScript' }, 'read'] });
  let bundled = 0;
  const errors: string[] = [];
  createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  }).discover();

  expect(bundled).toBe(0);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('2.28.0');
});

test('no external owner installs the bundled adapter exactly once', async () => {
  const configPath = await writeConfig({ url: 'https://run.until.dev/mcp' });
  const pi = createPi({ tools: ['read', 'bash'] });
  let bundled = 0;
  const coordinator = createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: () => {
      throw new Error('unexpected error');
    },
  });

  coordinator.discover();
  coordinator.discover();

  expect(bundled).toBe(1);
});

test('shutdown disposes a runtime registration once', async () => {
  const configPath = await writeConfig({ url: 'https://run.until.dev/mcp' });
  let disposed = 0;
  const pi = createPi({
    onRegister(request) {
      request.result = {
        ok: true,
        registration: {
          dispose: async () => {
            disposed += 1;
          },
        },
      };
    },
  });
  const coordinator = createMcpCoordinator({
    pi,
    configPath,
    installBundledAdapter: () => {
      throw new Error('bundled adapter should not install');
    },
    reportError: () => {
      throw new Error('unexpected error');
    },
  });

  coordinator.discover();
  await coordinator.dispose();
  await coordinator.dispose();

  expect(disposed).toBe(1);

  coordinator.discover();
  await coordinator.dispose();

  expect(disposed).toBe(2);
});

test('shutdown does not dispose an existing or bundled owner', async () => {
  const configPath = await writeConfig({ url: 'https://run.until.dev/mcp' });
  const accepted = createPi({
    onRegister(request) {
      request.result = {
        ok: false,
        error: new Error(UNTIL_SERVER_ALREADY_REGISTERED),
      };
    },
  });
  const acceptedCoordinator = createMcpCoordinator({
    pi: accepted,
    configPath,
    installBundledAdapter: () => {
      throw new Error('bundled adapter should not install');
    },
    reportError: () => {
      throw new Error('unexpected error');
    },
  });
  acceptedCoordinator.discover();
  await acceptedCoordinator.dispose();

  let bundled = 0;
  const bundledCoordinator = createMcpCoordinator({
    pi: createPi(),
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: () => {
      throw new Error('unexpected error');
    },
  });
  bundledCoordinator.discover();
  await bundledCoordinator.dispose();
  await bundledCoordinator.dispose();

  expect(bundled).toBe(1);
});

test('missing mcp.json degrades with one actionable error', async () => {
  const pi = createPi();
  let bundled = 0;
  const errors: string[] = [];
  const coordinator = createMcpCoordinator({
    pi,
    configPath: join(tmpdir(), 'until-missing-mcp.json'),
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  });

  coordinator.discover();
  coordinator.discover();

  expect(bundled).toBe(0);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatch(/mcp\.json/i);
});

test('invalid until server data degrades without installing a bundled adapter', async () => {
  const configPath = await writeConfig({ command: 'until' });
  let bundled = 0;
  const errors: string[] = [];
  createMcpCoordinator({
    pi: createPi(),
    configPath,
    installBundledAdapter: () => {
      bundled += 1;
    },
    reportError: (message) => {
      errors.push(message);
    },
  }).discover();

  expect(bundled).toBe(0);
  expect(errors).toHaveLength(1);
});

test('a colliding bundled install degrades instead of taking over', async () => {
  const configPath = await writeConfig({ url: 'https://run.until.dev/mcp' });
  const errors: string[] = [];
  createMcpCoordinator({
    pi: createPi(),
    configPath,
    installBundledAdapter: () => {
      throw new Error('Tool "mcp" conflicts with pi-mcp-adapter/index.ts');
    },
    reportError: (message) => {
      errors.push(message);
    },
  }).discover();

  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('2.28.0');
  expect(errors[0]).toContain('Tool "mcp" conflicts');
});
