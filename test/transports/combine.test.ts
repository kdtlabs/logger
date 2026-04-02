import type { LogEntry, LogTransport } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { type CombineTransportError, createCombineTransport, excludeTransports, getExcludedTransports, LOGGER_EXCLUDE_TRANSPORTS } from '../../src/transports/combine'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

describe('LOGGER_EXCLUDE_TRANSPORTS', () => {
    test('is a global symbol', () => {
        expect(typeof LOGGER_EXCLUDE_TRANSPORTS).toBe('symbol')
        expect(LOGGER_EXCLUDE_TRANSPORTS).toBe(Symbol.for('logger.exclude-transports') as typeof LOGGER_EXCLUDE_TRANSPORTS)
    })
})

describe('excludeTransports', () => {
    test('returns metadata object with exclude list', () => {
        const result = excludeTransports(['console', 'file'])
        expect(result).toHaveProperty('metadata')
        expect((result as any).metadata[LOGGER_EXCLUDE_TRANSPORTS]).toEqual(['console', 'file'])
    })

    test('returns metadata object with empty list', () => {
        const result = excludeTransports([])
        expect((result as any).metadata[LOGGER_EXCLUDE_TRANSPORTS]).toEqual([])
    })
})

describe('getExcludedTransports', () => {
    test('returns undefined when no excludes set', () => {
        const entry = makeEntry()
        expect(getExcludedTransports(entry)).toBeUndefined()
    })

    test('returns exclude list from metadata', () => {
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: ['console', 'file'] } })

        expect(getExcludedTransports(entry)).toEqual(['console', 'file'])
    })

    test('returns empty array from metadata', () => {
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: [] } })

        expect(getExcludedTransports(entry)).toEqual([])
    })
})

