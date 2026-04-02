import type { LogEntry, LogFilter, LogTransformer, LogTransport } from '../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { BaseLogger, type BaseLoggerOptions } from '../src/base'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 20, data: [], metadata: {}, ...overrides,
})

class TestLogger extends BaseLogger {
    public constructor(transport: LogTransport, options?: BaseLoggerOptions<LogFilter<any>, LogTransformer<any>>) {
        super([10, 20, 30], transport, options)
    }
}

describe('BaseLogger', () => {
    // ── Constructor ──
    test('sets default values', () => {
        const transport = mock()
        const logger = new TestLogger(transport)

        expect(logger.isEnabled).toBe(true)
        expect(logger.level).toBe(10)
        expect(logger.levels).toEqual([10, 20, 30])
        expect(logger.name).toBeUndefined()
    })

    test('accepts options', () => {
        const transport = mock()
        const filter: LogFilter = () => true
        const transformer: LogTransformer = (e) => e

        const logger = new TestLogger(transport, {
            enabled: false,
            filters: [filter],
            level: 20,
            name: 'test',
            transformers: [transformer],
        })

        expect(logger.isEnabled).toBe(false)
        expect(logger.level).toBe(20)
        expect(logger.name).toBe('test')
    })

    test('sorts and deduplicates levels', () => {
        const transport = mock()

        class UnsortedLogger extends BaseLogger {
            public constructor() {
                super([30, 10, 20, 10], transport)
            }
        }

        const logger = new UnsortedLogger()
        expect(logger.levels).toEqual([10, 20, 30])
    })

    test('throws on empty levels', () => {
        const transport = mock()

        class EmptyLogger extends BaseLogger {
            public constructor() {
                super([], transport)
            }
        }

        expect(() => new EmptyLogger()).toThrow()
    })

    // ── Enable / Disable ──
    test('enable returns this and sets isEnabled', () => {
        const logger = new TestLogger(mock(), { enabled: false })

        const result = logger.enable()

        expect(result).toBe(logger)
        expect(logger.isEnabled).toBe(true)
    })

    test('disable returns this and clears isEnabled', () => {
        const logger = new TestLogger(mock())

        const result = logger.disable()

        expect(result).toBe(logger)
        expect(logger.isEnabled).toBe(false)
    })

    // ── Add / Remove filter ──
    test('addFilter returns this and adds filter', () => {
        const transport = mock()
        const logger = new TestLogger(transport)
        const filter: LogFilter = () => true

        const result = logger.addFilter(filter)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry())
        expect(transport).toHaveBeenCalled()
    })

    test('removeFilter returns this and removes filter', () => {
        const filter: LogFilter = () => false
        const transport = mock()
        const logger = new TestLogger(transport, { filters: [filter] })

        logger.writeLog(makeEntry())
        expect(transport).not.toHaveBeenCalled()

        const result = logger.removeFilter(filter)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry())
        expect(transport).toHaveBeenCalled()
    })

    // ── Add / Remove transformer ──
    test('addTransformer returns this and adds transformer', () => {
        const transport = mock()
        const logger = new TestLogger(transport)
        const transformer: LogTransformer = (e) => ({ ...e, message: 'added' })

        const result = logger.addTransformer(transformer)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry())
        expect(transport.mock.calls[0]![0].message).toBe('added')
    })

    test('removeTransformer returns this and removes transformer', () => {
        const transformer: LogTransformer = (e) => ({ ...e, message: 'transformed' })
        const transport = mock()
        const logger = new TestLogger(transport, { transformers: [transformer] })

        logger.writeLog(makeEntry())
        expect(transport.mock.calls[0]![0].message).toBe('transformed')

        const result = logger.removeTransformer(transformer)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry({ message: 'original' }))
        expect(transport.mock.calls[1]![0].message).toBe('original')
    })

    // ── writeLog ──
    test('calls transport with entry when loggable', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { level: 10 })
        const entry = makeEntry({ level: 20 })

        logger.writeLog(entry)

        expect(transport).toHaveBeenCalledWith(entry, logger)
    })

    test('skips transport when disabled', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { enabled: false })

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('skips transport when level too low', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { level: 30 })

        logger.writeLog(makeEntry({ level: 20 }))

        expect(transport).not.toHaveBeenCalled()
    })

    test('skips transport when filter rejects', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { filters: [() => false] })

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('all filters must pass', () => {
        const transport = mock()

        const logger = new TestLogger(transport, {
            filters: [() => true, () => false],
        })

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    // ── Transform chain ──
    test('applies transformers in order', () => {
        const transport = mock()
        const t1: LogTransformer = (e) => ({ ...e, message: 'transformed' })
        const t2: LogTransformer = (e) => ({ ...e, message: `${e.message}!` })
        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
        expect(transport.mock.calls[0]![0].message).toBe('transformed!')
    })

    test('transformer returning false aborts the chain', () => {
        const transport = mock()
        const t1: LogTransformer = () => false
        const t2: LogTransformer = (e) => ({ ...e, message: 'never' })
        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('transformer returning null/undefined skips without aborting', () => {
        const transport = mock()
        const t1: LogTransformer = () => null
        const t2: LogTransformer = (e) => ({ ...e, message: 'applied' })
        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
        expect(transport.mock.calls[0]![0].message).toBe('applied')
    })
})
