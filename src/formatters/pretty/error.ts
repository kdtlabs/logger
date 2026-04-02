import type { Options as CleanStackOptions } from 'clean-stack'
import type { Colors } from 'picocolors/types'
import { filter, indent, isEmptyObject, normalizeError, resolveOptions } from '@kdtlabs/utils'
import clean from 'clean-stack'

export interface ErrorPrettyOptions {
    badge?: boolean
    cleanStack?: CleanStackOptions | boolean
    dataFormatter?: (...args: any[]) => string
    hideKeys?: string[]
    indent?: number
    maxDepth?: number
}

export function createErrorPretty(c: Colors, { badge = true, indent: _indent = 2, cleanStack = true, maxDepth = 10, hideKeys = [], dataFormatter }: ErrorPrettyOptions = {}) {
    const cleanStackOptions = resolveOptions(cleanStack, { pretty: true })
    const hideKeysSet = new Set(hideKeys)

    const pretty = (error: Error, indent_: number, showBadge: boolean, depth: number) => {
        const errCode = 'code' in error && error.code ? ` (${String(error.code)})` : ''
        const label = c.bold(c.whiteBright(`${error.name}${errCode}`))
        const errType = showBadge ? c.bgRed(` ${label} `) : `[${label}]`

        let stack = ''

        if (error.stack) {
            const raw = cleanStackOptions === false ? error.stack : clean(error.stack, cleanStackOptions)
            const lines = raw.split('\n')
            const firstAt = lines.findIndex((l) => l.trimStart().startsWith('at '))

            if (firstAt !== -1) {
                stack = c.dim(indent(lines.slice(firstAt).join('\n'), indent_, true))
            }
        }

        let subError = ''

        if (depth < maxDepth) {
            const pad = ' '.repeat(indent_)
            const nextIndent = indent_ + _indent
            const nextDepth = depth + 1

            if (error !== error.cause) {
                subError = `\n${pad}${pretty(normalizeError(error.cause), nextIndent, showBadge, nextDepth)}`
            }

            if (error instanceof AggregateError) {
                subError += `\n${error.errors.map((e) => `${pad}${pretty(normalizeError(e), nextIndent, showBadge, nextDepth)}`).join('\n')}`
            }
        }

        let data = ''

        if (dataFormatter) {
            const properties = filter(error, (k: string) => k !== 'code' && !hideKeysSet.has(k))

            if (!isEmptyObject(properties)) {
                data = `\n${indent(dataFormatter(properties), indent_, true)}`
            }
        }

        return `${errType} ${error.message}${stack ? `\n${stack}` : ''}${data}${subError}`
    }

    return (error: Error, showBadge?: boolean) => pretty(error, _indent, showBadge ?? badge, 0)
}
