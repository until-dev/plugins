import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const exports = manifest.exports ?? {}
const files = manifest.files ?? []

assert.match(manifest.name, /^(pi-until-loop|@until-dev\/plugins)$/)
assert.equal(exports['./server'], './.opencode/server.js')
assert.ok(files.includes('.opencode'))
assert.ok(files.includes('.pi'))
assert.ok(files.includes('hooks/session_stage.py'))
assert.ok(files.includes('hooks/until-commit-gate'))
assert.ok(files.includes('hooks/until-track-state'))
assert.ok(files.includes('skills'))
assert.equal(manifest.engines?.opencode, '>=1.18.23')
assert.deepEqual(manifest.pi?.extensions, ['./.pi/extensions/until.ts'])
assert.deepEqual(manifest.pi?.skills, ['./skills'])

const module = await import(
  `${pathToFileURL(join(root, '.opencode/server.js')).href}?validate=${Date.now()}`
)
assert.equal(module.default?.id, 'until')
assert.equal(typeof module.default?.server, 'function')

const hookCalls = []
const server = module.createUntilOpenCodeServer({
  runHook: async (script, payload) => {
    hookCalls.push({ script, payload })
    return { permission: 'allow' }
  },
})
const hooks = await server({
  directory: root,
  worktree: root,
  project: { id: 'package-validation' },
  client: {},
  serverUrl: new URL('http://localhost:4096'),
  experimental_workspace: { register() {} },
  $: {},
})

const config = {}
await hooks.config(config)
const expectedMcpUrl =
  process.env.UNTIL_PUBLIC_PACKAGE === '1'
    ? 'https://run.until.dev/mcp'
    : 'https://run.until.dev/mcp'
assert.equal(
  config.mcp?.until?.url,
  expectedMcpUrl,
  `package must use ${expectedMcpUrl}`,
)

const system = { system: [] }
await hooks['experimental.chat.system.transform'](
  { sessionID: 'package-validation' },
  system,
)
assert.match(
  system.system.join('\n'),
  /until:using-until bootstrap for opencode/,
)
assert.equal(typeof hooks.tool?.until_skill?.execute, 'function')
assert.match(
  await hooks.tool.until_skill.execute({ name: 'using-until' }, {}),
  /# Using Until/,
)

await hooks['tool.execute.before'](
  {
    tool: 'write',
    sessionID: 'package-validation',
    callID: 'package-validation',
  },
  { args: { filePath: join(root, 'example.txt'), content: 'example' } },
)
assert.equal(hookCalls.length, 1)
assert.equal(hookCalls[0]?.payload?.conversation_id, 'package-validation')

const temp = await mkdtemp(join(tmpdir(), 'until-package-validation-'))
try {
  const raw = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', temp],
    { cwd: root, encoding: 'utf8' },
  )
  const [packed] = JSON.parse(raw)
  const packedFiles = new Set((packed?.files ?? []).map((file) => file.path))
  for (const path of [
    '.opencode/server.js',
    '.pi/extensions/until.ts',
    'hooks/until-commit-gate',
    'hooks/until-track-state',
    'skills/using-until/SKILL.md',
  ]) {
    assert.ok(packedFiles.has(path), `packed package is missing ${path}`)
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}

console.log(`Validated ${manifest.name} package contracts`)
