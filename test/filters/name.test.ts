import { describe, expect, test } from 'bun:test'
import { parseFilter } from '../../src/filters/name'

describe('parseFilter', () => {
    // ── Basic patterns ──
    test('single exact pattern', () => {
        const { includes, excludes } = parseFilter('app')

        expect(includes).toHaveLength(1)
        expect(excludes).toHaveLength(0)
        expect(includes[0]!.test('app')).toBe(true)
        expect(includes[0]!.test('app:db')).toBe(false)
    })

    test('single wildcard pattern', () => {
        const { includes } = parseFilter('app:*')

        expect(includes).toHaveLength(1)
        expect(includes[0]!.test('app:')).toBe(true)
        expect(includes[0]!.test('app:db')).toBe(true)
        expect(includes[0]!.test('app:db:query')).toBe(true)
        expect(includes[0]!.test('app')).toBe(false)
        expect(includes[0]!.test('application:db')).toBe(false)
    })

    test('wildcard only', () => {
        const { includes } = parseFilter('*')

        expect(includes).toHaveLength(1)
        expect(includes[0]!.test('')).toBe(true)
        expect(includes[0]!.test('anything')).toBe(true)
        expect(includes[0]!.test('app:db:query')).toBe(true)
    })

    // ── Exclude patterns ──
    test('single exclude pattern', () => {
        const { includes, excludes } = parseFilter('-worker:*')

        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(1)
        expect(excludes[0]!.test('worker:queue')).toBe(true)
        expect(excludes[0]!.test('worker:queue:job')).toBe(true)
        expect(excludes[0]!.test('worker')).toBe(false)
    })

    test('exclude all with -* ', () => {
        const { includes, excludes } = parseFilter('-*')

        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(1)
        expect(excludes[0]!.test('anything')).toBe(true)
        expect(excludes[0]!.test('')).toBe(true)
    })

    test('exact exclude', () => {
        const { excludes } = parseFilter('-app')

        expect(excludes).toHaveLength(1)
        expect(excludes[0]!.test('app')).toBe(true)
        expect(excludes[0]!.test('app:db')).toBe(false)
    })

    // ── Comma-separated ──
    test('multiple includes', () => {
        const { includes, excludes } = parseFilter('app:*,server:*')

        expect(includes).toHaveLength(2)
        expect(excludes).toHaveLength(0)
        expect(includes[0]!.test('app:db')).toBe(true)
        expect(includes[1]!.test('server:http')).toBe(true)
    })

    test('mixed includes and excludes', () => {
        const { includes, excludes } = parseFilter('app:*,-app:db,server:*')

        expect(includes).toHaveLength(2)
        expect(excludes).toHaveLength(1)
        expect(includes[0]!.test('app:api')).toBe(true)
        expect(excludes[0]!.test('app:db')).toBe(true)
        expect(includes[1]!.test('server:http')).toBe(true)
    })

    // ── Whitespace handling ──
    test('spaces around commas', () => {
        const { includes } = parseFilter('app:* , server:*')
        expect(includes).toHaveLength(2)
    })

    test('tabs and multiple spaces', () => {
        const { includes } = parseFilter('app:*\t\tserver:*')
        expect(includes).toHaveLength(2)
    })

    test('leading and trailing whitespace', () => {
        const { includes } = parseFilter('  app:*  ')

        expect(includes).toHaveLength(1)
        expect(includes[0]!.test('app:db')).toBe(true)
    })

    // ── Empty / degenerate inputs ──
    test('empty string', () => {
        const { includes, excludes } = parseFilter('')

        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(0)
    })

    test('only commas', () => {
        const { includes, excludes } = parseFilter(',,,')
        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(0)
    })

    test('only whitespace', () => {
        const { includes, excludes } = parseFilter('   ')

        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(0)
    })

    test('comma with spaces', () => {
        const { includes, excludes } = parseFilter(' , , ')

        expect(includes).toHaveLength(0)
        expect(excludes).toHaveLength(0)
    })

    // ── Wildcard edge cases ──
    test('double wildcard', () => {
        const { includes } = parseFilter('app:**')

        expect(includes[0]!.test('app:')).toBe(true)
        expect(includes[0]!.test('app:db:query')).toBe(true)
    })

    test('wildcard in the middle', () => {
        const { includes } = parseFilter('app:*:query')

        expect(includes[0]!.test('app:db:query')).toBe(true)
        expect(includes[0]!.test('app::query')).toBe(true)
        expect(includes[0]!.test('app:query')).toBe(false)
    })

    test('multiple wildcards', () => {
        const { includes } = parseFilter('*:*')

        expect(includes[0]!.test('app:db')).toBe(true)
        expect(includes[0]!.test(':db')).toBe(true)
        expect(includes[0]!.test('app')).toBe(false)
    })

    // ── Regex special characters are escaped ──
    test('dot in name is literal', () => {
        const { includes } = parseFilter('app.db')

        expect(includes[0]!.test('app.db')).toBe(true)
        expect(includes[0]!.test('appXdb')).toBe(false)
    })

    test('parentheses in name are literal', () => {
        const { includes } = parseFilter('app(db)')

        expect(includes[0]!.test('app(db)')).toBe(true)
        expect(includes[0]!.test('appdb')).toBe(false)
    })

    test('brackets in name are literal', () => {
        const { includes } = parseFilter('app[0]')

        expect(includes[0]!.test('app[0]')).toBe(true)
        expect(includes[0]!.test('app0')).toBe(false)
    })

    test('plus and question mark are literal', () => {
        const { includes } = parseFilter('app+db?')

        expect(includes[0]!.test('app+db?')).toBe(true)
        expect(includes[0]!.test('apppdb')).toBe(false)
    })

    test('caret and dollar are literal', () => {
        const { includes } = parseFilter('$app^db')
        expect(includes[0]!.test('$app^db')).toBe(true)
    })

    test('pipe is literal', () => {
        const { includes } = parseFilter('app|db')

        expect(includes[0]!.test('app|db')).toBe(true)
        expect(includes[0]!.test('app')).toBe(false)
        expect(includes[0]!.test('db')).toBe(false)
    })

    test('backslash is literal', () => {
        const { includes } = parseFilter(String.raw`app\db`)
        expect(includes[0]!.test(String.raw`app\db`)).toBe(true)
    })

    test('special chars with wildcard', () => {
        const { includes } = parseFilter('app.v2:*')

        expect(includes[0]!.test('app.v2:db')).toBe(true)
        expect(includes[0]!.test('appXv2:db')).toBe(false)
    })

    test('special chars in exclude', () => {
        const { excludes } = parseFilter('-app.v2')

        expect(excludes[0]!.test('app.v2')).toBe(true)
        expect(excludes[0]!.test('appXv2')).toBe(false)
    })

    // ── Partial match prevention ──
    test('pattern does not partially match', () => {
        const { includes } = parseFilter('app')

        expect(includes[0]!.test('myapp')).toBe(false)
        expect(includes[0]!.test('appended')).toBe(false)
    })

    test('wildcard pattern does not partially match prefix', () => {
        const { includes } = parseFilter('app:*')
        expect(includes[0]!.test('xapp:db')).toBe(false)
    })

    // ── Exclude with hyphenated names ──
    test('hyphenated name not confused with exclude', () => {
        // First char '-' means exclude, but 'my-app' should be include
        const { includes, excludes } = parseFilter('my-app')

        expect(includes).toHaveLength(1)
        expect(excludes).toHaveLength(0)
        expect(includes[0]!.test('my-app')).toBe(true)
    })

    test('exclude pattern must start with dash', () => {
        const { includes, excludes } = parseFilter('app-v2')

        expect(includes).toHaveLength(1)
        expect(excludes).toHaveLength(0)
    })
})
