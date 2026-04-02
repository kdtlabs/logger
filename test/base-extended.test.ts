import type { LogEntry, LogFilter, LogTransformer, LogTransport } from '../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { BaseLogger, type BaseLoggerOptions } from '../src/base'
import { LoggerError } from '../src/error'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 20, data: [], metadata: {}, ...overrides,
})

class TestLogger extends BaseLogger {
    public constructor(transport: LogTransport, options?: BaseLoggerOptions<LogFilter<any>, LogTransformer<any>>) {
        super([10, 20, 30], transport, options)
    }
}

describe('BaseLogger — additional edge cases', () => {
    // ── onError handling ──
    test('calls onError instead of throwing when transport throws', () => {
        const onError = mock()

        const transport: LogTransport = () => {
            throw new Error('transport exploded')
        }

        const logger = new TestLogger(transport, { onError })

        logger.writeLog(makeEntry())

        expect(onError).toHaveBeenCalledTimes(1)

        const [error] = onError.mock.calls[0]!

        expect(error).toBeInstanceOf(LoggerError)
        expect(error.message).toBe('Unexpected logger error')
        expect(error.entry).toBeDefined()
    })

    test('throws LoggerError when transport throws and no onError', () => {
        const transport: LogTransport = () => {
            throw new Error('transport exploded')
        }

        const logger = new TestLogger(transport)

        expect(() => logger.writeLog(makeEntry())).toThrow(LoggerError)
    })

    test('onError receives LoggerError with cause', () => {
        const cause = new Error('root')
        const onError = mock()

        const transport: LogTransport = () => {
            throw cause
        }

        const logger = new TestLogger(transport, { onError })

        logger.writeLog(makeEntry())

        const [error] = onError.mock.calls[0]!

        expect(error.cause).toBe(cause)
    })

    test('onError receives LoggerError with original entry', () => {
        const onError = mock()
        const entry = makeEntry({ message: 'original' })

        const transport: LogTransport = () => {
            throw new Error('fail')
        }

        const logger = new TestLogger(transport, { onError })

        logger.writeLog(entry)

        const [error] = onError.mock.calls[0]!

        expect(error.entry).toBe(entry)
    })

    test('onError is called when transformer throws', () => {
        const onError = mock()
        const transport = mock()

        const transformer: LogTransformer = () => {
            throw new Error('transform error')
        }

        const logger = new TestLogger(transport, { onError, transformers: [transformer] })

        logger.writeLog(makeEntry())

        expect(onError).toHaveBeenCalledTimes(1)
        expect(transport).not.toHaveBeenCalled()
    })

    test('onError is called when filter throws', () => {
        const onError = mock()
        const transport = mock()

        const filter: LogFilter = () => {
            throw new Error('filter error')
        }

        const logger = new TestLogger(transport, { onError, filters: [filter] })

        logger.writeLog(makeEntry())

        expect(onError).toHaveBeenCalledTimes(1)
        expect(transport).not.toHaveBeenCalled()
    })

    // ── addFilter / removeFilter edge cases ──
    test('addFilter does not add duplicate filter', () => {
        const transport = mock()
        const filter: LogFilter = () => true
        const logger = new TestLogger(transport)

        logger.addFilter(filter)
        logger.addFilter(filter)

        logger.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('removeFilter on non-existent filter is no-op', () => {
        const transport = mock()
        const logger = new TestLogger(transport)
        const filter: LogFilter = () => true

        const result = logger.removeFilter(filter)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry())
        expect(transport).toHaveBeenCalledTimes(1)
    })

    // ── addTransformer / removeTransformer edge cases ──
    test('addTransformer does not add duplicate transformer', () => {
        const transport = mock()
        let callCount = 0

        const transformer: LogTransformer = (e) => {
            callCount++

            return e
        }

        const logger = new TestLogger(transport)

        logger.addTransformer(transformer)
        logger.addTransformer(transformer)

        logger.writeLog(makeEntry())

        expect(callCount).toBe(1)
    })

    test('removeTransformer on non-existent transformer is no-op', () => {
        const transport = mock()
        const logger = new TestLogger(transport)
        const transformer: LogTransformer = (e) => e

        const result = logger.removeTransformer(transformer)

        expect(result).toBe(logger)

        logger.writeLog(makeEntry())
        expect(transport).toHaveBeenCalledTimes(1)
    })

    // ── Transform chain edge cases ──
    test('transformer returning undefined continues chain', () => {
        const transport = mock()
        const t1: LogTransformer = () => {}
        const t2: LogTransformer = (e) => ({ ...e, message: 'applied' })
        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
        expect(transport.mock.calls[0]![0].message).toBe('applied')
    })

    test('all transformers returning null/undefined still sends original entry', () => {
        const transport = mock()
        const t1: LogTransformer = () => null
        const t2: LogTransformer = () => {}
        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry({ message: 'original' }))

        expect(transport).toHaveBeenCalledTimes(1)
        expect(transport.mock.calls[0]![0].message).toBe('original')
    })

    test('transform result replaces entry for subsequent transformers', () => {
        const transport = mock()
        const t1: LogTransformer = (e) => ({ ...e, message: 'step1' })

        const t2: LogTransformer = (e) => {
            expect(e.message).toBe('step1')

            return { ...e, message: 'step2' }
        }

        const logger = new TestLogger(transport, { transformers: [t1, t2] })

        logger.writeLog(makeEntry())

        expect(transport.mock.calls[0]![0].message).toBe('step2')
    })

    // ── writeLog after transform chain returns nullish ──
    test('writeLog does not call transport when transform chain returns undefined', () => {
        const transport = mock()
        const t1: LogTransformer = () => false
        const logger = new TestLogger(transport, { transformers: [t1] })

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    // ── Level edge cases ──
    test('entry at exact level boundary is loggable', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { level: 20 })

        logger.writeLog(makeEntry({ level: 20 }))

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('entry below level boundary is not loggable', () => {
        const transport = mock()
        const logger = new TestLogger(transport, { level: 20 })

        logger.writeLog(makeEntry({ level: 10 }))

        expect(transport).not.toHaveBeenCalled()
    })

    // ── Filters array is a copy ──
    test('modifying original filters array does not affect logger', () => {
        const transport = mock()
        const filter: LogFilter = () => false
        const filters = [filter]
        const logger = new TestLogger(transport, { filters })

        filters.length = 0

        logger.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('modifying original transformers array does not affect logger', () => {
        const transport = mock()
        const transformer: LogTransformer = (e) => ({ ...e, message: 'changed' })
        const transformers = [transformer]
        const logger = new TestLogger(transport, { transformers })

        transformers.length = 0

        logger.writeLog(makeEntry())

        expect(transport.mock.calls[0]![0].message).toBe('changed')
    })

    // ── Parent reference chain ──
    test('child is blocked when parent is disabled', () => {
        const transport = mock()
        const parent = new TestLogger(transport)
        const child = new TestLogger(transport, { parent })

        parent.disable()

        child.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('child logs when parent is enabled', () => {
        const transport = mock()
        const parent = new TestLogger(transport)
        const child = new TestLogger(transport, { parent })

        child.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('parent is not affected by child disable', () => {
        const transport = mock()
        const parent = new TestLogger(transport)
        const child = new TestLogger(transport, { parent })

        child.disable()

        parent.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('child respects parent level gate', () => {
        const transport = mock()
        const parent = new TestLogger(transport, { level: 30 })
        const child = new TestLogger(transport, { parent, level: 10 })

        child.writeLog(makeEntry({ level: 20 }))

        expect(transport).not.toHaveBeenCalled()

        child.writeLog(makeEntry({ level: 30 }))

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('grandchild blocked when grandparent is disabled', () => {
        const transport = mock()
        const grandparent = new TestLogger(transport)
        const parent = new TestLogger(transport, { parent: grandparent })
        const child = new TestLogger(transport, { parent })

        grandparent.disable()

        child.writeLog(makeEntry())

        expect(transport).not.toHaveBeenCalled()
    })

    test('re-enabling parent unblocks child', () => {
        const transport = mock()
        const parent = new TestLogger(transport)
        const child = new TestLogger(transport, { parent })

        parent.disable()

        child.writeLog(makeEntry())
        expect(transport).not.toHaveBeenCalled()

        parent.enable()

        child.writeLog(makeEntry())
        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('logger without parent works normally', () => {
        const transport = mock()
        const logger = new TestLogger(transport)

        logger.writeLog(makeEntry())

        expect(transport).toHaveBeenCalledTimes(1)
    })
})
