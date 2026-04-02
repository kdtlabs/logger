import type { LogEntry } from '../../src/types'
import { describe, expect, mock, test } from 'bun:test'
import { createConsoleTransport, createDefaultConsoleFormatter } from '../../src/transports/console'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

const makeStream = () => ({ write: mock() }) as unknown as NodeJS.WritableStream & { write: ReturnType<typeof mock> }

describe('createDefaultConsoleFormatter', () => {
    test('serializes entry as JSON', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ message: 'hello' })
        const result = formatter(entry)
        const parsed = JSON.parse(result)

        expect(parsed.message).toBe('hello')
        expect(parsed.level).toBe(30)
    })

    test('converts bigint values to string with n suffix', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ metadata: { duration: 123_456_789n } })
        const result = formatter(entry)

        expect(result).toContain('"123456789n"')
    })

    test('handles nested bigint values', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: [{ nested: { big: 42n } }] })
        const result = formatter(entry)

        expect(result).toContain('"42n"')
    })

    test('handles entry with no data', () => {
        const formatter = createDefaultConsoleFormatter()
        const entry = makeEntry({ data: undefined, message: 'msg' })
        const result = formatter(entry)
        const parsed = JSON.parse(result)

        expect(parsed.message).toBe('msg')
    })
})

describe('createConsoleTransport', () => {
    test('calls onError when formatter throws', () => {
        const stream = makeStream()
        const onError = mock()
        const error = new Error('formatter failed')

        const transport = createConsoleTransport({
            formatter: () => {
                throw error
            },
            onError,
            stream,
        })

        transport(makeEntry(), null)

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError).toHaveBeenCalledWith(error)
        expect(stream.write).not.toHaveBeenCalled()
    })

    test('calls onError when stream.write throws', () => {
        const onError = mock()
        const error = new Error('write failed')

        const stream = {
            write: () => {
                throw error
            },
        } as unknown as NodeJS.WritableStream

        const transport = createConsoleTransport({ onError, stream })

        transport(makeEntry(), null)

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onError).toHaveBeenCalledWith(error)
    })

    test('swallows errors silently when no onError provided and stream.write throws', () => {
        const stream = {
            write: () => {
                throw new Error('write failed')
            },
        } as unknown as NodeJS.WritableStream

        const transport = createConsoleTransport({ stream })

        expect(() => transport(makeEntry(), null)).not.toThrow()
    })

    test('onError receives non-Error thrown values', () => {
        const onError = mock()

        const stream = {
            write: () => {
                throw 'string error'
            },
        } as unknown as NodeJS.WritableStream

        const transport = createConsoleTransport({ onError, stream })

        transport(makeEntry(), null)

        expect(onError).toHaveBeenCalledWith('string error')
    })
})
