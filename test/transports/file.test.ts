import type { LogEntry } from '../../src/types'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { MS_PER_DAY, MS_PER_HOUR } from '@kdtlabs/utils'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { createFileTransport, defaultFileNameFormatter } from '../../src/transports/file'

const TEST_DIR = resolve(import.meta.dirname, '.tmp-file-transport')

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

const cleanup = () => {
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true })
    }
}

afterEach(cleanup)

// ── defaultFileNameFormatter ──

describe('defaultFileNameFormatter', () => {
    test('formats daily with name', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('daily', date, 'app', '.log')

        expect(result).toBe('app.2026-04-02.log')
    })

    test('formats daily without name', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('daily', date, '', '.log')

        expect(result).toBe('2026-04-02.log')
    })

    test('formats hourly', () => {
        const date = new Date('2026-04-02T14:30:00Z')
        const result = defaultFileNameFormatter('hourly', date, '', '.log')

        expect(result).toBe('2026-04-02-14.log')
    })

    test('formats monthly', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('monthly', date, 'app', '.log')

        expect(result).toBe('app.2026-04.log')
    })

    test('formats yearly', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('yearly', date, '', '.log')

        expect(result).toBe('2026.log')
    })

    test('formats weekly', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('weekly', date, 'srv', '.log')

        expect(result).toBe('srv.2026-04-02.log')
    })

    test('uses custom extension', () => {
        const date = new Date('2026-04-02T10:30:00Z')
        const result = defaultFileNameFormatter('daily', date, 'app', '.txt')

        expect(result).toBe('app.2026-04-02.txt')
    })
})

// ── createFileTransport ──

