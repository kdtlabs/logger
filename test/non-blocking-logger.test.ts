import type { LogEntry } from '../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../src/constants'
import { NonBlockingLogger, type NonBlockingLoggerOptions } from '../src/non-blocking-logger'

const makeLogger = (options: NonBlockingLoggerOptions = {}) => {
    const transport = mock()

    return { logger: new NonBlockingLogger(transport, { level: 'trace', ...options }), transport }
}

const lastEntry = (transport: ReturnType<typeof mock>): LogEntry => (
    transport.mock.calls.at(-1)![0] as LogEntry
)

const allEntries = (transport: ReturnType<typeof mock>): LogEntry[] => (
    transport.mock.calls.map((call) => call[0] as LogEntry)
)

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('NonBlockingLogger', () => {
    // ── Constructor ──

    test('is an instance of NonBlockingLogger', () => {
        const { logger } = makeLogger()

        expect(logger).toBeInstanceOf(NonBlockingLogger)
    })

    test('creates its own queue when none provided', () => {
        const { logger } = makeLogger()

        expect((logger as any).queue).toBeDefined()
        expect((logger as any).queue.entries).toEqual([])
    })

    test('accepts a shared queue via options', () => {
        const queue = { entries: [] as Array<() => void>, head: 0, scheduled: false }
        const { logger } = makeLogger({ queue })

        expect((logger as any).queue).toBe(queue)
    })

    // ── Non-blocking behavior ──

    test('does not call transport synchronously', () => {
        const { logger, transport } = makeLogger()

        logger.info('test')

        expect(transport).not.toHaveBeenCalled()
    })

    test('calls transport after microtask drain', async () => {
        const { logger, transport } = makeLogger()

        logger.info('test')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('returns this for chaining', () => {
        const { logger } = makeLogger()

        expect(logger.info('test')).toBe(logger)
    })

    // ── FIFO ordering ──

    test('processes entries in insertion order', async () => {
        const { logger, transport } = makeLogger()

        logger.info('first')
        logger.info('second')
        logger.info('third')

        await flushMicrotasks()

        const entries = allEntries(transport)

        expect(entries).toHaveLength(3)
        expect(entries[0]!.message).toBe('first')
        expect(entries[1]!.message).toBe('second')
        expect(entries[2]!.message).toBe('third')
    })

    test('preserves order across log levels', async () => {
        const { logger, transport } = makeLogger()

        logger.error('a')
        logger.debug('b')
        logger.warn('c')

        await flushMicrotasks()

        const entries = allEntries(transport)

        expect(entries[0]!.level).toBe(LogLevel.Error)
        expect(entries[1]!.level).toBe(LogLevel.Debug)
        expect(entries[2]!.level).toBe(LogLevel.Warn)
    })

    // ── Level gating ──

    test('skips entries below current level without queueing', async () => {
        const { logger, transport } = makeLogger({ level: 'warn' })

        logger.debug('should skip')
        logger.info('should skip')
        logger.warn('should pass')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)
        expect(lastEntry(transport).message).toBe('should pass')
    })

    test('does not schedule microtask when all entries are below level', () => {
        const { logger } = makeLogger({ level: 'error' })

        logger.info('skip')

        expect((logger as any).queue.scheduled).toBe(false)
        expect((logger as any).queue.entries).toHaveLength(0)
    })

    // ── drain() ──

    test('drain processes all queued entries synchronously', () => {
        const { logger, transport } = makeLogger()

        logger.info('a')
        logger.info('b')
        logger.info('c')

        expect(transport).not.toHaveBeenCalled()

        logger.drain()

        expect(transport).toHaveBeenCalledTimes(3)
    })

    test('drain resets queue state', () => {
        const { logger } = makeLogger()

        logger.info('a')
        logger.drain()

        const q = (logger as any).queue

        expect(q.entries).toHaveLength(0)
        expect(q.head).toBe(0)
        expect(q.scheduled).toBe(false)
    })

    test('drain is no-op when queue is empty', () => {
        const { logger, transport } = makeLogger()

        logger.drain()

        expect(transport).not.toHaveBeenCalled()
    })

    test('microtask after manual drain is no-op', async () => {
        const { logger, transport } = makeLogger()

        logger.info('a')
        logger.drain()

        expect(transport).toHaveBeenCalledTimes(1)

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('drain handles entries pushed during drain', () => {
        const order: string[] = []

        let logger: NonBlockingLogger

        const transport = mock((entry: LogEntry) => {
            order.push(entry.message!)

            if (entry.message === 'trigger') {
                logger.info('nested')
            }
        })

        logger = new NonBlockingLogger(transport, { level: 'trace' })

        logger.info('trigger')
        logger.drain()

        expect(order).toEqual(['trigger', 'nested'])
    })

    // ── Shared queue (child) ──

    test('child shares queue with parent', () => {
        const { logger } = makeLogger()
        const child = logger.child({ name: 'child' })

        expect((child as any).queue).toBe((logger as any).queue)
    })

    test('parent and child entries are interleaved in FIFO order', async () => {
        const { logger, transport } = makeLogger({ name: 'parent' })
        const child = logger.child({ name: 'child' })

        logger.info('p1')
        child.info('c1')
        logger.info('p2')
        child.info('c2')

        await flushMicrotasks()

        const entries = allEntries(transport)

        expect(entries).toHaveLength(4)
        expect(entries[0]!.message).toBe('p1')
        expect(entries[1]!.message).toBe('c1')
        expect(entries[2]!.message).toBe('p2')
        expect(entries[3]!.message).toBe('c2')
    })

    test('drain flushes both parent and child entries', () => {
        const { logger, transport } = makeLogger({ name: 'parent' })
        const child = logger.child({ name: 'child' })

        logger.info('p1')
        child.info('c1')

        logger.drain()

        expect(transport).toHaveBeenCalledTimes(2)
    })

    test('child drain also flushes parent entries (shared queue)', () => {
        const { logger, transport } = makeLogger({ name: 'parent' })
        const child = logger.child({ name: 'child' })

        logger.info('p1')
        child.info('c1')

        child.drain()

        expect(transport).toHaveBeenCalledTimes(2)
    })

    test('grandchild shares queue with root', () => {
        const { logger } = makeLogger({ name: 'root' })
        const child = logger.child({ name: 'child' })
        const grandchild = child.child({ name: 'grandchild' })

        expect((grandchild as any).queue).toBe((logger as any).queue)
    })

    // ── Shared queue (with) ──

    test('with() shares queue with parent', () => {
        const { logger } = makeLogger()
        const withLogger = logger.with({ requestId: 'abc' })

        expect((withLogger as any).queue).toBe((logger as any).queue)
    })

    test('with() entries are interleaved with parent in FIFO order', async () => {
        const { logger, transport } = makeLogger()
        const withLogger = logger.with({ requestId: 'abc' })

        logger.info('root')
        withLogger.info('with')
        logger.info('root again')

        await flushMicrotasks()

        const entries = allEntries(transport)

        expect(entries).toHaveLength(3)
        expect(entries[0]!.message).toBe('root')
        expect(entries[1]!.message).toBe('with')
        expect(entries[2]!.message).toBe('root again')
    })

    // ── Multiple batches ──

    test('works across multiple microtask batches', async () => {
        const { logger, transport } = makeLogger()

        logger.info('batch 1')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)

        logger.info('batch 2')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(2)
    })

    test('reschedules microtask after drain completes', async () => {
        const { logger, transport } = makeLogger()

        logger.info('a')
        logger.drain()

        logger.info('b')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(2)
    })

    // ── Caller throw ──

    test('entries are still processed when caller throws after logging', async () => {
        const { logger, transport } = makeLogger()

        try {
            logger.error('before throw')
            throw new Error('boom')
        } catch {
            // expected
        }

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)
        expect(lastEntry(transport).message).toBe('before throw')
    })

    // ── Disabled logger ──

    test('does not queue entries when disabled', async () => {
        const { logger, transport } = makeLogger()

        logger.disable()
        logger.info('should skip')

        await flushMicrotasks()

        expect(transport).not.toHaveBeenCalled()
    })

    test('queues entries after re-enabling', async () => {
        const { logger, transport } = makeLogger()

        logger.disable()
        logger.info('skip')
        logger.enable()
        logger.info('pass')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(1)
        expect(lastEntry(transport).message).toBe('pass')
    })

    // ── Filters and transformers ──

    test('filters are applied during drain, not during log call', async () => {
        const filter = mock(() => true)
        const { logger, transport } = makeLogger({ filters: [filter] })

        logger.info('test')

        expect(filter).not.toHaveBeenCalled()

        await flushMicrotasks()

        expect(filter).toHaveBeenCalledTimes(1)
        expect(transport).toHaveBeenCalledTimes(1)
    })

    test('filtered entries are dropped during drain', async () => {
        const filter = (entry: LogEntry) => entry.message !== 'drop'
        const { logger, transport } = makeLogger({ filters: [filter] })

        logger.info('keep')
        logger.info('drop')
        logger.info('keep too')

        await flushMicrotasks()

        expect(transport).toHaveBeenCalledTimes(2)

        const entries = allEntries(transport)

        expect(entries[0]!.message).toBe('keep')
        expect(entries[1]!.message).toBe('keep too')
    })

    test('transformers are applied during drain', async () => {
        const transformer = mock((entry: LogEntry) => ({ ...entry, message: `[transformed] ${entry.message}` }))
        const { logger, transport } = makeLogger({ transformers: [transformer] })

        logger.info('test')

        expect(transformer).not.toHaveBeenCalled()

        await flushMicrotasks()

        expect(transformer).toHaveBeenCalledTimes(1)
        expect(lastEntry(transport).message).toBe('[transformed] test')
    })

    // ── Queue scheduling ──

    test('schedules only one microtask per batch', () => {
        const { logger } = makeLogger()

        logger.info('a')
        logger.info('b')
        logger.info('c')

        const q = (logger as any).queue

        expect(q.scheduled).toBe(true)
        expect(q.entries).toHaveLength(3)
    })
})
