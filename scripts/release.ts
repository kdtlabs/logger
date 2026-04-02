import { exists } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $ } from 'bun'

const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gitPath = resolve(rootPath, '.git')

if (!(await exists(gitPath))) {
    console.error('❌ No .git directory found')
    process.exit(1)
}

const status = await $`git -C ${rootPath} status --porcelain`.text()

if (status.trim().length > 0) {
    console.error('❌ Working tree is dirty. Please commit or stash changes before releasing.')
    process.exit(1)
}

console.log('📋 Generating changelog and bumping version...')
await $`bunx changelogen --clean --release --no-commit --no-tag --no-github --output CHANGELOG.md`

console.log('🔧 Running lint fix...')
await $`bun run lint:fix package.json`

console.log('📦 Staging changes...')
await $`git -C ${rootPath} add -A`

const pkg = await Bun.file(resolve(rootPath, 'package.json')).json()
const version = `v${pkg.version.replace(/^v/u, '')}`

await $`git -C ${rootPath} commit -m "chore(release): ${version}"`
await $`git -C ${rootPath} tag -am ${version} ${version}`

const confirm = prompt(`🚀 Push ${version} to remote? (y/N)`)

if (confirm?.toLowerCase() === 'y') {
    await $`git -C ${rootPath} push --follow-tags`
} else {
    console.log('⏸️  Push cancelled. Commit and tag are created locally.')
}

console.log(`✅ Released ${version}`)
