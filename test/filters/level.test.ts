import type { LogEntry } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../../src/constants'
import { createLevelFilter } from '../../src/filters/level'
import { Logger } from '../../src/logger'

const makeEntry = (level: number, overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level, metadata: {}, ...overrides,
})

const createLogger = (level: LogLevel = LogLevel.Trace) => {
    const transport = mock()
    const logger = new Logger(transport, { level })

    return { transport, logger }
}

describe('createLevelFilter', () => {
    // ── String level ──
    test('passes entry at or above string level', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('warn')

        expect(filter(makeEntry(LogLevel.Warn), logger)).toBe(true)
        expect(filter(makeEntry(LogLevel.Error), logger)).toBe(true)
        expect(filter(makeEntry(LogLevel.Fatal), logger)).toBe(true)
    })

    test('drops entry below string level', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('warn')

        expect(filter(makeEntry(LogLevel.Info), logger)).toBe(false)
        expect(filter(makeEntry(LogLevel.Debug), logger)).toBe(false)
        expect(filter(makeEntry(LogLevel.Trace), logger)).toBe(false)
    })

    // ── Enum level ──
    test('passes entry at or above enum level', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter(LogLevel.Error)

        expect(filter(makeEntry(LogLevel.Error), logger)).toBe(true)
        expect(filter(makeEntry(LogLevel.Fatal), logger)).toBe(true)
    })

    test('drops entry below enum level', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter(LogLevel.Error)

        expect(filter(makeEntry(LogLevel.Warn), logger)).toBe(false)
        expect(filter(makeEntry(LogLevel.Info), logger)).toBe(false)
    })

    // ── Boundary ──
    test('passes entry at exact level boundary', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('info')

        expect(filter(makeEntry(LogLevel.Info), logger)).toBe(true)
    })

    test('drops entry one level below boundary', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('info')

        expect(filter(makeEntry(LogLevel.Debug), logger)).toBe(false)
    })

    // ── Lowest and highest levels ──
    test('trace level passes everything', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('trace')

        expect(filter(makeEntry(LogLevel.Trace), logger)).toBe(true)
        expect(filter(makeEntry(LogLevel.Notice), logger)).toBe(true)
    })

    test('notice level drops everything below notice', () => {
        const { logger } = createLogger()
        const filter = createLevelFilter('notice')

        expect(filter(makeEntry(LogLevel.Fatal), logger)).toBe(false)
        expect(filter(makeEntry(LogLevel.Notice), logger)).toBe(true)
    })
})
