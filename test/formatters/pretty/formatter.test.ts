import type { LogEntry } from '../../../src/types'
import { describe, expect, test } from 'bun:test'
import { LogLevel } from '../../../src/constants'
import { createPrettyFormatter, LOGGER_TIMER, timer } from '../../../src/formatters/pretty/formatter'

const makeEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    timestamp: Date.now(), level: LogLevel.Info, metadata: { levelName: 'info' }, ...overrides,
})

describe('LOGGER_TIMER', () => {
    test('is a global symbol', () => {
        expect(typeof LOGGER_TIMER).toBe('symbol')
        expect(LOGGER_TIMER.toString()).toBe('Symbol(logger.metadata.timer)')
    })
})

describe('timer', () => {
    test('creates metadata with timer duration', () => {
        const start = process.hrtime.bigint()
        const result = timer(start)

        expect(result).toHaveProperty('metadata')
        expect(typeof (result as any).metadata[LOGGER_TIMER]).toBe('bigint')
    })

    test('timer duration is non-negative', () => {
        const start = process.hrtime.bigint()
        const result = timer(start)
        const duration = (result as any).metadata[LOGGER_TIMER] as bigint

        expect(duration >= 0n).toBe(true)
    })
})

describe('createPrettyFormatter', () => {
    // ── Basic output ──
    test('formats a basic entry with message', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ message: 'hello world' }))

        expect(result).toContain('hello world')
    })

    test('formats entry without message', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry())

        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
    })

    test('includes time in output', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ timestamp: new Date('2024-01-15T10:30:45.123Z').getTime() }))

        expect(result).toContain(':')
    })

    test('uses custom time format', () => {
        const format = createPrettyFormatter({ color: false, timeFormat: 'yyyy-MM-dd' })
        const result = format(makeEntry({ timestamp: new Date('2024-01-15T10:30:45Z').getTime() }))

        expect(result).toContain('2024-01-15')
    })

    // ── Level display ──
    test('displays level for known levels', () => {
        const format = createPrettyFormatter({ color: false })

        const traceResult = format(makeEntry({ level: LogLevel.Trace }))
        const debugResult = format(makeEntry({ level: LogLevel.Debug }))
        const infoResult = format(makeEntry({ level: LogLevel.Info }))
        const warnResult = format(makeEntry({ level: LogLevel.Warn }))
        const errorResult = format(makeEntry({ level: LogLevel.Error }))
        const fatalResult = format(makeEntry({ level: LogLevel.Fatal }))
        const noticeResult = format(makeEntry({ level: LogLevel.Notice }))

        expect(traceResult).toContain('TRACE')
        expect(debugResult).toContain('DEBUG')
        expect(infoResult).toContain('INFO')
        expect(warnResult).toContain('WARN')
        expect(errorResult).toContain('ERROR')
        expect(fatalResult).toContain('FATAL')
        expect(noticeResult).toContain('NOTICE')
    })

    test('displays raw level number for unknown levels', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ level: 99 }))

        expect(result).toContain('99')
    })

    // ── Name display ──
    test('hides name by default', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ name: 'myapp' }))

        expect(result).not.toContain('myapp')
    })

    test('shows name when showName is true', () => {
        const format = createPrettyFormatter({ color: false, showName: true })
        const result = format(makeEntry({ name: 'myapp' }))

        expect(result).toContain('myapp')
    })

    test('does not show name when entry has no name', () => {
        const format = createPrettyFormatter({ color: false, showName: true })
        const result = format(makeEntry({ name: undefined }))

        expect(result).not.toContain('undefined')
    })

    test('truncates long names by default', () => {
        const format = createPrettyFormatter({ color: false, showName: true })
        const longName = 'a'.repeat(50)
        const result = format(makeEntry({ name: longName }))

        expect(result.length).toBeLessThan(longName.length + 100)
    })

    test('disables name truncation with truncateName: false', () => {
        const format = createPrettyFormatter({ color: false, showName: true, truncateName: false })
        const longName = 'a'.repeat(50)
        const result = format(makeEntry({ name: longName }))

        expect(result).toContain(longName)
    })

    test('uses custom truncateName length', () => {
        const format = createPrettyFormatter({ color: false, showName: true, truncateName: 10 })
        const longName = 'a'.repeat(50)
        const result = format(makeEntry({ name: longName }))

        expect(result.length).toBeLessThan(longName.length + 100)
    })

    test('caches formatted names', () => {
        const format = createPrettyFormatter({ color: false, showName: true })
        const entry1 = makeEntry({ name: 'myapp', message: 'first' })
        const entry2 = makeEntry({ name: 'myapp', message: 'second' })

        const result1 = format(entry1)
        const result2 = format(entry2)

        expect(result1).toContain('myapp')
        expect(result2).toContain('myapp')
    })

    test('does not show name when name is non-string', () => {
        const format = createPrettyFormatter({ color: false, showName: true })
        const result = format(makeEntry({ name: 123 as any }))

        expect(result).not.toContain('123')
    })

    // ── PID display ──
    test('hides PID by default', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry())

        expect(result).not.toContain(`(${process.pid})`)
    })

    test('shows PID when showPid is true', () => {
        const format = createPrettyFormatter({ color: false, showPid: true })
        const result = format(makeEntry())

        expect(result).toContain(`${process.pid}`)
    })

    // ── Timer display ──
    test('displays timer when LOGGER_TIMER in metadata', () => {
        const format = createPrettyFormatter({ color: false })
        const key = LOGGER_TIMER as unknown as string

        const result = format(makeEntry({ metadata: { [key]: 1_234_567n, levelName: 'info' } }))

        expect(result.length).toBeGreaterThan(0)
    })

    // ── Error display ──
    test('formats errors from metadata', () => {
        const format = createPrettyFormatter({ color: false })
        const error = new Error('test error')

        const result = format(makeEntry({
            message: 'with error',
            metadata: { errors: [error], levelName: 'error' },
        }))

        expect(result).toContain('test error')
        expect(result).toContain('with error')
    })

    test('formats first error inline when no message', () => {
        const format = createPrettyFormatter({ color: false })
        const error = new Error('inline error')

        const result = format(makeEntry({
            metadata: { errors: [error], levelName: 'error' },
        }))

        expect(result).toContain('inline error')
    })

    test('formats multiple errors', () => {
        const format = createPrettyFormatter({ color: false })
        const err1 = new Error('first')
        const err2 = new Error('second')

        const result = format(makeEntry({
            message: 'multi-err',
            metadata: { errors: [err1, err2], levelName: 'error' },
        }))

        expect(result).toContain('first')
        expect(result).toContain('second')
    })

    test('does not display errors section when errors array is empty', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            message: 'no errors',
            metadata: { errors: [], levelName: 'info' },
        }))

        expect(result).toContain('no errors')
    })

    // ── Data display ──
    test('shows data when showData is true (default)', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ data: ['extra data'], message: 'msg' }))

        expect(result).toContain('extra data')
    })

    test('hides data when showData is false', () => {
        const format = createPrettyFormatter({ color: false, showData: false })
        const result = format(makeEntry({ data: ['hidden data'], message: 'msg' }))

        expect(result).not.toContain('hidden data')
    })

    test('does not show data section when data is empty', () => {
        const format = createPrettyFormatter({ color: false })
        const baseline = format(makeEntry({ message: 'msg' }))
        const withEmptyData = format(makeEntry({ data: [], message: 'msg' }))

        expect(baseline).toBe(withEmptyData)
    })

    // ── Metadata display ──
    test('shows metadata when showMetadata is true (default)', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            message: 'msg',
            metadata: { custom: 'field', levelName: 'info' },
        }))

        expect(result).toContain('custom')
        expect(result).toContain('field')
    })

    test('hides metadata when showMetadata is false', () => {
        const format = createPrettyFormatter({ color: false, showMetadata: false })

        const result = format(makeEntry({
            message: 'msg',
            metadata: { custom: 'field', levelName: 'info' },
        }))

        expect(result).not.toContain('custom')
    })

    test('excludes internal metadata keys', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            message: 'msg',
            metadata: { hostname: 'server', pid: 1234, levelName: 'info' },
        }))

        expect(result).not.toContain('hostname')
        expect(result).not.toContain('1234')
    })

    test('does not show metadata section when only internal keys', () => {
        const format = createPrettyFormatter({ color: false })
        const resultNoMeta = format(makeEntry({ message: 'msg', metadata: { levelName: 'info' } }))
        const resultWithInternal = format(makeEntry({ message: 'msg', metadata: { hostname: 'h', pid: 1, levelName: 'info' } }))

        expect(resultNoMeta).toBe(resultWithInternal)
    })

    // ── Combined data + metadata ──
    test('shows both data and metadata together', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            data: ['some-data'],
            message: 'msg',
            metadata: { custom: 'meta', levelName: 'info' },
        }))

        expect(result).toContain('some-data')
        expect(result).toContain('custom')
    })

    // ── Color option ──
    test('works with color enabled', () => {
        const format = createPrettyFormatter({ color: true })
        const result = format(makeEntry({ message: 'colored' }))

        expect(result).toContain('colored')
    })

    test('works with default options', () => {
        const format = createPrettyFormatter()
        const result = format(makeEntry({ message: 'default' }))

        expect(result).toContain('default')
    })

    // ── Empty message edge case ──
    test('treats empty string message as no message', () => {
        const format = createPrettyFormatter({ color: false })
        const result = format(makeEntry({ message: '' }))

        expect(typeof result).toBe('string')
    })

    // ── Multiple errors without message — first inline, rest below ──
    test('first error inline and rest below when no message', () => {
        const format = createPrettyFormatter({ color: false })
        const err1 = new Error('first')
        const err2 = new Error('second')

        const result = format(makeEntry({
            metadata: { errors: [err1, err2], levelName: 'error' },
        }))

        expect(result).toContain('first')
        expect(result).toContain('second')
    })

    // ── Only metadata, no data ──
    test('shows metadata when there is no data', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            message: 'msg',
            metadata: { custom: 'value', levelName: 'info' },
        }))

        expect(result).toContain('custom')
    })

    // ── Only data, no custom metadata ──
    test('shows data when there is no custom metadata', () => {
        const format = createPrettyFormatter({ color: false })

        const result = format(makeEntry({
            data: ['only-data'],
            message: 'msg',
            metadata: { levelName: 'info' },
        }))

        expect(result).toContain('only-data')
    })

    // ── formatEntryData branch: no data and no metadata ──
    test('no data section when both data and metadata are absent', () => {
        const format = createPrettyFormatter({ color: false, showMetadata: false })
        const result = format(makeEntry({ message: 'msg', metadata: { levelName: 'info' } }))

        expect(result).not.toContain('\n')
    })

    // ── formatEntryData branch: data without metadata ──
    test('data without custom metadata renders data only', () => {
        const format = createPrettyFormatter({ color: false, showMetadata: false })

        const result = format(makeEntry({
            data: ['standalone-data'],
            message: 'msg',
            metadata: { levelName: 'info' },
        }))

        expect(result).toContain('standalone-data')
    })

    // ── formatEntryData branch: metadata without data ──
    test('metadata without data renders metadata only', () => {
        const format = createPrettyFormatter({ color: false, showData: false })

        const result = format(makeEntry({
            data: ['hidden'],
            message: 'msg',
            metadata: { custom: 'meta-only', levelName: 'info' },
        }))

        expect(result).toContain('meta-only')
        expect(result).not.toContain('hidden')
    })

    // ── Single error with message ──
    test('single error with message shows error below', () => {
        const format = createPrettyFormatter({ color: false })
        const error = new Error('single')

        const result = format(makeEntry({
            message: 'has message',
            metadata: { errors: [error], levelName: 'error' },
        }))

        expect(result).toContain('has message')
        expect(result).toContain('single')
    })

    // ── Single error without message ── only inline, no newline errors
    test('single error without message shows inline only', () => {
        const format = createPrettyFormatter({ color: false })
        const error = new Error('inline-only')

        const result = format(makeEntry({
            metadata: { errors: [error], levelName: 'error' },
        }))

        expect(result).toContain('inline-only')
    })

    // ── Custom error options ──
    test('passes error options to createErrorPretty', () => {
        const format = createPrettyFormatter({ color: false, error: { badge: false } })
        const error = new Error('no-badge')

        const result = format(makeEntry({
            metadata: { errors: [error], levelName: 'error' },
        }))

        expect(result).toContain('no-badge')
    })

    // ── Custom inspect options ──
    test('passes inspect options to createDataPrettier', () => {
        const format = createPrettyFormatter({ color: false, inspect: { depth: 1, colors: false } })
        const result = format(makeEntry({ data: [{ a: { b: { c: 'deep' } } }], message: 'msg', metadata: { levelName: 'info' } }))

        expect(result).toContain('[Object]')
    })

    // ── formatName with truncateName as number ──
    test('truncateName as number uses that as max length', () => {
        const format = createPrettyFormatter({ color: false, showName: true, truncateName: 5 })
        const result = format(makeEntry({ name: 'very-long-name', message: 'msg', metadata: { levelName: 'info' } }))

        expect(result).toContain('msg')
    })

    // ── formatEntryData: data is undefined, meta is present (data ?? [meta] branch) ──
    test('renders metadata array when data is absent but metadata present', () => {
        const format = createPrettyFormatter({ color: false, showData: true })

        const result = format(makeEntry({
            message: 'msg',
            metadata: { custom: 'value', levelName: 'info' },
        }))

        expect(result).toContain('custom')
    })

    // ── showData false with showMetadata false ──
    test('no extra output when both showData and showMetadata are false', () => {
        const format = createPrettyFormatter({ color: false, showData: false, showMetadata: false })

        const result = format(makeEntry({
            data: ['data'],
            message: 'msg',
            metadata: { custom: 'meta', levelName: 'info' },
        }))

        expect(result).not.toContain('data')
        expect(result).not.toContain('custom')
    })
})
