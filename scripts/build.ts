import { join, resolve } from 'node:path'

const srcDir = join(resolve(import.meta.dir, '..'), 'src')

console.log(`📦 Bundling...`)

const result = await Bun.build({
    drop: ['console', 'debugger'],
    entrypoints: [join(srcDir, 'index.ts'), join(srcDir, 'integrations/hono.ts'), join(srcDir, 'integrations/drizzle.ts')],
    env: 'disable',
    format: 'esm',
    minify: {
        identifiers: false,
        syntax: true,
        whitespace: true,
    },
    outdir: 'dist',
    packages: 'external',
    root: 'src',
    sourcemap: 'linked',
    splitting: true,
    target: 'node',
})

if (result.logs.length > 0) {
    console.warn(`⚠️  Build completed with ${result.logs.length} warning(s):`)

    for (const log of result.logs) {
        console.warn(log)
    }
} else {
    console.log('✅ Build complete!')
}
