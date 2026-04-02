import type { LogEntry } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { createNameFilter } from '../../src/filters/name'
import { Logger } from '../../src/logger'
import { createConsoleTransport } from '../../src/transports'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

const makeLogger = (options: { level?: string, name?: string } = {}) => (
    new Logger(createConsoleTransport({ stream: { write: mock() } as any }), {
        level: (options.level ?? 'trace') as any,
        name: options.name,
    })
)

describe('createNameFilter', () => {
    // ── Wildcard default ──
    test('default filter allows everything', () => {
        const filter = createNameFilter()

        expect(filter(makeEntry(), makeLogger())).toBe(true)
        expect(filter(makeEntry({ name: 'anything' }), makeLogger())).toBe(true)
    })

    test('explicit * allows everything', () => {
        const filter = createNameFilter('*')

        expect(filter(makeEntry(), makeLogger())).toBe(true)
        expect(filter(makeEntry({ name: 'app:db' }), makeLogger())).toBe(true)
    })

    // ── Include patterns ──
    test('exact name match', () => {
        const filter = createNameFilter('app')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'app' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'app:db' }), logger)).toBe(false)
        expect(filter(makeEntry({ name: 'other' }), logger)).toBe(false)
    })

    test('wildcard name match', () => {
        const filter = createNameFilter('app:*')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'app:db' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'app:api' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'app' }), logger)).toBe(false)
    })

    test('multiple patterns', () => {
        const filter = createNameFilter('app:*,server:*')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'app:db' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'server:http' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'worker:queue' }), logger)).toBe(false)
    })

    // ── Exclude patterns ──
    test('exclude pattern rejects match', () => {
        const filter = createNameFilter('app:*,-app:db')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'app:api' }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'app:db' }), logger)).toBe(false)
    })

    test('-* rejects all names', () => {
        const filter = createNameFilter('-*')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'anything' }), logger)).toBe(false)
        expect(filter(makeEntry({ name: 'app' }), logger)).toBe(false)
    })

    // ── Nameless entries ──
    test('rejects entry without name when filter is not *', () => {
        const filter = createNameFilter('app:*')
        const logger = makeLogger()

        expect(filter(makeEntry(), logger)).toBe(false)
        expect(filter(makeEntry({ name: undefined }), logger)).toBe(false)
    })

    // ── Level bypass ──
    test('level bypass allows entries above threshold regardless of name', () => {
        const filter = createNameFilter('app:*', 'warn')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'other', level: 50 }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'other', level: 60 }), logger)).toBe(true)
    })

    test('level bypass does not apply at or below threshold', () => {
        const filter = createNameFilter('app:*', 'warn')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'other', level: 40 }), logger)).toBe(false)
        expect(filter(makeEntry({ name: 'other', level: 30 }), logger)).toBe(false)
    })

    test('level bypass still applies name filter for entries at or below threshold', () => {
        const filter = createNameFilter('app:*', 'warn')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'app:db', level: 20 }), logger)).toBe(true)
        expect(filter(makeEntry({ name: 'other', level: 20 }), logger)).toBe(false)
    })

    test('no level bypass when level option is omitted', () => {
        const filter = createNameFilter('app:*')
        const logger = makeLogger()

        expect(filter(makeEntry({ name: 'other', level: 60 }), logger)).toBe(false)
    })
})
