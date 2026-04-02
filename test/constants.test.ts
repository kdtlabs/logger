import { describe, expect, test } from 'bun:test'
import { LOG_LEVEL_FORMATS, LOG_LEVEL_NAMES, LogLevel } from '../src/constants'

describe('LogLevel', () => {
    test('has correct numeric values', () => {
        expect(LogLevel.Trace).toBe(10)
        expect(LogLevel.Debug).toBe(20)
        expect(LogLevel.Info).toBe(30)
        expect(LogLevel.Warn).toBe(40)
        expect(LogLevel.Error).toBe(50)
        expect(LogLevel.Fatal).toBe(60)
        expect(LogLevel.Notice).toBe(70)
    })
})

describe('LOG_LEVEL_NAMES', () => {
    test('maps each level to its lowercase name', () => {
        expect(LOG_LEVEL_NAMES[LogLevel.Trace]).toBe('trace')
        expect(LOG_LEVEL_NAMES[LogLevel.Debug]).toBe('debug')
        expect(LOG_LEVEL_NAMES[LogLevel.Info]).toBe('info')
        expect(LOG_LEVEL_NAMES[LogLevel.Warn]).toBe('warn')
        expect(LOG_LEVEL_NAMES[LogLevel.Error]).toBe('error')
        expect(LOG_LEVEL_NAMES[LogLevel.Fatal]).toBe('fatal')
        expect(LOG_LEVEL_NAMES[LogLevel.Notice]).toBe('notice')
    })

    test('has exactly 7 entries', () => {
        expect(Object.keys(LOG_LEVEL_NAMES)).toHaveLength(7)
    })
})

describe('LOG_LEVEL_FORMATS', () => {
    const mockColors = {
        dim: (s: string) => `[dim]${s}[/dim]`,
        gray: (s: string) => `[gray]${s}[/gray]`,
        cyan: (s: string) => `[cyan]${s}[/cyan]`,
        yellow: (s: string) => `[yellow]${s}[/yellow]`,
        red: (s: string) => `[red]${s}[/red]`,
        blue: (s: string) => `[blue]${s}[/blue]`,
    } as any

    test('formats Trace level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Trace](mockColors)
        expect(result).toContain('TRACE')
    })

    test('formats Debug level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Debug](mockColors)
        expect(result).toContain('DEBUG')
    })

    test('formats Info level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Info](mockColors)
        expect(result).toContain('INFO')
    })

    test('formats Warn level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Warn](mockColors)
        expect(result).toContain('WARN')
    })

    test('formats Error level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Error](mockColors)
        expect(result).toContain('ERROR')
    })

    test('formats Fatal level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Fatal](mockColors)
        expect(result).toContain('FATAL')
    })

    test('formats Notice level', () => {
        const result = LOG_LEVEL_FORMATS[LogLevel.Notice](mockColors)
        expect(result).toContain('NOTICE')
    })

    test('has a formatter for every defined level', () => {
        for (const level of Object.values(LogLevel)) {
            if (typeof level === 'number') {
                expect(typeof LOG_LEVEL_FORMATS[level]).toBe('function')
            }
        }
    })
})
