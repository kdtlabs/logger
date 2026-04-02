import type { LogEntry, LogFilter, LogTransport } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { createFilteredTransport } from '../../src/transports/filtered'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, metadata: {}, ...overrides,
})

describe('createFilteredTransport', () => {
    // ── Single filter ──
    test('calls transport when single filter passes', () => {
        const inner = mock()
        const filter: LogFilter = () => true
        const transport = createFilteredTransport(inner, filter)
        const entry = makeEntry()
        const logger = { id: 'test' }

        transport(entry, logger)

        expect(inner).toHaveBeenCalledTimes(1)
        expect(inner).toHaveBeenCalledWith(entry, logger)
    })

    test('skips transport when single filter rejects', () => {
        const inner = mock()
        const filter: LogFilter = () => false
        const transport = createFilteredTransport(inner, filter)

        transport(makeEntry(), null)

        expect(inner).not.toHaveBeenCalled()
    })

    // ── Array of filters ──
    test('calls transport when all filters pass', () => {
        const inner = mock()
        const f1: LogFilter = () => true
        const f2: LogFilter = () => true
        const transport = createFilteredTransport(inner, [f1, f2])

        transport(makeEntry(), null)

        expect(inner).toHaveBeenCalledTimes(1)
    })

    test('skips transport when any filter rejects', () => {
        const inner = mock()
        const f1: LogFilter = () => true
        const f2: LogFilter = () => false
        const f3: LogFilter = () => true
        const transport = createFilteredTransport(inner, [f1, f2, f3])

        transport(makeEntry(), null)

        expect(inner).not.toHaveBeenCalled()
    })

    test('short-circuits on first rejecting filter', () => {
        const inner = mock()
        const f1: LogFilter = () => false
        const f2 = mock(() => true)
        const transport = createFilteredTransport(inner, [f1, f2])

        transport(makeEntry(), null)

        expect(f2).not.toHaveBeenCalled()
        expect(inner).not.toHaveBeenCalled()
    })

    // ── Empty filter list ──
    test('calls transport when filter list is empty', () => {
        const inner = mock()
        const transport = createFilteredTransport(inner, [])

        transport(makeEntry(), null)

        expect(inner).toHaveBeenCalledTimes(1)
    })

    // ── Passes entry and logger to filters ──
    test('passes entry and logger to each filter', () => {
        const inner = mock()
        const filter = mock(() => true)
        const transport = createFilteredTransport(inner, filter)
        const entry = makeEntry()
        const logger = { id: 'test' }

        transport(entry, logger)

        expect(filter).toHaveBeenCalledWith(entry, logger)
    })

    // ── Multiple calls ──
    test('evaluates filters on each call independently', () => {
        const inner = mock()
        let callCount = 0

        const filter: LogFilter = () => {
            callCount++

            return callCount % 2 === 1
        }

        const transport = createFilteredTransport(inner, filter)

        transport(makeEntry(), null)
        transport(makeEntry(), null)
        transport(makeEntry(), null)

        expect(inner).toHaveBeenCalledTimes(2)
    })

    // ── Transport error propagation ──
    test('propagates transport errors', () => {
        const inner: LogTransport = () => {
            throw new Error('transport failed')
        }

        const filter: LogFilter = () => true
        const transport = createFilteredTransport(inner, filter)

        expect(() => transport(makeEntry(), null)).toThrow('transport failed')
    })
})
