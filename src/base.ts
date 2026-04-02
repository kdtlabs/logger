import type { LogEntry, LogFilter, LogTransformer, LogTransport } from './types'
import { assertParam, isNullish, tap, unique } from '@kdtlabs/utils'
import { LoggerError } from './error'

export interface BaseLoggerOptions<TFilter = LogFilter, TTransformer = LogTransformer> {
    enabled?: boolean
    filters?: TFilter[]
    level?: number
    name?: string
    onError?: (error: LoggerError) => void
    parent?: BaseLogger
    transformers?: TTransformer[]
}

export class BaseLogger {
    public readonly name?: string
    public readonly levels: number[]

    public isEnabled: boolean
    public level: number

    protected readonly filters: LogFilter[]
    protected readonly transformers: LogTransformer[]
    protected readonly onError?: (error: LoggerError) => void
    protected readonly parent?: BaseLogger

    protected constructor(levels: number[], protected readonly transport: LogTransport, { enabled = true, filters, level, name, transformers, onError, parent }: BaseLoggerOptions<LogFilter<any>, LogTransformer<any>> = {}) {
        assertParam(levels.length > 0, 'Levels must not be empty')

        this.name = name
        this.levels = unique(levels).toSorted((a, b) => a - b)
        this.filters = filters ? [...filters] : []
        this.transformers = transformers ? [...transformers] : []
        this.isEnabled = enabled
        this.level = level ?? this.levels[0]!
        this.onError = onError
        this.parent = parent
    }

    public enable() {
        return tap(this, () => (this.isEnabled = true))
    }

    public disable() {
        return tap(this, () => (this.isEnabled = false))
    }

    public addFilter(filter: LogFilter) {
        return tap(this, () => !this.filters.includes(filter) && this.filters.push(filter))
    }

    public removeFilter(filter: LogFilter) {
        const index = this.filters.indexOf(filter)

        return tap(this, () => (
            index !== -1 && this.filters.splice(index, 1)
        ))
    }

    public addTransformer(transformer: LogTransformer) {
        return tap(this, () => !this.transformers.includes(transformer) && this.transformers.push(transformer))
    }

    public removeTransformer(transformer: LogTransformer) {
        const index = this.transformers.indexOf(transformer)

        return tap(this, () => (
            index !== -1 && this.transformers.splice(index, 1)
        ))
    }

    public writeLog(entry: LogEntry) {
        try {
            if (!this.isEntryLoggable(entry)) {
                return
            }

            const transformed = this.transform(entry)

            if (isNullish(transformed)) {
                return
            }

            this.transport(transformed, this)
        } catch (error) {
            const error_ = new LoggerError(entry, 'Unexpected logger error', { cause: error })

            if (this.onError) {
                this.onError(error_)
            } else {
                throw error_
            }
        }
    }

    protected transform(entry: LogEntry) {
        let newEntry: LogEntry = entry

        for (const transformer of this.transformers) {
            const result = transformer(newEntry, this)

            if (result === false) {
                return
            }

            if (isNullish(result)) {
                continue
            }

            newEntry = result
        }

        return newEntry
    }

    protected isLevelEnabled(level: number): boolean {
        return this.isEnabled && this.level <= level && this.parent?.isLevelEnabled(level) !== false
    }

    protected isEntryLoggable(entry: LogEntry) {
        if (!this.isLevelEnabled(entry.level)) {
            return false
        }

        for (const filter of this.filters) {
            if (!filter(entry, this)) {
                return false
            }
        }

        return true
    }
}
