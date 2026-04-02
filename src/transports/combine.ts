import type { LogEntry, LogTransport } from '../types'
import { entries, isArray, normalizeError } from '@kdtlabs/utils'
import { metadata } from '../transformers'

export const LOGGER_EXCLUDE_TRANSPORTS = Symbol.for('logger.exclude-transports')

export const excludeTransports = (transports: string[]) => metadata({
    [LOGGER_EXCLUDE_TRANSPORTS]: transports,
})

export function getExcludedTransports(entry: LogEntry) {
    if (!(LOGGER_EXCLUDE_TRANSPORTS in entry.metadata)) {
        return
    }

    return entry.metadata[LOGGER_EXCLUDE_TRANSPORTS] as string[]
}

export interface CombineTransportError {
    error: unknown
    transport: string
}

export interface CombineTransportOptions<T> {
    onError?: (errors: CombineTransportError[], entry: LogEntry, logger: T) => void
}

export function createCombineTransport<T>(transports: Record<string, LogTransport<T>>, { onError }: CombineTransportOptions<T> = {}): LogTransport<T> {
    const entriesTransport = entries(transports)

    return (entry, logger) => {
        const excludes = getExcludedTransports(entry)
        let errors: CombineTransportError[] | undefined

        for (const [name, transport] of entriesTransport) {
            if (excludes?.includes(name)) {
                continue
            }

            try {
                transport(entry, logger)
            } catch (error) {
                const key = LOGGER_EXCLUDE_TRANSPORTS as unknown as string

                if (isArray(entry.metadata[key])) {
                    entry.metadata[key].push(name)
                } else {
                    entry.metadata[key] = [name]
                }

                errors ??= []
                errors.push({ error, transport: name })
            }
        }

        if (errors?.length) {
            if (onError) {
                onError(errors, entry, logger)
            } else {
                throw new AggregateError(errors.map((e) => Object.assign(normalizeError(e.error), { transport: e.transport })), 'Transport errors')
            }
        }
    }
}
