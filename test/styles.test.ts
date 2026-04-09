import { describe, expect, test } from 'bun:test'
import pc from 'picocolors'
import { accent, badge, bold, highlight, muted, text } from '../src/styles'

describe('styles', () => {
    describe('text', () => {
        test('applies whiteBright', () => {
            expect(text('hello')).toBe(pc.whiteBright('hello'))
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(text('hello', cl)).toBe('hello')
        })
    })

    describe('highlight', () => {
        test('applies bold yellow', () => {
            expect(highlight('hello')).toBe(pc.bold(pc.yellow('hello')))
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(highlight('hello', cl)).toBe('hello')
        })
    })

    describe('muted', () => {
        test('applies dim', () => {
            expect(muted('hello')).toBe(pc.dim('hello'))
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(muted('hello', cl)).toBe('hello')
        })
    })

    describe('accent', () => {
        test('applies magenta', () => {
            expect(accent('hello')).toBe(pc.magenta('hello'))
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(accent('hello', cl)).toBe('hello')
        })
    })

    describe('badge', () => {
        test('applies bgRed with bold whiteBright and padding', () => {
            expect(badge('ERROR')).toBe(pc.bgRed(pc.bold(pc.whiteBright(' ERROR '))))
        })

        test('adds space padding around text', () => {
            const cl = pc.createColors(false)

            expect(badge('TEST', cl)).toBe(' TEST ')
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(badge('hello', cl)).toBe(' hello ')
        })
    })

    describe('bold', () => {
        test('applies bold', () => {
            expect(bold('hello')).toBe(pc.bold('hello'))
        })

        test('uses custom colors instance', () => {
            const cl = pc.createColors(false)

            expect(bold('hello', cl)).toBe('hello')
        })
    })
})