describe('createFileTransport', () => {
    // ── Validation ──

    test('throws when rotate disabled and name is empty', () => {
        expect(() => createFileTransport({ dir: TEST_DIR, rotate: false }))
            .toThrow('Name must be present when log rotate is disabled')
    })

    test('does not throw when rotate disabled and name is provided', () => {
        expect(() => createFileTransport({ dir: TEST_DIR, rotate: false, name: 'app' }))
            .not
            .toThrow()
    })

    // ── Static file (no rotation) ──

    test('writes to static file when rotate is disabled', async () => {
        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            rotate: false,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ message: 'line1' }), null)
        await transport(makeEntry({ message: 'line2' }), null)

        const content = readFileSync(resolve(TEST_DIR, 'app.log'), 'utf8')

        expect(content).toBe('line1\nline2\n')
    })

    test('uses custom extension for static file', async () => {
        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            extension: '.txt',
            rotate: false,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ message: 'hello' }), null)

        expect(existsSync(resolve(TEST_DIR, 'app.txt'))).toBe(true)
    })

    test('creates directory if it does not exist for static file', async () => {
        const dir = resolve(TEST_DIR, 'nested', 'deep')

        const transport = createFileTransport({
            dir,
            name: 'app',
            rotate: false,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ message: 'hello' }), null)

        expect(existsSync(resolve(dir, 'app.log'))).toBe(true)
    })

    // ── Rotated files ──

    test('writes to date-based file with daily rotation', async () => {
        const timestamp = new Date('2026-04-02T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp, message: 'hello' }), null)

        expect(existsSync(resolve(TEST_DIR, '2026-04-02.log'))).toBe(true)
    })

    test('writes to date-based file with name prefix', async () => {
        const timestamp = new Date('2026-04-02T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp, message: 'hello' }), null)

        expect(existsSync(resolve(TEST_DIR, 'app.2026-04-02.log'))).toBe(true)
    })

    test('rotates to new file when timestamp crosses daily boundary', async () => {
        const day1 = new Date('2026-04-02T10:00:00Z').getTime()
        const day2 = day1 + MS_PER_DAY

        const transport = createFileTransport({
            dir: TEST_DIR,
            rotate: { maxFiles: 0 },
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp: day1, message: 'day1' }), null)
        await transport(makeEntry({ timestamp: day2, message: 'day2' }), null)

        const content1 = readFileSync(resolve(TEST_DIR, '2026-04-02.log'), 'utf8')
        const content2 = readFileSync(resolve(TEST_DIR, '2026-04-03.log'), 'utf8')

        expect(content1).toBe('day1\n')
        expect(content2).toBe('day2\n')
    })

    test('keeps writing to same file within same interval', async () => {
        const t1 = new Date('2026-04-02T10:00:00Z').getTime()
        const t2 = t1 + MS_PER_HOUR

        const transport = createFileTransport({
            dir: TEST_DIR,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp: t1, message: 'first' }), null)
        await transport(makeEntry({ timestamp: t2, message: 'second' }), null)

        const content = readFileSync(resolve(TEST_DIR, '2026-04-02.log'), 'utf8')

        expect(content).toBe('first\nsecond\n')
    })

    test('rotates with hourly interval', async () => {
        const hour1 = new Date('2026-04-02T10:00:00Z').getTime()
        const hour2 = hour1 + MS_PER_HOUR

        const transport = createFileTransport({
            dir: TEST_DIR,
            rotate: { interval: 'hourly', maxFiles: 0 },
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp: hour1, message: 'h1' }), null)
        await transport(makeEntry({ timestamp: hour2, message: 'h2' }), null)

        expect(existsSync(resolve(TEST_DIR, '2026-04-02-10.log'))).toBe(true)
        expect(existsSync(resolve(TEST_DIR, '2026-04-02-11.log'))).toBe(true)
    })

    test('creates directory if it does not exist on rotation', async () => {
        const dir = resolve(TEST_DIR, 'rotate', 'deep')
        const timestamp = new Date('2026-04-02T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp, message: 'hello' }), null)

        expect(existsSync(resolve(dir, '2026-04-02.log'))).toBe(true)
    })

    // ── maxFiles cleanup ──

    test('keeps files within maxFiles limit', async () => {
        const base = new Date('2026-04-01T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            rotate: { interval: 'daily', maxFiles: 2 },
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp: base, message: 'd1' }), null)
        await transport(makeEntry({ timestamp: base + MS_PER_DAY, message: 'd2' }), null)
        await transport(makeEntry({ timestamp: base + MS_PER_DAY * 2, message: 'd3' }), null)

        expect(existsSync(resolve(TEST_DIR, '2026-04-01.log'))).toBe(false)
        expect(existsSync(resolve(TEST_DIR, '2026-04-02.log'))).toBe(true)
        expect(existsSync(resolve(TEST_DIR, '2026-04-03.log'))).toBe(true)
    })

    test('does not delete files when within maxFiles limit', async () => {
        const base = new Date('2026-04-01T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            rotate: { interval: 'daily', maxFiles: 10 },
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp: base, message: 'd1' }), null)
        await transport(makeEntry({ timestamp: base + MS_PER_DAY, message: 'd2' }), null)

        expect(existsSync(resolve(TEST_DIR, '2026-04-01.log'))).toBe(true)
        expect(existsSync(resolve(TEST_DIR, '2026-04-02.log'))).toBe(true)
    })

    // ── Custom filename formatter ──

    test('uses custom filename formatter', async () => {
        const timestamp = new Date('2026-04-02T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            rotate: {
                filename: (_interval, _date, _name, ext) => `custom${ext}`,
            },
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp, message: 'hello' }), null)

        expect(existsSync(resolve(TEST_DIR, 'custom.log'))).toBe(true)
    })

    // ── Formatter ──

    test('appends newline to formatted output', async () => {
        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            rotate: false,
            formatter: () => 'fixed',
        })

        await transport(makeEntry(), null)

        const content = readFileSync(resolve(TEST_DIR, 'app.log'), 'utf8')

        expect(content).toBe('fixed\n')
    })

    test('uses default JSON formatter when none provided', async () => {
        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            rotate: false,
        })

        const entry = makeEntry({ message: 'hello' })

        await transport(entry, null)

        const content = readFileSync(resolve(TEST_DIR, 'app.log'), 'utf8')
        const parsed = JSON.parse(content.trim())

        expect(parsed.message).toBe('hello')
    })

    // ── Error handling ──

    test('calls onError when write fails', async () => {
        const onError = mock()

        // Create a directory at the file path to cause EISDIR on appendFile
        const { mkdirSync: mkdir } = await import('node:fs')
        mkdir(resolve(TEST_DIR, 'app.log'), { recursive: true })

        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            rotate: false,
            formatter: () => 'x',
            onError,
        })

        await transport(makeEntry(), null)

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error)
    })

    test('silently swallows error when no onError provided', async () => {
        const { mkdirSync: mkdir } = await import('node:fs')
        mkdir(resolve(TEST_DIR, 'app2.log'), { recursive: true })

        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app2',
            rotate: false,
            formatter: () => 'x',
        })

        await transport(makeEntry(), null)
    })

    // ── Rotate defaults ──

    test('rotate defaults to true with daily interval', async () => {
        const timestamp = new Date('2026-04-02T10:00:00Z').getTime()

        const transport = createFileTransport({
            dir: TEST_DIR,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ timestamp, message: 'hello' }), null)

        expect(existsSync(resolve(TEST_DIR, '2026-04-02.log'))).toBe(true)
    })

    // ── Unwritable directory ──

    test('throws when directory is not writable', () => {
        expect(() => createFileTransport({ dir: '/proc/nonexistent' }))
            .toThrow('Directory for file log is not writable')
    })

    // ── ENOENT recovery ──

    test('recreates directory and retries when directory is deleted mid-session', async () => {
        const transport = createFileTransport({
            dir: TEST_DIR,
            name: 'app',
            rotate: false,
            formatter: (e) => e.message ?? '',
        })

        await transport(makeEntry({ message: 'before' }), null)

        rmSync(TEST_DIR, { recursive: true })

        await transport(makeEntry({ message: 'after' }), null)

        const content = readFileSync(resolve(TEST_DIR, 'app.log'), 'utf8')

        expect(content).toBe('after\n')
    })
})
