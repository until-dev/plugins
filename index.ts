import { join } from 'node:path';
import {
  REGISTERED_SKILLS,
  applyToolResult,
  buildBootstrapContent,
  classifyAmpToolCall,
  classifyWithAmpHelpers,
  evaluateClassifiedTools,
  evaluateToolCall,
  mergeUntilMcpConfig,
  packageRoot,
  threadHasBootstrap,
  untilSkillResult,
  BOOTSTRAP_MARKER,
  type AmpToolHelpers,
} from './amp/adapter.ts';
import type { GateDecision } from './amp/policy.ts';

/** Amp PluginAPI surface used by Until. Event handlers follow Amp's (event, ctx) form. */
export type PluginAPI = {
  registerSkill: (opts: { path: string }) => void;
  registerTool: (opts: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (
      input: Record<string, unknown>,
      ctx: AmpToolContext,
    ) => Promise<string>;
  }) => void;
  on: (
    event: 'session.start' | 'tool.call' | 'tool.result',
    handler: (
      event: AmpEvent,
      ctx: AmpEventContext,
    ) => Promise<ToolCallAction | void> | ToolCallAction | void,
  ) => void;
  configuration: {
    get: () => Promise<{ mcpServers?: Record<string, { url?: string }> }>;
    update: (patch: {
      mcpServers?: Record<string, { url?: string }>;
    }) => Promise<void>;
  };
  helpers: AmpToolHelpers;
};

type AmpToolContext = object;

export type AmpEvent = {
  thread?: { id: string; append?: (msg: { role: string; content: string }) => Promise<void> };
  tool?: string | { name: string; input: Record<string, unknown> };
  input?: Record<string, unknown>;
  toolUseID?: string;
  result?: unknown;
  cwd?: string;
  messages?: Array<{ content?: unknown }>;
};

export type AmpEventContext = {
  thread?: { id: string; append: (msg: { role: string; content: string }) => Promise<void> };
  tool?: string | { name: string; input: Record<string, unknown> };
  input?: Record<string, unknown>;
  result?: unknown;
  cwd?: string;
  ui?: { notify: (message: string) => void };
  messages?: Array<{ content?: unknown }>;
};

export type ToolCallAction =
  | { action: 'allow' }
  | { action: 'reject-and-continue'; message: string };

export type UntilHandlers = {
  handleSessionStart: (
    event: AmpEvent,
    ctx: AmpEventContext,
  ) => Promise<void>;
  handleToolResult: (event: AmpEvent, ctx: AmpEventContext) => Promise<void>;
  handleToolCall: (
    event: AmpEvent,
    ctx: AmpEventContext,
  ) => Promise<ToolCallAction>;
};

function threadFrom(event: AmpEvent, ctx: AmpEventContext) {
  return ctx.thread ?? event.thread;
}

function toolFrom(event: AmpEvent, ctx: AmpEventContext): {
  name: string;
  input: Record<string, unknown>;
} | null {
  const raw = event.tool ?? ctx.tool;
  const input = event.input ?? ctx.input ?? {};
  if (typeof raw === 'string') {
    return { name: raw, input };
  }
  if (raw && typeof raw === 'object' && typeof raw.name === 'string') {
    return { name: raw.name, input: raw.input ?? input };
  }
  return null;
}

function nativeToolCall(event: AmpEvent, ctx: AmpEventContext) {
  const tool = toolFrom(event, ctx);
  if (!tool) return null;
  return {
    toolUseID: event.toolUseID,
    tool: tool.name,
    input: tool.input,
  };
}

function cwdFrom(event: AmpEvent, ctx: AmpEventContext) {
  return event.cwd ?? ctx.cwd;
}

export function createUntilHandlers(deps?: {
  evaluate?: typeof evaluateToolCall;
  apply?: typeof applyToolResult;
  bootstrap?: typeof buildBootstrapContent;
  helpers?: AmpToolHelpers;
}): UntilHandlers {
  const evaluate = deps?.evaluate ?? evaluateToolCall;
  const apply = deps?.apply ?? applyToolResult;
  const bootstrapContent = deps?.bootstrap ?? buildBootstrapContent;
  const helpers = deps?.helpers;

  return {
    async handleSessionStart(event, ctx) {
      const messages = event.messages ?? ctx.messages ?? [];
      if (threadHasBootstrap(messages)) return;
      const bootstrap = bootstrapContent();
      if (!bootstrap) return;
      const thread = threadFrom(event, ctx);
      if (!thread?.append) return;
      await thread.append({ role: 'user', content: bootstrap });
    },

    async handleToolResult(event, ctx) {
      const tool = toolFrom(event, ctx);
      const thread = threadFrom(event, ctx);
      if (!tool?.name || !thread?.id) return;
      try {
        apply(
          thread.id,
          tool.name,
          tool.input ?? null,
          event.result ?? ctx.result,
        );
      } catch {
        // fail open
      }
    },

    async handleToolCall(event, ctx) {
      const tool = toolFrom(event, ctx);
      const thread = threadFrom(event, ctx);
      if (!tool?.name || !thread?.id) return { action: 'allow' };
      let decision: GateDecision;
      try {
        if (deps?.evaluate) {
          decision = evaluate(
            thread.id,
            tool.name,
            tool.input ?? {},
            cwdFrom(event, ctx),
          );
        } else {
          const native = nativeToolCall(event, ctx);
          if (!native) return { action: 'allow' };
          const cwd = cwdFrom(event, ctx);
          const fromHelpers = helpers
            ? classifyWithAmpHelpers(native, helpers, cwd)
            : null;
          const tools =
            fromHelpers ?? [classifyAmpToolCall(native.tool, native.input, cwd)];
          decision = evaluateClassifiedTools(thread.id, tools, cwd);
        }
      } catch {
        return { action: 'allow' };
      }
      if (decision.allow) return { action: 'allow' };
      ctx.ui?.notify(decision.userMessage);
      return {
        action: 'reject-and-continue',
        message: decision.agentMessage,
      };
    },
  };
}

export default function untilAmpPlugin(amp: PluginAPI): void {
  for (const name of REGISTERED_SKILLS) {
    amp.registerSkill({ path: join('skills', name) });
  }

  void amp.configuration.get().then((config) => {
    const { config: merged, changed } = mergeUntilMcpConfig(
      config.mcpServers,
    );
    if (changed) {
      return amp.configuration.update({ mcpServers: merged });
    }
  });

  amp.registerTool({
    name: 'until_skill',
    description:
      'Load an Until Loop skill body by short name (e.g. using-until, brainstorming).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    },
    execute: async (input) => untilSkillResult(String(input.name ?? '')),
  });

  const handlers = createUntilHandlers({ helpers: amp.helpers });

  amp.on('session.start', async (event, ctx) => {
    await handlers.handleSessionStart(event, ctx);
  });

  amp.on('tool.result', async (event, ctx) => {
    await handlers.handleToolResult(event, ctx);
  });

  amp.on('tool.call', async (event, ctx) => {
    return handlers.handleToolCall(event, ctx);
  });
}

export { BOOTSTRAP_MARKER, packageRoot };
