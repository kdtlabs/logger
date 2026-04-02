import type { LogEntry } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { LOGGER_TIMER } from '../../src/formatters'
import { createConsoleTransport, createDefaultConsoleFormatter } from '../../src/transports/console'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

const makeStream = () => ({ write: mock() }) as unknown as NodeJS.WritableStream & { write: ReturnType<typeof mock> }

describe('createConsoleTransport', () => {
    test('writes JSON to stdout by default', () => {
        const originalWrite = process.stdout.write
        const writeMock = mock((_chunk: any) => true)
        process.stdout.write = writeMock as any

        try {
            const transport = createConsoleTransport()
            const entry = makeEntry({ message: 'hello' })

            transport(entry, null)

            expect(writeMock).toHaveBeenCalledTimes(1)
            const output = writeMock.mock.calls.at(-1)![0] as string
            expect(output.endsWith('\n')).toBe(true)
            expect(JSON.parse(output.trim())).toMatchObject({ message: 'hello' })
        } finally {
            process.stdout.write = originalWrite
        }
    })

    test('uses custom formatter', () => {
        const stream = makeStream()
        const formatter = (e: LogEntry) => `[${e.level}] ${e.message}`
        const transport = createConsoleTransport({ formatter, stream })
        const entry = makeEntry({ level: 30, message: 'hello' })

        transport(entry, null)

        expect(stream.write).toHaveBeenCalledWith('[30] hello\n')
    })

    test('uses custom stream', () => {
        const stream = makeStream()
        const transport = createConsoleTransport({ stream })
        const entry = makeEntry()

        transport(entry, null)

        expect(stream.write).toHaveBeenCalledTimes(1)
    })

    test('appends newline to output', () => {
        const stream = makeStream()
        const transport = createConsoleTransport({ formatter: () => 'test', stream })

        transport(makeEntry(), null)

        expect(stream.write).toHaveBeenCalledWith('test\n')
    })
})

describe('createDefaultConsoleFormatter', () => {
    test('serializes entry as JSON', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ message: 'hello' })
        const result = JSON.parse(formatter(entry))

        expect(result.message).toBe('hello')
        expect(result.level).toBe(30)
    })

    test('serializes bigint as string with n suffix', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: [42n] })
        const result = JSON.parse(formatter(entry))

        expect(result.data[0]).toBe('42n')
    })

    test('serializes LOGGER_TIMER in metadata', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ metadata: { [LOGGER_TIMER]: 123_456n, other: 'value' } })
        const result = JSON.parse(formatter(entry))

        expect(result.metadata.timer).toBe('123456n')
        expect(result.metadata.other).toBe('value')
    })

    test('passes through objects and arrays', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: [{ a: 1 }, [1, 2, 3]] })
        const result = JSON.parse(formatter(entry))

        expect(result.data[0]).toEqual({ a: 1 })
        expect(result.data[1]).toEqual([1, 2, 3])
    })

    test('passes through jsonable primitives', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: ['hello', 42, true, null] })
        const result = JSON.parse(formatter(entry))

        expect(result.data).toEqual(['hello', 42, true, null])
    })

    test('serializes non-jsonable values via serializer', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: [Symbol('test')] })
        const result = JSON.parse(formatter(entry))

        expect(result.data[0]).toHaveProperty('__serialized__', true)
        expect(result.data[0]).toHaveProperty('type', 'symbol')
    })

    test('metadata without LOGGER_TIMER is passed through normally', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ metadata: { service: 'api', version: 2 } })
        const result = JSON.parse(formatter(entry))

        expect(result.metadata).toEqual({ service: 'api', version: 2 })
        expect(result.metadata).not.toHaveProperty('timer')
    })
})
