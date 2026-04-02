import type { Nullish } from '@kdtlabs/utils'

export interface LogEntry {
    data?: unknown[]
    level: number
    message?: string
    metadata: Record<string, unknown>
    name?: string
    timestamp: number
}

export type LogFilter<T = unknown> = (entry: LogEntry, logger: T) => boolean

export type LogTransformer<T = unknown> = (entry: LogEntry, logger: T) => Nullish<LogEntry | false>

export type LogTransport<T = unknown> = (entry: LogEntry, logger: T) => void
