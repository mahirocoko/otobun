import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const appName = 'Otobun.app'
const installDir = process.env.OTOBUN_INSTALL_DIR || '/Applications'
const destination = join(installDir, appName)
const candidates = [
  join(root, 'target', 'release', 'bundle', 'macos', appName),
  join(root, 'apps', 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', appName),
]

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('pnpm', ['--filter', '@otobun/desktop', 'tauri', 'build', '--bundles', 'app'])

const source = candidates.find((candidate) => existsSync(candidate))
if (!source) {
  console.error('Could not find built Otobun.app. Checked:')
  for (const candidate of candidates) console.error(`- ${candidate}`)
  process.exit(1)
}

if (existsSync(destination)) {
  rmSync(destination, { recursive: true, force: true })
}

cpSync(source, destination, { recursive: true })
console.log(`Installed ${destination}`)
