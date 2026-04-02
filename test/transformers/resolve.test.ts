import type { LogEntry } from '../../src/types'
import { describe, expect, test } from 'bun:test'
import { createResolveTransformer, lazy, LOGGER_LAZY_DATA, LOGGER_METADATA, metadata } from '../../src/transformers/resolve'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, message: 'test', data: [], metadata: {}, ...overrides,
})

describe('createResolveTransformer', () => {
    // ── Basic pass-through ──
    test('returns entry unchanged when data is empty', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry()

        const result = transformer(entry)

        expect(result.data).toEqual([])
        expect(result.message).toBe('test')
    })

    test('passes through plain data', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry({ data: [1, 'two', { three: 3 }] })

        const result = transformer(entry)

        expect(result.data).toEqual([1, 'two', { three: 3 }])
    })

    // ── Lazy data ──
    test('resolves lazy data', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry({ data: [lazy(() => 'resolved'), 'plain'] })

        const result = transformer(entry)

        expect(result.data).toEqual(['resolved', 'plain'])
    })

    test('lazy callback is called exactly once', () => {
        let callCount = 0
        const transformer = createResolveTransformer()

        const entry = makeEntry({
            data: [lazy(() => {
                callCount++

                return 'val'
            })],
        })

        transformer(entry)

        expect(callCount).toBe(1)
    })

    // ── Metadata extraction ──
    test('extracts metadata from data', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry({ data: [metadata({ requestId: '123' }), 'plain'] })

        const result = transformer(entry)

        expect(result.data).toEqual(['plain'])
        expect(result.metadata).toHaveProperty('requestId', '123')
    })

    test('merges multiple metadata objects and may omit data', () => {
        const transformer = createResolveTransformer()

        const entry = makeEntry({
            data: [metadata({ a: 1 }), metadata({ b: 2 })],
        })

        const result = transformer(entry)

        expect(result.data).toBeUndefined()
        expect(result.metadata).toHaveProperty('a', 1)
        expect(result.metadata).toHaveProperty('b', 2)
    })

    test('lazy data that returns metadata may omit data', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry({ data: [lazy(() => metadata({ lazy: true }))] })

        const result = transformer(entry)

        expect(result.data).toBeUndefined()
        expect(result.metadata).toHaveProperty('lazy', true)
    })

    // ── Error extraction ──
    test('moves errors to metadata.errors by default', () => {
        const transformer = createResolveTransformer()
        const err = new Error('boom')
        const entry = makeEntry({ data: [err, 'plain'] })

        const result = transformer(entry)

        expect(result.data).toEqual(['plain'])
        expect(result.metadata.errors).toEqual([err])
    })

    test('collects multiple errors and may omit data', () => {
        const transformer = createResolveTransformer()
        const err1 = new Error('one')
        const err2 = new Error('two')
        const entry = makeEntry({ data: [err1, err2] })

        const result = transformer(entry)

        expect(result.data).toBeUndefined()
        expect(result.metadata.errors).toEqual([err1, err2])
    })

    test('keeps errors in data when errors option is false', () => {
        const transformer = createResolveTransformer({ errors: false })
        const err = new Error('boom')
        const entry = makeEntry({ data: [err, 'plain'] })

        const result = transformer(entry)

        expect(result.data).toEqual([err, 'plain'])
        expect(result.metadata).not.toHaveProperty('errors')
    })

    test('lazy data that resolves to error may omit data', () => {
        const transformer = createResolveTransformer()
        const err = new Error('lazy-error')
        const entry = makeEntry({ data: [lazy(() => err)] })

        const result = transformer(entry)

        expect(result.data).toBeUndefined()
        expect(result.metadata.errors).toEqual([err])
    })

    // ── Immutability ──
    test('does not mutate original data array', () => {
        const transformer = createResolveTransformer()
        const originalData = [1, 2, 3]
        const entry = makeEntry({ data: originalData })

        transformer(entry)

        expect(originalData).toEqual([1, 2, 3])
    })

    test('no errors key when no errors found', () => {
        const transformer = createResolveTransformer()
        const entry = makeEntry({ data: ['plain'] })

        const result = transformer(entry)

        expect(result.metadata).not.toHaveProperty('errors')
    })
})

describe('lazy', () => {
    test('creates object with LOGGER_LAZY_DATA symbol', () => {
        const obj = lazy(() => 42)
        expect(LOGGER_LAZY_DATA in obj).toBe(true)
    })
})

describe('metadata', () => {
    test('creates object with LOGGER_METADATA symbol', () => {
        const obj = metadata({ key: 'val' })
        expect(LOGGER_METADATA in obj).toBe(true)
    })
})
