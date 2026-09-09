import { readFileSync } from 'node:fs';

export const MCP_RUNTIME_REGISTER_EVENT =
  'pi-mcp-adapter:runtime-register:v1' as const;
export const MCP_RUNTIME_REGISTER_VERSION = 1 as const;
export const UNTIL_SERVER_NAME = 'until';
export const UNTIL_SERVER_ALREADY_REGISTERED = `MCP server "${UNTIL_SERVER_NAME}" is already registered`;
export const MIN_RUNTIME_ADAPTER_VERSION = '2.28.0';

const MCP_OWNER_TOOL_NAMES = new Set(['mcp', 'mcpScript']);

export type McpServerRegistration = {
  dispose(): Promise<void>;
};

export type McpRuntimeRegistrationResult =
  | { ok: true; registration: McpServerRegistration }
  | { ok: false; error: Error };

export type McpRuntimeRegistrationRequest = {
  version: typeof MCP_RUNTIME_REGISTER_VERSION;
  name: string;
  definition: Record<string, unknown>;
  result?: McpRuntimeRegistrationResult;
};

export type McpCoordinatorPi = {
  events: {
    emit(channel: string, data: unknown): void;
  };
  getAllTools?: () => unknown;
};

export type McpCoordinatorOptions = {
  pi: McpCoordinatorPi;
  configPath: string;
  installBundledAdapter: () => void;
  reportError: (message: string) => void;
};

export type McpCoordinator = {
  discover(): void;
  dispose(): Promise<void>;
};

type Decision =
  | { kind: 'registered'; registration: McpServerRegistration }
  | { kind: 'accepted' }
  | { kind: 'bundled' }
  | { kind: 'degraded' };

export function createMcpCoordinator(
  options: McpCoordinatorOptions,
): McpCoordinator {
  let decision: Decision | undefined;
  let disposing = false;

  const discover = (): void => {
    if (decision) {
      return;
    }

    const definition = readUntilServerDefinition(options.configPath);
    if (definition === undefined) {
      decision = { kind: 'degraded' };
      options.reportError(
        `Until could not read a valid "${UNTIL_SERVER_NAME}" MCP server from ${options.configPath}. Skills stay available. Fix that file and restart Pi.`,
      );
      return;
    }

    const request: McpRuntimeRegistrationRequest = {
      version: MCP_RUNTIME_REGISTER_VERSION,
      name: UNTIL_SERVER_NAME,
      definition,
    };
    options.pi.events.emit(MCP_RUNTIME_REGISTER_EVENT, request);

    const result = request.result;
    if (result?.ok) {
      decision = { kind: 'registered', registration: result.registration };
      return;
    }
    if (result && !result.ok) {
      if (isExistingUntilServer(result.error)) {
        decision = { kind: 'accepted' };
        return;
      }
      decision = { kind: 'degraded' };
      options.reportError(
        `Until could not register the "${UNTIL_SERVER_NAME}" MCP server with the installed pi-mcp-adapter: ${errorMessage(result.error)}. Skills stay available. Remove or rename the conflicting server, then restart Pi.`,
      );
      return;
    }

    if (adapterOwnsMcpTools(options.pi)) {
      decision = { kind: 'degraded' };
      options.reportError(upgradeAdapterGuidance());
      return;
    }

    try {
      options.installBundledAdapter();
      decision = { kind: 'bundled' };
    } catch (error) {
      decision = { kind: 'degraded' };
      options.reportError(
        `${upgradeAdapterGuidance()} ${errorMessage(error)}`,
      );
    }
  };

  const dispose = async (): Promise<void> => {
    if (disposing) {
      return;
    }
    const current = decision;
    if (current?.kind !== 'registered') {
      return;
    }
    disposing = true;
    try {
      await current.registration.dispose();
    } finally {
      decision = undefined;
      disposing = false;
    }
  };

  return { discover, dispose };
}

function readUntilServerDefinition(
  configPath: string,
): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const servers = (parsed as { mcpServers?: unknown }).mcpServers;
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
    return undefined;
  }
  const until = (servers as Record<string, unknown>)[UNTIL_SERVER_NAME];
  if (typeof until !== 'object' || until === null || Array.isArray(until)) {
    return undefined;
  }

  const definition: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(until)) {
    if (key === 'type') {
      continue;
    }
    definition[key] = value;
  }
  if (typeof definition.url !== 'string' || definition.url.trim() === '') {
    return undefined;
  }
  return definition;
}

function isExistingUntilServer(error: Error): boolean {
  return error.message === UNTIL_SERVER_ALREADY_REGISTERED;
}

function adapterOwnsMcpTools(pi: McpCoordinatorPi): boolean {
  try {
    const tools = pi.getAllTools?.();
    if (!Array.isArray(tools)) {
      return false;
    }
    return tools.some((tool) => MCP_OWNER_TOOL_NAMES.has(toolName(tool)));
  } catch {
    return false;
  }
}

function toolName(tool: unknown): string {
  if (typeof tool === 'string') {
    return tool;
  }
  if (
    typeof tool === 'object' &&
    tool !== null &&
    'name' in tool &&
    typeof (tool as { name?: unknown }).name === 'string'
  ) {
    return (tool as { name: string }).name;
  }
  return '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return String(error);
}

function upgradeAdapterGuidance(): string {
  return `Until needs pi-mcp-adapter ${MIN_RUNTIME_ADAPTER_VERSION} or newer to share MCP tools. Upgrade the standalone adapter, or remove it so Until can use its bundled copy. Skills stay available.`;
}
