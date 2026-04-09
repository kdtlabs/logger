import type { LogEntry } from '../../types'
import { formatDate, humanizeNanoseconds, isString, isSymbol, map, truncateMiddle } from '@kdtlabs/utils'
import pc from 'picocolors'
import { LOG_LEVEL_FORMATS } from '../../constants'
import { accent, muted, text } from '../../styles'
import { metadata } from '../../transformers'
import { createDataPrettier, type DataPrettierOptions } from './data'
import { createErrorPretty, type ErrorPrettyOptions } from './error'

export const LOGGER_TIMER = Symbol.for('logger.metadata.timer')

export const timer = (start: bigint) => metadata({
    [LOGGER_TIMER]: process.hrtime.bigint() - start,
})

export interface PrettyFormatterOptions {
    color?: boolean
    error?: Omit<ErrorPrettyOptions, 'dataFormatter'>
    inspect?: DataPrettierOptions
    showData?: boolean
    showMetadata?: boolean
    showName?: boolean
    showPid?: boolean
    timeFormat?: string
    truncateName?: boolean | number
}

export function createPrettyFormatter(options: PrettyFormatterOptions = {}) {
    const { color = true, showName = false, showData = true, error: errorOptions, inspect, showMetadata = true, showPid = false, truncateName = true, timeFormat = 'HH:mm:ss.SSS' } = options

    const cl = pc.createColors(color)
    const levels = map(LOG_LEVEL_FORMATS, (level, label) => [Number(`${level}`), label(cl)])

    const maxNameLength = truncateName === true ? 20 : truncateName
    const compiledName: Record<string, string> = {}
    const pid = showPid ? muted(` (${process.pid})`, cl) : ''

    const formatTime = (timestamp: Date) => muted(`[${formatDate(timestamp, timeFormat)}]`, cl)
    const formatName = (name: string) => compiledName[name] ??= muted(` ${maxNameLength === false ? name : truncateMiddle(name, maxNameLength)}`, cl)
    const formatTimer = (result: bigint) => muted(accent(` ${humanizeNanoseconds(result)}`, cl), cl)

    const formatData = createDataPrettier(inspect)
    const formatError = createErrorPretty(cl, { ...errorOptions, dataFormatter: formatData })

    const metadataExcludeKeys = new Set<string>(['errors', 'hostname', 'levelName', 'pid'])

    const formatErrors = (errors: Error[], hasMessage: boolean) => {
        let result = ''
        let i = 0

        if (!hasMessage) {
            result += ` ${formatError(errors[0]!, false)}`
            i++
        }

        if (errors.length > i) {
            result += `\n${errors.slice(i).map((error) => formatError(error)).join('\n')}`
        }

        return result
    }

    const filterMetadata = (meta: Record<string, unknown>) => {
        let filtered: Record<string, unknown> | undefined

        for (const key in meta) {
            if (!isSymbol(key) && !metadataExcludeKeys.has(key)) {
                filtered ??= {}
                filtered[key] = meta[key]
            }
        }

        return filtered
    }

    const formatEntryData = (data: unknown[] | undefined, meta: Record<string, unknown> | undefined) => {
        return `\n${formatData(...(data && meta ? [...data, meta] : data ?? [meta]))}`
    }

    return (entry: LogEntry) => {
        let message = `${formatTime(new Date(entry.timestamp))} ${levels[entry.level] ?? entry.level}${pid}`

        if (showName && isString(entry.name)) {
            message += formatName(entry.name)
        }

        let hasMessage = false

        if (entry.message?.length) {
            message += ` ${text(entry.message, cl)}`
            hasMessage = true
        }

        if (LOGGER_TIMER in entry.metadata) {
            message += formatTimer(entry.metadata[LOGGER_TIMER] as bigint)
        }

        if (entry.metadata.errors) {
            const errors = entry.metadata.errors as Error[]

            if (errors.length > 0) {
                message += formatErrors(errors, hasMessage)
            }
        }

        const filteredMetadata = showMetadata ? filterMetadata(entry.metadata) : undefined
        const hasData = showData && entry.data?.length

        if (hasData || filteredMetadata) {
            message += formatEntryData(hasData ? entry.data! : undefined, filteredMetadata)
        }

        return message
    }
}
