import type { AsyncLogTransport, AsyncTransportError } from '../../src/transports/async'
import type { LogEntry } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { createAsyncTransport } from '../../src/transports/async'

/* eslint-disable @typescript-eslint/require-await -- AsyncLogTransport requires async signature */

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const createConcurrencyTransport = (state: { maxConcurrent: number, running: number }): AsyncLogTransport => async () => {
    state.running++
    state.maxConcurrent = Math.max(state.maxConcurrent, state.running)
    await sleep(5)
    state.running--
}

describe('createAsyncTransport', () => {
    // ── Empty transports ──
    test('returns no-op transport and resolved flush for empty transports', async () => {
        const { transport, flush } = createAsyncTransport({})

        transport(makeEntry(), null)
        await flush()
    })

    // ── Basic dispatch ──
    test('calls all transports with entry and logger', async () => {
        const calls: Array<{ entry: LogEntry, logger: unknown }> = []

        const t1: AsyncLogTransport = async (entry, logger) => {
            calls.push({ entry, logger })
        }

        const t2: AsyncLogTransport = async (entry, logger) => {
            calls.push({ entry, logger })
        }

        const { transport, flush } = createAsyncTransport({ t1, t2 })
        const entry = makeEntry()
        const logger = { id: 'test' }

        transport(entry, logger)
        await flush()

        expect(calls).toHaveLength(2)
        expect(calls[0]!.entry).toBe(entry)
        expect(calls[0]!.logger).toBe(logger)
        expect(calls[1]!.entry).toBe(entry)
        expect(calls[1]!.logger).toBe(logger)
    })

    test('transport function is sync — returns void', () => {
        const t1: AsyncLogTransport = async () => {}
        const { transport } = createAsyncTransport({ t1 })
        const result = transport(makeEntry(), null)

        expect(result).toBeUndefined()
    })

    // ── Serial queue ordering ──
    test('processes entries in insertion order (FIFO)', async () => {
        const order: number[] = []

        const t1: AsyncLogTransport = async (entry) => {
            await sleep(1)
            order.push(entry.level)
        }

        const { transport, flush } = createAsyncTransport({ t1 })

        transport(makeEntry({ level: 1 }), null)
        transport(makeEntry({ level: 2 }), null)
        transport(makeEntry({ level: 3 }), null)

        await flush()

        expect(order).toEqual([1, 2, 3])
    })

    test('does not start next entry until current entry transports settle', async () => {
        const events: string[] = []

        const t1: AsyncLogTransport = async (entry) => {
            events.push(`start-${entry.level}`)
            await sleep(10)
            events.push(`end-${entry.level}`)
        }

        const { transport, flush } = createAsyncTransport({ t1 })

        transport(makeEntry({ level: 1 }), null)
        transport(makeEntry({ level: 2 }), null)

        await flush()

        expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
    })

    // ── Parallel transports per entry ──
    test('runs multiple transports in parallel per entry', async () => {
        const events: string[] = []

        const t1: AsyncLogTransport = async () => {
            events.push('t1-start')
            await sleep(10)
            events.push('t1-end')
        }

        const t2: AsyncLogTransport = async () => {
            events.push('t2-start')
            await sleep(10)
            events.push('t2-end')
        }

        const { transport, flush } = createAsyncTransport({ t1, t2 })

        transport(makeEntry(), null)
        await flush()

        expect(events[0]).toBe('t1-start')
        expect(events[1]).toBe('t2-start')
    })

    // ── Concurrency limit ──
    test('limits parallel transports per entry by concurrency', async () => {
        const state = { running: 0, maxConcurrent: 0 }

        const { transport, flush } = createAsyncTransport({
            t1: createConcurrencyTransport(state),
            t2: createConcurrencyTransport(state),
            t3: createConcurrencyTransport(state),
            t4: createConcurrencyTransport(state),
            t5: createConcurrencyTransport(state),
        }, { concurrency: 2 })

        transport(makeEntry(), null)
        await flush()

        expect(state.maxConcurrent).toBe(2)
    })

    test('concurrency defaults to Infinity — all transports run at once', async () => {
        const state = { running: 0, maxConcurrent: 0 }

        const { transport, flush } = createAsyncTransport({
            t1: createConcurrencyTransport(state),
            t2: createConcurrencyTransport(state),
            t3: createConcurrencyTransport(state),
            t4: createConcurrencyTransport(state),
        })

        transport(makeEntry(), null)
        await flush()

        expect(state.maxConcurrent).toBe(4)
    })

    test('concurrency 1 runs transports sequentially', async () => {
        const order: string[] = []

        const t1: AsyncLogTransport = async () => {
            order.push('t1-start')
            await sleep(5)
            order.push('t1-end')
        }

        const t2: AsyncLogTransport = async () => {
            order.push('t2-start')
            await sleep(5)
            order.push('t2-end')
        }

        const { transport, flush } = createAsyncTransport({ t1, t2 }, { concurrency: 1 })

        transport(makeEntry(), null)
        await flush()

        expect(order).toEqual(['t1-start', 't1-end', 't2-start', 't2-end'])
    })

    // ── Timeout ──
    test('times out individual transport calls', async () => {
        const errors: AsyncTransportError[][] = []

        const t1: AsyncLogTransport = async () => {
            await sleep(1000)
        }

        const t2: AsyncLogTransport = async () => {}

        const { transport, flush } = createAsyncTransport({ t1, t2 }, {
            timeout: 10,
            onError: (errs) => {
                errors.push(errs)
            },
        })

        transport(makeEntry(), null)
        await flush()

        expect(errors).toHaveLength(1)
        expect(errors[0]!).toHaveLength(1)
        expect(errors[0]![0]!.transport).toBe('t1')
    })

    // ── Error handling ──
    test('calls onError when transports fail', async () => {
        const onError = mock()

        const t1: AsyncLogTransport = async () => {
            throw new Error('t1 failed')
        }

        const t2: AsyncLogTransport = async () => {}

        const { transport, flush } = createAsyncTransport({ t1, t2 }, { onError })
        const entry = makeEntry()
        const logger = { id: 'test' }

        transport(entry, logger)
        await flush()

        expect(onError).toHaveBeenCalledTimes(1)

        const [errors, receivedEntry, receivedLogger] = onError.mock.calls[0]! as [AsyncTransportError[], LogEntry, unknown]

        expect(errors).toHaveLength(1)
        expect(errors[0]!.transport).toBe('t1')
        expect(errors[0]!.error).toBeInstanceOf(Error)
        expect((errors[0]!.error as Error).message).toBe('t1 failed')
        expect(receivedEntry).toBe(entry)
        expect(receivedLogger).toBe(logger)
    })

    test('collects multiple transport errors', async () => {
        const onError = mock()

        const t1: AsyncLogTransport = async () => {
            throw new Error('first')
        }

        const t2: AsyncLogTransport = async () => {}

        const t3: AsyncLogTransport = async () => {
            throw new Error('second')
        }

        const { transport, flush } = createAsyncTransport({ t1, t2, t3 }, { onError })

        transport(makeEntry(), null)
        await flush()

        const [errors] = onError.mock.calls[0]! as [AsyncTransportError[]]

        expect(errors).toHaveLength(2)
        expect(errors[0]!.transport).toBe('t1')
        expect(errors[1]!.transport).toBe('t3')
    })

    test('silently skips errors when onError is not provided', async () => {
        const t1: AsyncLogTransport = async () => {
            throw new Error('fail')
        }

        const t2: AsyncLogTransport = async () => {}

        const { transport, flush } = createAsyncTransport({ t1, t2 })

        transport(makeEntry(), null)
        await flush()
    })

    test('onError is not called when no errors occur', async () => {
        const onError = mock()
        const t1: AsyncLogTransport = async () => {}

        const { transport, flush } = createAsyncTransport({ t1 }, { onError })

        transport(makeEntry(), null)
        await flush()

        expect(onError).not.toHaveBeenCalled()
    })

    test('swallows errors thrown by onError itself', async () => {
        const t1: AsyncLogTransport = async () => {
            throw new Error('transport fail')
        }

        const { transport, flush } = createAsyncTransport({ t1 }, {
            onError: () => {
                throw new Error('onError fail')
            },
        })

        transport(makeEntry(), null)
        await flush()
    })

    // ── Error isolation between entries ──
    test('transport failing for entry N does not affect entry N+1', async () => {
        let callCount = 0

        const t1: AsyncLogTransport = async (entry) => {
            callCount++

            if (entry.level === 1) {
                throw new Error('fail on entry 1')
            }
        }

        const { transport, flush } = createAsyncTransport({ t1 }, { onError: () => {} })

        transport(makeEntry({ level: 1 }), null)
        transport(makeEntry({ level: 2 }), null)

        await flush()

        expect(callCount).toBe(2)
    })

    // ── Exclude failed transport within entry ──
    test('excludes failed transport from current entry, remaining continue', async () => {
        const completed: string[] = []

        const t1: AsyncLogTransport = async () => {
            throw new Error('fail')
        }

        const t2: AsyncLogTransport = async () => {
            await sleep(5)
            completed.push('t2')
        }

        const t3: AsyncLogTransport = async () => {
            await sleep(5)
            completed.push('t3')
        }

        const { transport, flush } = createAsyncTransport({ t1, t2, t3 }, { onError: () => {} })

        transport(makeEntry(), null)
        await flush()

        expect(completed).toEqual(['t2', 't3'])
    })

    // ── Flush ──
    test('flush resolves when queue is empty', async () => {
        const t1: AsyncLogTransport = async () => {
            await sleep(5)
        }

        const { transport, flush } = createAsyncTransport({ t1 })

        transport(makeEntry(), null)
        await flush()
    })

    test('flush resolves immediately when no entries queued', async () => {
        const t1: AsyncLogTransport = async () => {}
        const { flush } = createAsyncTransport({ t1 })

        await flush()
    })

    test('flush works across multiple batches of entries', async () => {
        const processed: number[] = []

        const t1: AsyncLogTransport = async (entry) => {
            processed.push(entry.level)
        }

        const { transport, flush } = createAsyncTransport({ t1 })

        transport(makeEntry({ level: 1 }), null)
        transport(makeEntry({ level: 2 }), null)

        await flush()
        expect(processed).toEqual([1, 2])

        transport(makeEntry({ level: 3 }), null)

        await flush()
        expect(processed).toEqual([1, 2, 3])
    })

    test('queue auto-processes without calling flush', async () => {
        const processed: number[] = []

        const t1: AsyncLogTransport = async (entry) => {
            processed.push(entry.level)
        }

        const { transport } = createAsyncTransport({ t1 })

        transport(makeEntry({ level: 1 }), null)

        await sleep(50)

        expect(processed).toEqual([1])
    })

    // ── Captures transports at creation time ──
    test('captures transports at creation time', async () => {
        const t1 = mock(async () => {})
        const record: Record<string, AsyncLogTransport> = { t1 }

        const { transport, flush } = createAsyncTransport(record)

        const t2 = mock(async () => {})
        record.t2 = t2

        transport(makeEntry(), null)
        await flush()

        expect(t1).toHaveBeenCalledTimes(1)
        expect(t2).not.toHaveBeenCalled()
    })

    // ── Max queue size ──
    test('calls onQueueFull when queue exceeds maxQueueSize', async () => {
        const onQueueFull = mock()

        const t1: AsyncLogTransport = async () => {
            await sleep(50)
        }

        const { transport, flush } = createAsyncTransport({ t1 }, { maxQueueSize: 2, onQueueFull })

        // First entry starts processing immediately, leaves queue
        transport(makeEntry({ level: 1 }), null)

        // These two fill the queue
        transport(makeEntry({ level: 2 }), null)
        transport(makeEntry({ level: 3 }), null)

        // This one should trigger onQueueFull
        const overflowEntry = makeEntry({ level: 4 })
        const logger = { id: 'test' }

        transport(overflowEntry, logger)

        expect(onQueueFull).toHaveBeenCalledTimes(1)
        expect(onQueueFull).toHaveBeenCalledWith(overflowEntry, logger)

        await flush()
    })

    test('silently drops entry when queue full and no onQueueFull', async () => {
        const calls: number[] = []

        const t1: AsyncLogTransport = async (entry) => {
            await sleep(20)
            calls.push(entry.level)
        }

        const { transport, flush } = createAsyncTransport({ t1 }, { maxQueueSize: 2 })

        // Entry 1 starts processing immediately
        transport(makeEntry({ level: 1 }), null)

        // These two fill the queue
        transport(makeEntry({ level: 2 }), null)
        transport(makeEntry({ level: 3 }), null)

        // This one is silently dropped
        transport(makeEntry({ level: 4 }), null)

        await flush()

        expect(calls).toEqual([1, 2, 3])
    })

    test('maxQueueSize defaults to 1000', () => {
        let unblock: () => void

        const t1: AsyncLogTransport = async () => new Promise<void>((resolve) => {
            unblock = resolve
        })

        const onQueueFull = mock()

        const { transport } = createAsyncTransport({ t1 }, { onQueueFull })

        // First entry starts processing (leaves queue), entries 2..1001 fill the queue to 1000
        for (let i = 0; i <= 1000; i++) {
            transport(makeEntry({ level: i }), null)
        }

        // Queue has exactly 1000 entries — should not trigger
        expect(onQueueFull).not.toHaveBeenCalled()

        // Entry 1002 exceeds the limit
        transport(makeEntry({ level: 1001 }), null)

        expect(onQueueFull).toHaveBeenCalledTimes(1)

        // Unblock to avoid dangling promise
        unblock!()
    })

    // ── Works without options ──
    test('works without options argument', async () => {
        const t1 = mock(async () => {})
        const { transport, flush } = createAsyncTransport({ t1 })

        transport(makeEntry(), null)
        await flush()

        expect(t1).toHaveBeenCalledTimes(1)
    })
})
/* eslint-enable @typescript-eslint/require-await */
