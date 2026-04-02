import { describe, expect, test } from 'bun:test'
import { createErrorPretty } from '../../../src/formatters/pretty/error'

const noopColors = {
    bold: (s: string) => s,
    whiteBright: (s: string) => s,
    bgRed: (s: string) => s,
    dim: (s: string) => s,
} as any

describe('createErrorPretty', () => {
    // ── Basic formatting ──
    test('formats a simple error with badge', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('test error')
        const result = format(error)

        expect(result).toContain('Error')
        expect(result).toContain('test error')
    })

    test('formats error without badge', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('no badge')
        const result = format(error, false)

        expect(result).toContain('Error')
        expect(result).toContain('no badge')
    })

    test('formats error with badge disabled in options', () => {
        const format = createErrorPretty(noopColors, { badge: false })
        const error = new Error('test')
        const result = format(error)

        expect(result).toContain('[')
        expect(result).toContain(']')
    })

    test('showBadge parameter overrides badge option', () => {
        const format = createErrorPretty(noopColors, { badge: false })
        const error = new Error('test')
        const resultWithBadge = format(error, true)
        const resultWithoutBadge = format(error, false)

        expect(resultWithBadge).not.toBe(resultWithoutBadge)
    })

    // ── Error code ──
    test('includes error code when present', () => {
        const format = createErrorPretty(noopColors)
        const error = Object.assign(new Error('coded'), { code: 'ERR_TEST' })
        const result = format(error)

        expect(result).toContain('ERR_TEST')
    })

    test('excludes code when not present', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('no code')
        const result = format(error)

        expect(result).not.toContain('()')
    })

    // ── Stack trace ──
    test('includes stack trace lines', () => {
        const format = createErrorPretty(noopColors, { cleanStack: false })
        const error = new Error('with stack')
        const result = format(error)

        expect(result).toContain('at ')
    })

    test('handles error with no stack', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('no stack')
        error.stack = undefined
        const result = format(error)

        expect(result).toContain('no stack')
    })

    test('handles error with stack but no "at" lines', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('weird stack')
        error.stack = 'Error: weird stack\nno at lines here'
        const result = format(error)

        expect(result).toContain('weird stack')
    })

    test('cleans stack trace by default', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('clean me')
        const result = format(error)

        expect(result).toContain('clean me')
    })

    test('disables stack cleaning when cleanStack is false', () => {
        const format = createErrorPretty(noopColors, { cleanStack: false })
        const error = new Error('raw stack')
        const result = format(error)

        expect(result).toContain('raw stack')
    })

    // ── Cause chain ──
    test('formats error cause', () => {
        const format = createErrorPretty(noopColors)
        const cause = new Error('root cause')
        const error = new Error('wrapper', { cause })
        const result = format(error)

        expect(result).toContain('root cause')
        expect(result).toContain('wrapper')
    })

    test('handles deeply nested causes', () => {
        const format = createErrorPretty(noopColors)
        const deep = new Error('deep')
        const mid = new Error('mid', { cause: deep })
        const top = new Error('top', { cause: mid })
        const result = format(top)

        expect(result).toContain('deep')
        expect(result).toContain('mid')
        expect(result).toContain('top')
    })

    test('respects maxDepth for cause chain', () => {
        const format = createErrorPretty(noopColors, { maxDepth: 1 })
        const deep = new Error('too deep')
        const mid = new Error('mid', { cause: deep })
        const top = new Error('top', { cause: mid })
        const result = format(top)

        expect(result).toContain('top')
        expect(result).toContain('mid')
        expect(result).not.toContain('too deep')
    })

    test('does not recurse when error.cause is itself', () => {
        const format = createErrorPretty(noopColors)

        const error = new Error('self');
        (error as any).cause = error
        const result = format(error)

        expect(result).toContain('self')
    })

    // ── AggregateError ──
    test('formats AggregateError with sub-errors', () => {
        const format = createErrorPretty(noopColors)
        const err1 = new Error('one')
        const err2 = new Error('two')
        const aggError = new AggregateError([err1, err2], 'aggregate')
        const result = format(aggError)

        expect(result).toContain('aggregate')
        expect(result).toContain('one')
        expect(result).toContain('two')
    })

    test('respects maxDepth for AggregateError', () => {
        const format = createErrorPretty(noopColors, { maxDepth: 0 })
        const err1 = new Error('one')
        const aggError = new AggregateError([err1], 'aggregate')
        const result = format(aggError)

        expect(result).toContain('aggregate')
        expect(result).not.toContain('one')
    })

    // ── Data formatter ──
    test('includes formatted properties when dataFormatter is provided', () => {
        const dataFormatter = (...args: any[]) => JSON.stringify(args[0])
        const format = createErrorPretty(noopColors, { dataFormatter })
        const error = Object.assign(new Error('with data'), { extra: 'value' })
        const result = format(error)

        expect(result).toContain('extra')
        expect(result).toContain('value')
    })

    test('excludes code key from data properties', () => {
        const dataFormatter = (...args: any[]) => JSON.stringify(args[0])
        const format = createErrorPretty(noopColors, { dataFormatter })
        const error = Object.assign(new Error('coded'), { code: 'ERR_X', extra: 'val' })
        const result = format(error)

        expect(result).toContain('extra')
    })

    test('excludes hideKeys from data properties', () => {
        const dataFormatter = (...args: any[]) => JSON.stringify(args[0])
        const format = createErrorPretty(noopColors, { dataFormatter, hideKeys: ['secret'] })
        const error = Object.assign(new Error('hidden'), { secret: 'sssh', visible: 'ok' })
        const result = format(error)

        expect(result).toContain('visible')
    })

    test('skips data when no extra properties', () => {
        const dataFormatter = (...args: any[]) => JSON.stringify(args[0])
        const format = createErrorPretty(noopColors, { dataFormatter })
        const error = new Error('plain')
        const result = format(error)

        expect(result).toContain('plain')
    })

    test('works without dataFormatter', () => {
        const format = createErrorPretty(noopColors)
        const error = Object.assign(new Error('no formatter'), { extra: 'val' })
        const result = format(error)

        expect(result).toContain('no formatter')
    })

    // ── Indent option ──
    test('applies custom indentation', () => {
        const format = createErrorPretty(noopColors, { indent: 4, cleanStack: false })
        const error = new Error('indented')
        const result = format(error)

        expect(result).toContain('indented')
    })

    // ── Custom error types ──
    test('formats TypeError', () => {
        const format = createErrorPretty(noopColors)
        const error = new TypeError('type issue')
        const result = format(error)

        expect(result).toContain('TypeError')
        expect(result).toContain('type issue')
    })

    test('formats RangeError', () => {
        const format = createErrorPretty(noopColors)
        const error = new RangeError('range issue')
        const result = format(error)

        expect(result).toContain('RangeError')
    })

    // ── Non-Error cause ──
    test('normalizes non-Error cause', () => {
        const format = createErrorPretty(noopColors)
        const error = new Error('with cause', { cause: 'string cause' })
        const result = format(error)

        expect(result).toContain('with cause')
    })
})
