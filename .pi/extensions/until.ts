import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createMcpAdapter } from 'pi-mcp-adapter';

const IMPORTANT_MARKER = '<EXTREMELY_IMPORTANT>';
const BOOTSTRAP_MARKER = 'until:using-until bootstrap for pi';

const extensionDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(extensionDir, '../..');
const skillsDir = resolve(packageRoot, 'skills');
const mcpConfigPath = resolve(packageRoot, 'mcp.json');
const bootstrapSkillPath = resolve(
  skillsDir,
  'using-until',
  'SKILL.md',
);
const installMcpAdapter = createMcpAdapter({ configPath: mcpConfigPath });

let cachedBootstrap: string | null | undefined;

export default function untilPiExtension(pi: ExtensionAPI): void {
  installMcpAdapter(pi);

  let injectBootstrap = true;

  pi.on('resources_discover', async () => ({
    skillPaths: [skillsDir],
  }));

  pi.on('session_start', async () => {
    injectBootstrap = true;
  });

  pi.on('session_compact', async () => {
    injectBootstrap = true;
  });

  pi.on('agent_end', async () => {
    injectBootstrap = false;
  });

  pi.on('context', async (event) => {
    if (!injectBootstrap || event.messages.some(messageContainsBootstrap)) {
      return;
    }

    const bootstrap = getBootstrapContent();
    if (!bootstrap) {
      return;
    }

    const bootstrapMessage = {
      role: 'user' as const,
      content: [{ type: 'text' as const, text: bootstrap }],
      timestamp: Date.now(),
    };
    const insertAt = firstNonCompactionSummaryIndex(event.messages);

    return {
      messages: [
        ...event.messages.slice(0, insertAt),
        bootstrapMessage,
        ...event.messages.slice(insertAt),
      ],
    };
  });
}

function getBootstrapContent(): string | null {
  if (cachedBootstrap !== undefined) {
    return cachedBootstrap;
  }

  try {
    const skillContent = readFileSync(bootstrapSkillPath, 'utf8');
    const body = stripFrontmatter(skillContent);
    cachedBootstrap = `${IMPORTANT_MARKER}
${BOOTSTRAP_MARKER}

You have Until.

The using-until skill content is included below and is already loaded for this Pi session. Follow it now. Do not try to load using-until again.

${body}

${piToolMapping()}
</EXTREMELY_IMPORTANT>`;
    return cachedBootstrap;
  } catch {
    cachedBootstrap = null;
    return null;
  }
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return (match?.[1] ?? content).trim();
}

function piToolMapping(): string {
  return `## Pi tool mapping

Pi has native skills but does not expose Claude Code's \`Skill\` tool. When Until instructions name a skill, use Pi's native skill system: load the relevant \`SKILL.md\` with \`read\` when it applies, or let a human invoke \`/skill:name\` explicitly.

Pi's built-in coding tools are lowercase: \`read\`, \`write\`, \`edit\`, \`bash\`, plus optional \`grep\`, \`find\`, and \`ls\`.

Until is connected through \`pi-mcp-adapter\`. Use its \`mcp\` tool to discover and call tools on the Until server. When an Until instruction names a tool such as \`submit_plan\`, \`update_plan\`, or \`get_plan\`, call that named Until tool through the adapter.

Pi does not ship a standard task-list tool. If an installed todo or task tool is available, use it. Otherwise track work in a plan file or repo-local \`TODO.md\` when task tracking is needed. Treat older \`TodoWrite\` references as this task-tracking action.`;
}

function messageContainsBootstrap(message: unknown): boolean {
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') {
    return content.includes(BOOTSTRAP_MARKER);
  }
  if (!Array.isArray(content)) {
    return false;
  }

  return content.some((part) => {
    return (
      part !== null &&
      typeof part === 'object' &&
      (part as { type?: unknown }).type === 'text' &&
      typeof (part as { text?: unknown }).text === 'string' &&
      (part as { text: string }).text.includes(BOOTSTRAP_MARKER)
    );
  });
}

function firstNonCompactionSummaryIndex(messages: unknown[]): number {
  let index = 0;
  while (
    (messages[index] as { role?: unknown } | undefined)?.role ===
    'compactionSummary'
  ) {
    index += 1;
  }
  return index;
}
