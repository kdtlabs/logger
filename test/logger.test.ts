import type { LogEntry } from '../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../src/constants'
import { Logger, type LoggerOptions, message } from '../src/logger'

const makeLogger = (options: LoggerOptions = {}) => {
    const transport = mock()

    return { logger: new Logger(transport, { level: 'trace', ...options }), transport }
}

const lastEntry = (transport: ReturnType<typeof mock>): LogEntry => (
    transport.mock.calls.at(-1)![0] as LogEntry
)

describe('Logger', () => {
    // ── Constructor ──
    test('default level is info', () => {
        const { logger } = makeLogger({ level: undefined })
        expect(logger.level).toBe(LogLevel.Info)
    })

    test('accepts string level', () => {
        const { logger } = makeLogger({ level: 'debug' })
        expect(logger.level).toBe(LogLevel.Debug)
    })

    test('accepts enum level', () => {
        const { logger } = makeLogger({ level: LogLevel.Warn })
        expect(logger.level).toBe(LogLevel.Warn)
    })

    test('includes hostname and pid in metadata', () => {
        const { logger, transport } = makeLogger()

        logger.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).toHaveProperty('hostname')
        expect(entry.metadata).toHaveProperty('pid')
    })

    test('custom metadata merges with defaults', () => {
        const { logger, transport } = makeLogger({ metadata: { service: 'api' } })

        logger.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).toHaveProperty('service', 'api')
        expect(entry.metadata).toHaveProperty('hostname')
    })

    // ── getLevel / getLevelName ──
    test('getLevel resolves string name to number', () => {
        const { logger } = makeLogger()

        expect(logger.getLevel('info')).toBe(30)
        expect(logger.getLevel('error')).toBe(50)
    })

    test('getLevel resolves enum to number', () => {
        const { logger } = makeLogger()

        expect(logger.getLevel(LogLevel.Info)).toBe(30)
    })

    test('getLevelName resolves number to string', () => {
        const { logger } = makeLogger()

        expect(logger.getLevelName(30)).toBe('info')
        expect(logger.getLevelName(50)).toBe('error')
    })

    // ── Level methods ──
    test('trace logs at level 10', () => {
        const { logger, transport } = makeLogger()
        logger.trace('msg')
        expect(lastEntry(transport).level).toBe(10)
    })

    test('debug logs at level 20', () => {
        const { logger, transport } = makeLogger()
        logger.debug('msg')
        expect(lastEntry(transport).level).toBe(20)
    })

    test('info logs at level 30', () => {
        const { logger, transport } = makeLogger()
        logger.info('msg')
        expect(lastEntry(transport).level).toBe(30)
    })

    test('warn logs at level 40', () => {
        const { logger, transport } = makeLogger()
        logger.warn('msg')
        expect(lastEntry(transport).level).toBe(40)
    })

    test('error logs at level 50', () => {
        const { logger, transport } = makeLogger()
        logger.error('msg')
        expect(lastEntry(transport).level).toBe(50)
    })

    test('fatal logs at level 60', () => {
        const { logger, transport } = makeLogger()
        logger.fatal('msg')
        expect(lastEntry(transport).level).toBe(60)
    })

    test('notice logs at level 70', () => {
        const { logger, transport } = makeLogger()
        logger.notice('msg')
        expect(lastEntry(transport).level).toBe(70)
    })

    // ── log() argument parsing ──
    test('string first arg becomes message', () => {
        const { logger, transport } = makeLogger()
        logger.info('hello', 'extra')

        const entry = lastEntry(transport)
        expect(entry.message).toBe('hello')
        expect(entry.data).toEqual(['extra'])
    })

    test('non-string first arg goes to data', () => {
        const { logger, transport } = makeLogger()
        logger.info(42, 'extra')

        const entry = lastEntry(transport)
        expect(entry.message).toBeUndefined()
        expect(entry.data).toEqual([42, 'extra'])
    })

    test('no args may omit data', () => {
        const { logger, transport } = makeLogger()
        logger.info()

        const entry = lastEntry(transport)
        expect(entry.message).toBeUndefined()
        expect(entry.data).toBeUndefined()
    })

    test('lazy message is resolved', () => {
        const { logger, transport } = makeLogger()
        logger.info(message(() => 'lazy'), 'data')

        const entry = lastEntry(transport)
        expect(entry.message).toBe('lazy')
        expect(entry.data).toEqual(['data'])
    })

    test('log returns this for chaining', () => {
        const { logger } = makeLogger()
        expect(logger.info('test')).toBe(logger)
    })

    test('entry includes levelName in metadata', () => {
        const { logger, transport } = makeLogger()
        logger.info('test')

        expect(lastEntry(transport).metadata).toHaveProperty('levelName', 'info')
    })

    test('entry includes logger name', () => {
        const { logger, transport } = makeLogger({ name: 'myapp' })
        logger.info('test')

        expect(lastEntry(transport).name).toBe('myapp')
    })

    // ── child() ──
    test('child inherits transport', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })

        child.info('test')

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('child joins name with separator', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db' })

        child.info('test')

        expect(lastEntry(transport).name).toBe('app:db')
    })

    test('child without name keeps parent name', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child()

        child.info('test')

        expect(lastEntry(transport).name).toBe('app')
    })

    test('child custom name separator', () => {
        const { logger, transport } = makeLogger({ name: 'app' })
        const child = logger.child({ name: 'db', nameSeparator: '.' })

        child.info('test')

        expect(lastEntry(transport).name).toBe('app.db')
    })

    test('child merges filters by default', () => {
        const parentFilter = mock(() => true)
        const childFilter = mock(() => true)
        const { logger } = makeLogger({ name: 'app', filters: [parentFilter] })
        const child = logger.child({ name: 'db', filters: [childFilter] })

        child.info('test')

        expect(parentFilter).toHaveBeenCalled()
        expect(childFilter).toHaveBeenCalled()
    })

    test('child replaces filters when mergeFilters is false', () => {
        const parentFilter = mock(() => true)
        const childFilter = mock(() => true)
        const { logger } = makeLogger({ name: 'app', filters: [parentFilter] })
        const child = logger.child({ name: 'db', filters: [childFilter], mergeFilters: false })

        child.info('test')

        expect(parentFilter).not.toHaveBeenCalled()
        expect(childFilter).toHaveBeenCalled()
    })

    test('child merges transformers by default', () => {
        const calls: string[] = []

        const t1 = mock((e: LogEntry) => {
            calls.push('t1')

            return e
        })

        const t2 = mock((e: LogEntry) => {
            calls.push('t2')

            return e
        })

        const { logger } = makeLogger({ transformers: [t1] })
        const child = logger.child({ transformers: [t2] })

        child.info('test')

        expect(calls).toEqual(['t1', 't2'])
    })

    test('child replaces transformers when mergeTransformers is false', () => {
        const t1 = mock((e: LogEntry) => e)
        const t2 = mock((e: LogEntry) => e)
        const { logger } = makeLogger({ transformers: [t1] })
        const child = logger.child({ transformers: [t2], mergeTransformers: false })

        child.info('test')

        expect(t1).not.toHaveBeenCalled()
        expect(t2).toHaveBeenCalled()
    })

    test('child merges metadata', () => {
        const { logger, transport } = makeLogger({ name: 'app', metadata: { service: 'api' } })
        const child = logger.child({ name: 'db', metadata: { component: 'query' } })

        child.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).toHaveProperty('service', 'api')
        expect(entry.metadata).toHaveProperty('component', 'query')
    })

    // ── with() ──
    test('with returns instance with merged metadata', () => {
        const { logger, transport } = makeLogger({ metadata: { service: 'api' } })
        const withLogger = logger.with({ requestId: '123' })

        withLogger.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).toHaveProperty('service', 'api')
        expect(entry.metadata).toHaveProperty('requestId', '123')
    })

    test('with does not affect parent metadata', () => {
        const { logger, transport } = makeLogger({ metadata: { service: 'api' } })
        logger.with({ requestId: '123' })

        logger.info('test')

        const entry = lastEntry(transport)
        expect(entry.metadata).not.toHaveProperty('requestId')
    })

    test('with preserves instanceof', () => {
        const { logger } = makeLogger()
        const withLogger = logger.with({ extra: true })

        expect(withLogger).toBeInstanceOf(Logger)
    })

    // ── Level filtering ──
    test('respects level filtering', () => {
        const { logger, transport } = makeLogger({ level: 'warn' })

        logger.debug('hidden')
        logger.info('hidden')
        logger.warn('shown')
        logger.error('shown')

        expect(transport).toHaveBeenCalledTimes(2)
    })
})
