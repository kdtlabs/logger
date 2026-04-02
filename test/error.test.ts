import type { LogEntry } from '../src/types'
import { describe, expect, test } from 'bun:test'
import { LoggerError } from '../src/error'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: 30, data: [], metadata: {}, ...overrides,
})

describe('LoggerError', () => {
    test('extends Error', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'test error')

        expect(error).toBeInstanceOf(Error)
    })

    test('stores the log entry', () => {
        const entry = makeEntry({ message: 'hello' })
        const error = new LoggerError(entry, 'test error')

        expect(error.entry).toBe(entry)
    })

    test('sets the message', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'something went wrong')

        expect(error.message).toBe('something went wrong')
    })

    test('accepts cause option', () => {
        const entry = makeEntry()
        const cause = new Error('root cause')
        const error = new LoggerError(entry, 'wrapper', { cause })

        expect(error.cause).toBe(cause)
    })

    test('accepts code option', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'coded error', { code: 'ERR_TEST' })

        expect(error.code).toBe('ERR_TEST')
    })

    test('works without options', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'no options')

        expect(error.message).toBe('no options')
        expect(error.entry).toBe(entry)
    })

    test('has a stack trace', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'traced')

        expect(error.stack).toBeDefined()
        expect(error.stack).toContain('traced')
    })

    test('entry is readonly', () => {
        const entry = makeEntry()
        const error = new LoggerError(entry, 'test')

        expect(error.entry).toBe(entry)
    })
})
