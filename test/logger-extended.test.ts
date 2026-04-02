import type { LogEntry } from '../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../src/constants'
import { Logger, LOGGER_LAZY_MESSAGE, type LoggerOptions, message } from '../src/logger'

const makeLogger = (options: LoggerOptions = {}) => {
    const transport = mock()

    return { logger: new Logger(transport, { level: 'trace', ...options }), transport }
}

const lastEntry = (transport: ReturnType<typeof mock>): LogEntry => (
    transport.mock.calls.at(-1)![0] as LogEntry
)

describe('Logger — additional edge cases', () => {
    // ── Constructor ──
    test('throws on invalid level string', () => {
        const transport = mock()

        expect(() => new Logger(transport, { level: 'invalid' as any })).toThrow()
    })

    test('accepts all valid string levels', () => {
        const transport = mock()
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'notice'] as const

        for (const level of levels) {
            const logger = new Logger(transport, { level })
            expect(logger.level).toBe(LogLevel[level.charAt(0).toUpperCase() + level.slice(1) as keyof typeof LogLevel])
        }
    })

    // ── log() argument parsing edge cases ──
    test('single non-string arg goes to data, no message', () => {
        const { logger, transport } = makeLogger()

        logger.info({ key: 'value' })

        const entry = lastEntry(transport)
        expect(entry.message).toBeUndefined()
        expect(entry.data).toEqual([{ key: 'value' }])
    })

    test('lazy message without additional data', () => {
        const { logger, transport } = makeLogger()

        logger.info(message(() => 'lazy only'))

        const entry = lastEntry(transport)
        expect(entry.message).toBe('lazy only')
        expect(entry.data).toEqual([])
    })

    test('lazy message is not evaluated when level is too low', () => {
        let called = false
        const { logger } = makeLogger({ level: 'error' })

        logger.debug(message(() => {
            called = true

            return 'never'
        }))

        expect(called).toBe(false)
    })

    test('single string arg sets message, no data', () => {
        const { logger, transport } = makeLogger()

        logger.info('just a message')

        const entry = lastEntry(transport)
        expect(entry.message).toBe('just a message')
        expect(entry.data).toBeUndefined()
    })

    test('string message with multiple data args', () => {
        const { logger, transport } = makeLogger()

        logger.info('msg', 1, 2, 3)

        const entry = lastEntry(transport)
        expect(entry.message).toBe('msg')
        expect(entry.data).toEqual([1, 2, 3])
    })

    // ── log() returns this ──
    test('all level methods return this for chaining', () => {
        const { logger } = makeLogger()

        expect(logger.trace('t')).toBe(logger)
        expect(logger.debug('d')).toBe(logger)
        expect(logger.info('i')).toBe(logger)
        expect(logger.warn('w')).toBe(logger)
        expect(logger.error('e')).toBe(logger)
        expect(logger.fatal('f')).toBe(logger)
        expect(logger.notice('n')).toBe(logger)
    })

    test('log returns this even when level is filtered out', () => {
        const { logger } = makeLogger({ level: 'fatal' })

        expect(logger.trace('skipped')).toBe(logger)
    })

    // ── Entry includes timestamp ──
    test('entry has a numeric timestamp', () => {
        const { logger, transport } = makeLogger()

        const before = Date.now()
        logger.info('timed')
        const after = Date.now()

        const entry = lastEntry(transport)
        expect(entry.timestamp).toBeGreaterThanOrEqual(before)
        expect(entry.timestamp).toBeLessThanOrEqual(after)
    })

    // ── child() edge cases ──
    test('child with no parent name uses child name directly', () => {
        const { logger, transport } = makeLogger()
        const child = logger.child({ name: 'child' })

        child.info('test')

        expect(lastEntry(transport).name).toBe('child')
    })

    test('deeply nested children join names correctly', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })
        const grandchild = child.child({ name: 'query' })

        grandchild.info('test')

        expect(lastEntry(transport).name).toBe('app:db:query')
    })

    test('child inherits level from parent options', () => {
        const { logger } = makeLogger({ level: 'warn' })
        const child = logger.child()

        expect(child.level).toBe(LogLevel.Warn)
    })

    test('child can override level', () => {
        const { logger } = makeLogger({ level: 'warn' })
        const child = logger.child({ level: 'debug' })

        expect(child.level).toBe(LogLevel.Debug)
    })

    test('child inherits enabled state from parent options', () => {
        const { logger } = makeLogger({ enabled: false })
        const child = logger.child()

        expect(child.isEnabled).toBe(false)
    })

    test('child metadata overrides parent metadata on conflict', () => {
        const { logger, transport } = makeLogger({ metadata: { env: 'prod' } })
        const child = logger.child({ metadata: { env: 'test' } })

        child.info('test')

        expect(lastEntry(transport).metadata).toHaveProperty('env', 'test')
    })

    // ── with() edge cases ──
    test('with creates object that inherits from logger instance', () => {
        const { logger } = makeLogger()
        const withLogger = logger.with({ extra: true })

        expect(Object.getPrototypeOf(withLogger)).toBe(logger)
    })

    test('chained with calls merge metadata cumulatively', () => {
        const { logger, transport } = makeLogger()
        const withLogger = logger.with({ a: 1 }).with({ b: 2 })

        withLogger.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).toHaveProperty('a', 1)
        expect(entry.metadata).toHaveProperty('b', 2)
    })

    test('with overrides existing metadata keys', () => {
        const { logger, transport } = makeLogger({ metadata: { key: 'old' } })
        const withLogger = logger.with({ key: 'new' })

        withLogger.info('test')

        expect(lastEntry(transport).metadata).toHaveProperty('key', 'new')
    })

    // ── LOGGER_LAZY_MESSAGE symbol ──
    test('LOGGER_LAZY_MESSAGE is a global symbol', () => {
        expect(typeof LOGGER_LAZY_MESSAGE).toBe('symbol')
        expect(LOGGER_LAZY_MESSAGE.toString()).toBe('Symbol(logger.lazy-message)')
    })

    // ── message() helper ──
    test('message creates object with LOGGER_LAZY_MESSAGE and toString', () => {
        const msg = message(() => 'hello')

        expect(LOGGER_LAZY_MESSAGE in msg).toBe(true)
        expect(msg.toString()).toBe('hello')
    })

    // ── getLevel / getLevelName edge cases ──
    test('getLevel returns undefined for unknown level name', () => {
        const { logger } = makeLogger()

        expect(logger.getLevel('unknown' as any)).toBeUndefined()
    })

    test('getLevelName returns undefined for unknown level number', () => {
        const { logger } = makeLogger()

        expect(logger.getLevelName(999)).toBeUndefined()
    })

    // ── log() with LogLevel enum directly ──
    test('log accepts LogLevel enum value', () => {
        const { logger, transport } = makeLogger()

        logger.log(LogLevel.Warn, 'enum level')

        expect(lastEntry(transport).level).toBe(40)
    })

    test('log accepts string level name', () => {
        const { logger, transport } = makeLogger()

        logger.log('error', 'string level')

        expect(lastEntry(transport).level).toBe(50)
    })

    // ── Parent reference chain via child() ──
    test('child is blocked when parent is disabled', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })

        logger.disable()

        child.info('blocked')

        expect(transport).not.toHaveBeenCalled()
    })

    test('child logs after parent is re-enabled', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })

        logger.disable()
        child.info('blocked')
        expect(transport).not.toHaveBeenCalled()

        logger.enable()
        child.info('allowed')
        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('parent level gate blocks child', () => {
        const { logger, transport } = makeLogger({ name: 'app', level: 'trace' })
        const child = logger.child({ name: 'db' })

        logger.level = LogLevel.Error

        child.info('blocked by parent level')

        expect(transport).not.toHaveBeenCalled()

        child.error('allowed')

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('grandchild blocked when grandparent disabled', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })
        const grandchild = child.child({ name: 'query' })

        logger.disable()

        grandchild.info('blocked')

        expect(transport).not.toHaveBeenCalled()
    })

    test('disabling child does not affect parent', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })

        child.disable()

        logger.info('still works')

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('with() inherits parent chain from source logger', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })
        const withChild = child.with({ requestId: '123' })

        logger.disable()

        withChild.info('blocked')

        expect(transport).not.toHaveBeenCalled()
    })
})
