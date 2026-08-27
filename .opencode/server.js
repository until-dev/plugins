import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const IMPORTANT_MARKER = '<EXTREMELY_IMPORTANT>'
const BOOTSTRAP_MARKER = 'until:using-until bootstrap for opencode'
const COMPACTION_MARKER = 'until:preserve-plan-state'
const SUPPORTED_WRITE_TOOLS = new Set(['write', 'edit', 'apply_patch'])
const UNTIL_STATE_TOOLS = [
  'submit_plan',
  'update_plan',
  'get_plan',
  'request_review',
  'delete_plan',
  'restore_plan',
]

const adapterDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(adapterDir, '..')
const skillsDir = join(packageRoot, 'skills')
const mcpConfigPath = join(packageRoot, 'mcp.json')
const commitGatePath = join(packageRoot, 'hooks', 'until-commit-gate')
const trackStatePath = join(packageRoot, 'hooks', 'until-track-state')

let cachedMcpUrl
let cachedSkills
let cachedBootstrap

function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  return (match?.[1] ?? content).trim()
}

function skillDescription(content) {
  const match = content.match(
    /^---\n[\s\S]*?\ndescription:\s*(.+)\n[\s\S]*?\n---/,
  )
  return match?.[1]?.trim() ?? ''
}

async function loadMcpUrl() {
  if (cachedMcpUrl) return cachedMcpUrl
  const config = JSON.parse(await readFile(mcpConfigPath, 'utf8'))
  const url = config?.mcpServers?.until?.url
  if (typeof url !== 'string' || !url) {
    throw new Error('Until MCP configuration is missing a remote URL')
  }
  cachedMcpUrl = url
  return url
}

async function loadSkills() {
  if (cachedSkills) return cachedSkills
  const entries = await readdir(skillsDir, { withFileTypes: true })
  const skills = new Map()

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const path = join(skillsDir, entry.name, 'SKILL.md')
    try {
      const content = await readFile(path, 'utf8')
      skills.set(entry.name, {
        content,
        description: skillDescription(content),
      })
    } catch {
      // A directory without SKILL.md is not an installed skill.
    }
  }

  cachedSkills = skills
  return skills
}

function opencodeToolMapping(skillNames) {
  return `## OpenCode tool mapping

OpenCode exposes Until's packaged skills through the \`until_skill\` tool. When an Until instruction names a skill, call \`until_skill\` with that skill name before following it.

Available Until skills: ${skillNames.join(', ')}.

Until is connected as the \`until\` MCP server. When an Until instruction names a tool such as \`submit_plan\`, \`update_plan\`, or \`get_plan\`, call the corresponding tool from that server.

Use OpenCode's native task-list support when an Until skill asks you to track work.`
}

async function loadBootstrap() {
  if (cachedBootstrap) return cachedBootstrap
  const skills = await loadSkills()
  const usingUntil = skills.get('using-until')
  if (!usingUntil) {
    throw new Error('Until package is missing the using-until skill')
  }

  cachedBootstrap = `${IMPORTANT_MARKER}
${BOOTSTRAP_MARKER}

You have Until.

The using-until skill content is included below and is already loaded for this OpenCode session. Follow it now. Do not try to load using-until again.

${stripFrontmatter(usingUntil.content)}

${opencodeToolMapping([...skills.keys()].sort())}
</EXTREMELY_IMPORTANT>`
  return cachedBootstrap
}

function runHookProcess(script, payload) {
  return new Promise((resolveResult) => {
    const child = spawn(script, [], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.on('error', () => resolveResult({}))
    child.on('close', (code) => {
      if (code !== 0) {
        resolveResult({})
        return
      }
      try {
        resolveResult(JSON.parse(stdout.trim()))
      } catch {
        resolveResult({})
      }
    })
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify(payload))
  })
}

function patchTargets(args, directory) {
  const patch =
    typeof args.patchText === 'string'
      ? args.patchText
      : typeof args.patch === 'string'
        ? args.patch
        : ''
  const targets = []
  const pattern = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm
  for (const match of patch.matchAll(pattern)) {
    const target = match[1]?.trim()
    if (target) targets.push(target)
  }
  return targets.length ? targets : [directory]
}

function gatePayloads(input, args, directory) {
  if (input.tool === 'bash') {
    return [
      {
        hook_event_name: 'beforeShellExecution',
        conversation_id: input.sessionID,
        command: typeof args.command === 'string' ? args.command : '',
        cwd: directory,
      },
    ]
  }
  if (!SUPPORTED_WRITE_TOOLS.has(input.tool)) return []
  if (input.tool !== 'apply_patch') {
    return [
      {
        hook_event_name: 'preToolUse',
        conversation_id: input.sessionID,
        tool_name: input.tool,
        tool_input: args,
        cwd: directory,
      },
    ]
  }
  return patchTargets(args, directory).map((target) => ({
    hook_event_name: 'preToolUse',
    conversation_id: input.sessionID,
    tool_name: input.tool,
    tool_input: { target_file: target },
    cwd: directory,
  }))
}

function denialMessage(result) {
  if (result?.permission !== 'deny') return null
  return (
    result.agent_message ??
    result.user_message ??
    'Until blocked this change until its Plan is cleared.'
  )
}

function tracksUntilState(toolName) {
  const normalized = toolName.toLowerCase()
  return (
    normalized.includes('until') &&
    UNTIL_STATE_TOOLS.some((tool) => normalized.includes(tool))
  )
}

export function createUntilOpenCodeServer({ runHook = runHookProcess } = {}) {
  return async function untilOpenCodeServer({ directory }) {
    const skills = await loadSkills()
    const skillNames = [...skills.keys()].sort()

    return {
      async config(config) {
        config.mcp ??= {}
        if (!config.mcp.until) {
          config.mcp.until = {
            type: 'remote',
            url: await loadMcpUrl(),
          }
        }
      },

      tool: {
        until_skill: {
          description:
            'Load one packaged Until workflow skill before following it. ' +
            `Available skills: ${skillNames.join(', ')}.`,
          args: {
            name: {
              type: 'string',
              enum: skillNames,
              description: 'The Until skill to load.',
            },
          },
          async execute({ name }) {
            const skill = skills.get(name)
            if (!skill) throw new Error(`Unknown Until skill: ${name}`)
            return skill.content
          },
        },
      },

      async 'experimental.chat.system.transform'(_input, output) {
        if (output.system.some((part) => part.includes(BOOTSTRAP_MARKER))) {
          return
        }
        output.system.push(await loadBootstrap())
      },

      async 'experimental.session.compacting'(_input, output) {
        if (output.context.some((part) => part.includes(COMPACTION_MARKER))) {
          return
        }
        output.context.push(`${COMPACTION_MARKER}
Preserve the active Until Plan, Review status, implementation authorization, and next required Until action in the continuation summary. Until's system instructions will be restored automatically after compaction.`)
      },

      async 'tool.execute.before'(input, output) {
        const payloads = gatePayloads(input, output.args ?? {}, directory)
        for (const payload of payloads) {
          const result = await runHook(commitGatePath, payload)
          const message = denialMessage(result)
          if (message) throw new Error(message)
        }
      },

      async 'tool.execute.after'(input, output) {
        if (!tracksUntilState(input.tool)) return
        await runHook(trackStatePath, {
          hook_event_name: 'afterMCPExecution',
          conversation_id: input.sessionID,
          tool_name: input.tool,
          tool_input: input.args,
          result_json: output.output,
        })
      },
    }
  }
}

export default {
  id: 'until',
  server: createUntilOpenCodeServer(),
}