describe('createCombineTransport', () => {
    // ── Basic dispatch ──
    test('calls all transports with entry and logger', () => {
        const t1 = mock()
        const t2 = mock()
        const transport = createCombineTransport({ t1, t2 })
        const entry = makeEntry()
        const logger = { id: 'test' }

        transport(entry, logger)

        expect(t1).toHaveBeenCalledTimes(1)
        expect(t1).toHaveBeenCalledWith(entry, logger)
        expect(t2).toHaveBeenCalledTimes(1)
        expect(t2).toHaveBeenCalledWith(entry, logger)
    })

    test('calls transports in insertion order', () => {
        const order: string[] = []
        const t1: LogTransport = () => order.push('t1')
        const t2: LogTransport = () => order.push('t2')
        const t3: LogTransport = () => order.push('t3')

        const transport = createCombineTransport({ t1, t2, t3 })

        transport(makeEntry(), null)

        expect(order).toEqual(['t1', 't2', 't3'])
    })

    test('handles empty transports record', () => {
        const transport = createCombineTransport({})
        expect(() => transport(makeEntry(), null)).not.toThrow()
    })

    test('handles single transport', () => {
        const t1 = mock()
        const transport = createCombineTransport({ t1 })

        transport(makeEntry(), null)

        expect(t1).toHaveBeenCalledTimes(1)
    })

    // ── Exclude mechanism ──
    test('skips excluded transports', () => {
        const t1 = mock()
        const t2 = mock()
        const t3 = mock()
        const transport = createCombineTransport({ t1, t2, t3 })
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: ['t2'] } })

        transport(entry, null)

        expect(t1).toHaveBeenCalledTimes(1)
        expect(t2).not.toHaveBeenCalled()
        expect(t3).toHaveBeenCalledTimes(1)
    })

    test('skips multiple excluded transports', () => {
        const t1 = mock()
        const t2 = mock()
        const t3 = mock()
        const transport = createCombineTransport({ t1, t2, t3 })
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: ['t1', 't3'] } })

        transport(entry, null)

        expect(t1).not.toHaveBeenCalled()
        expect(t2).toHaveBeenCalledTimes(1)
        expect(t3).not.toHaveBeenCalled()
    })

    test('runs all transports when exclude list is empty array', () => {
        const t1 = mock()
        const t2 = mock()
        const transport = createCombineTransport({ t1, t2 })
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: [] } })

        transport(entry, null)

        expect(t1).toHaveBeenCalledTimes(1)
        expect(t2).toHaveBeenCalledTimes(1)
    })

    test('ignores exclude names that do not match any transport', () => {
        const t1 = mock()
        const transport = createCombineTransport({ t1 })
        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: ['nonexistent'] } })

        transport(entry, null)

        expect(t1).toHaveBeenCalledTimes(1)
    })

    // ── Error handling — without onError ──
    test('throws AggregateError when transport fails and no onError', () => {
        const t1: LogTransport = () => {
            throw new Error('t1 failed')
        }

        const transport = createCombineTransport({ t1 })

        expect(() => transport(makeEntry(), null)).toThrow(AggregateError)
    })

    test('AggregateError contains normalized errors with transport name', () => {
        const t1: LogTransport = () => {
            throw new Error('t1 failed')
        }

        const transport = createCombineTransport({ t1 })

        try {
            transport(makeEntry(), null)
            expect.unreachable('should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(AggregateError)
            const aggError = error as AggregateError

            expect(aggError.message).toBe('Transport errors')
            expect(aggError.errors).toHaveLength(1)
            expect(aggError.errors[0]).toBeInstanceOf(Error)
            expect((aggError.errors[0]).message).toBe('t1 failed')
            expect((aggError.errors[0]).transport).toBe('t1')
        }
    })

    test('continues executing remaining transports after one fails without onError', () => {
        const order: string[] = []

        const t1: LogTransport = () => {
            order.push('t1')
            throw new Error('fail')
        }

        const t2: LogTransport = () => {
            order.push('t2')
        }

        const t3: LogTransport = () => {
            order.push('t3')
            throw new Error('fail')
        }

        const t4: LogTransport = () => {
            order.push('t4')
        }

        const transport = createCombineTransport({ t1, t2, t3, t4 })

        try {
            transport(makeEntry(), null)
        } catch {
            // expected
        }

        expect(order).toEqual(['t1', 't2', 't3', 't4'])
    })

    test('AggregateError collects all failures', () => {
        const t1: LogTransport = () => {
            throw new Error('first')
        }

        const t2 = mock()

        const t3: LogTransport = () => {
            throw new Error('second')
        }

        const transport = createCombineTransport({ t1, t2, t3 })

        try {
            transport(makeEntry(), null)
            expect.unreachable('should have thrown')
        } catch (error) {
            const aggError = error as AggregateError

            expect(aggError.errors).toHaveLength(2)
            expect((aggError.errors[0]).message).toBe('first')
            expect((aggError.errors[0]).transport).toBe('t1')
            expect((aggError.errors[1]).message).toBe('second')
            expect((aggError.errors[1]).transport).toBe('t3')
        }

        expect(t2).toHaveBeenCalledTimes(1)
    })

    test('normalizes non-Error thrown values in AggregateError', () => {
        const t1: LogTransport = () => {
            throw 'string error'
        }

        const transport = createCombineTransport({ t1 })

        try {
            transport(makeEntry(), null)
            expect.unreachable('should have thrown')
        } catch (error) {
            const aggError = error as AggregateError

            expect(aggError.errors[0]).toBeInstanceOf(Error)
        }
    })

    test('does not throw when all transports succeed', () => {
        const t1 = mock()
        const t2 = mock()
        const transport = createCombineTransport({ t1, t2 })

        expect(() => transport(makeEntry(), null)).not.toThrow()
    })

    // ── Error handling — with onError ──
    test('calls onError instead of throwing when provided', () => {
        const onError = mock()

        const t1: LogTransport = () => {
            throw new Error('fail')
        }

        const t2 = mock()

        const transport = createCombineTransport({ t1, t2 }, { onError })

        transport(makeEntry(), null)

        expect(onError).toHaveBeenCalledTimes(1)
        expect(t2).toHaveBeenCalledTimes(1)
    })

    test('onError receives all errors, entry, and logger', () => {
        const onError = mock()
        const logger = { id: 'test' }

        const t1: LogTransport = () => {
            throw new Error('first')
        }

        const t2: LogTransport = () => {
            throw new Error('second')
        }

        const transport = createCombineTransport({ t1, t2 }, { onError })
        const entry = makeEntry()

        transport(entry, logger)

        expect(onError).toHaveBeenCalledTimes(1)

        const [errors, receivedEntry, receivedLogger] = onError.mock.calls[0]! as [CombineTransportError[], LogEntry, unknown]

        expect(errors).toHaveLength(2)
        expect(errors[0]!.transport).toBe('t1')
        expect(errors[0]!.error).toBeInstanceOf(Error)
        expect(errors[1]!.transport).toBe('t2')
        expect(receivedEntry).toBe(entry)
        expect(receivedLogger).toBe(logger)
    })

    test('onError is not called when no errors occur', () => {
        const onError = mock()
        const t1 = mock()
        const transport = createCombineTransport({ t1 }, { onError })

        transport(makeEntry(), null)

        expect(onError).not.toHaveBeenCalled()
    })

    // ── Error exclusion — failed transport excluded within same call ──
    test('adds failed transport name to exclude list in metadata', () => {
        const t1: LogTransport = () => {
            throw new Error('fail')
        }

        const t2 = mock()
        const transport = createCombineTransport({ t1, t2 }, { onError: () => {} })
        const entry = makeEntry()

        transport(entry, null)

        const excludes = getExcludedTransports(entry)

        expect(excludes).toContain('t1')
    })

    test('failed transport is skipped by subsequent transports reading same entry', () => {
        const callCounts = { inner: 0, outer: 0 }

        const failing: LogTransport = () => {
            callCounts.inner++
            throw new Error('fail')
        }

        const passing: LogTransport = () => {
            callCounts.outer++
        }

        const inner = createCombineTransport({ failing, passing }, { onError: () => {} })
        const entry = makeEntry()

        inner(entry, null)

        expect(callCounts.inner).toBe(1)
        expect(callCounts.outer).toBe(1)

        const excludes = getExcludedTransports(entry)

        expect(excludes).toContain('failing')
    })

    test('accumulates multiple failed transport names in exclude list', () => {
        const t1: LogTransport = () => {
            throw new Error('fail1')
        }

        const t2: LogTransport = () => {
            throw new Error('fail2')
        }

        const t3 = mock()

        const transport = createCombineTransport({ t1, t2, t3 }, { onError: () => {} })
        const entry = makeEntry()

        transport(entry, null)

        const excludes = getExcludedTransports(entry)

        expect(excludes).toEqual(['t1', 't2'])
        expect(t3).toHaveBeenCalledTimes(1)
    })

    test('appends to existing exclude list in metadata', () => {
        const t1: LogTransport = () => {
            throw new Error('fail')
        }

        const t2 = mock()
        const transport = createCombineTransport({ t1, t2 }, { onError: () => {} })

        const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string
        const entry = makeEntry({ metadata: { [key]: ['preexisting'] } })

        transport(entry, null)

        const excludes = getExcludedTransports(entry)

        expect(excludes).toEqual(['preexisting', 't1'])
    })

    // ── Immutable transports record ──
    test('captures transports at creation time', () => {
        const t1 = mock()
        const record: Record<string, LogTransport> = { t1 }
        const transport = createCombineTransport(record)

        record.t2 = mock()

        transport(makeEntry(), null)

        expect(t1).toHaveBeenCalledTimes(1)
        expect(record.t2).not.toHaveBeenCalled()
    })

    // ── Default options ──
    test('works without options argument', () => {
        const t1 = mock()
        const transport = createCombineTransport({ t1 })

        transport(makeEntry(), null)

        expect(t1).toHaveBeenCalledTimes(1)
    })
})
