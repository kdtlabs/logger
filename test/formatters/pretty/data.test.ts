import { describe, expect, test } from 'bun:test'
import { createDataPrettier, resolveInspectOptions } from '../../../src/formatters/pretty/data'

describe('resolveInspectOptions', () => {
    test('returns defaults when no options provided', () => {
        const result = resolveInspectOptions()

        expect(result.depth).toBe(6)
        expect(result.colors).toBe(true)
        expect(result.maxArrayLength).toBe(100)
        expect(result.maxStringLength).toBe(100)
    })

    test('respects custom depth', () => {
        const result = resolveInspectOptions({ depth: 3 })
        expect(result.depth).toBe(3)
    })

    test('respects custom colors', () => {
        const result = resolveInspectOptions({ colors: false })
        expect(result.colors).toBe(false)
    })

    test('respects custom maxArrayLength', () => {
        const result = resolveInspectOptions({ maxArrayLength: 50 })
        expect(result.maxArrayLength).toBe(50)
    })

    test('respects custom maxStringLength', () => {
        const result = resolveInspectOptions({ maxStringLength: 200 })
        expect(result.maxStringLength).toBe(200)
    })

    test('uses maxColumns for breakLength when breakLength not set', () => {
        const result = resolveInspectOptions({ maxColumns: 120 })
        const expected = Math.max(120, process.stdout.columns)

        expect(result.breakLength).toBe(expected)
    })

    test('uses explicit breakLength over maxColumns', () => {
        const result = resolveInspectOptions({ maxColumns: 120, breakLength: 200 })
        expect(result.breakLength).toBe(200)
    })

    test('defaults maxColumns to 80', () => {
        const result = resolveInspectOptions()
        const expected = Math.max(80, process.stdout.columns)

        expect(result.breakLength).toBe(expected)
    })

    test('passes through additional options', () => {
        const result = resolveInspectOptions({ showHidden: true, compact: false })

        expect(result.showHidden).toBe(true)
        expect(result.compact).toBe(false)
    })
})

describe('createDataPrettier', () => {
    test('formats a simple value', () => {
        const format = createDataPrettier({ colors: false })
        const result = format('hello')

        expect(result).toContain('hello')
    })

    test('formats an object', () => {
        const format = createDataPrettier({ colors: false })
        const result = format({ key: 'value' })

        expect(result).toContain('key')
        expect(result).toContain('value')
    })

    test('formats multiple arguments', () => {
        const format = createDataPrettier({ colors: false })
        const result = format('a', 'b', 'c')

        expect(result).toContain('a')
        expect(result).toContain('b')
        expect(result).toContain('c')
    })

    test('applies indentation', () => {
        const format = createDataPrettier({ indent: 4, colors: false })
        const result = format('hello')

        expect(result.startsWith('    ')).toBe(true)
    })

    test('uses default indent of 2', () => {
        const format = createDataPrettier({ colors: false })
        const result = format('hello')

        expect(result.startsWith('  ')).toBe(true)
    })

    test('handles nested objects', () => {
        const format = createDataPrettier({ colors: false })
        const result = format({ a: { b: { c: 'deep' } } })

        expect(result).toContain('deep')
    })

    test('handles arrays', () => {
        const format = createDataPrettier({ colors: false })
        const result = format([1, 2, 3])

        expect(result).toContain('1')
        expect(result).toContain('2')
        expect(result).toContain('3')
    })

    test('handles null and undefined', () => {
        const format = createDataPrettier({ colors: false })

        expect(format(null)).toContain('null')
        expect(format(undefined)).toContain('undefined')
    })

    test('respects custom options', () => {
        const format = createDataPrettier({ colors: false, depth: 1 })
        const result = format({ a: { b: { c: 'deep' } } })

        expect(result).toContain('[Object]')
    })

    test('works with no options', () => {
        const format = createDataPrettier()
        const result = format('test')

        expect(result).toContain('test')
    })
})
