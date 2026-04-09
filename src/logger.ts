import type { LogEntry, LogFilter, LogTransformer, LogTransport } from './types'
import os from 'node:os'
import { assertParam, type Constructor, isObject, isString, map, notNullish, tap } from '@kdtlabs/utils'
import { BaseLogger, type BaseLoggerOptions } from './base'
import { LOG_LEVEL_NAMES, LogLevel } from './constants'

export const LOGGER_LAZY_MESSAGE = Symbol.for('logger.lazy-message')

export const message = (fn: () => string) => ({
    [LOGGER_LAZY_MESSAGE]: true, toString: fn,
})

export type LogLevelName = typeof LOG_LEVEL_NAMES[keyof typeof LOG_LEVEL_NAMES]
export type LogLevelType = LogLevel | LogLevelName

export interface LoggerOptions extends Omit<BaseLoggerOptions<LogFilter<Logger>, LogTransformer<Logger>>, 'level'> {
    level?: LogLevelType
    metadata?: Record<string, unknown>
}

export interface ChildLoggerOptions extends LoggerOptions {
    mergeFilters?: boolean
    mergeTransformers?: boolean
    nameSeparator?: string
}

const hostname = os.hostname()
const levels = map(LOG_LEVEL_NAMES, (level, name) => <const>[name, Number(`${level}`)])
const levelsMap = { ...levels, ...map(levels, (_, level) => [level, level]) } as Record<LogLevelType, number>
const levelNamesMap = map(levels, (name, level) => [level, name])

export class Logger extends BaseLogger {
    protected readonly metadata: Record<string, unknown>
    protected readonly levelsMap: Record<LogLevelType, number>
    protected readonly levelNamesMap: Record<number, LogLevelName>

    public constructor(transport: LogTransport, protected readonly options: LoggerOptions = {}) {
        const { level, metadata = {}, ...baseOptions } = options

        super(Object.values(levels), transport, baseOptions)

        this.levelsMap = levelsMap
        this.levelNamesMap = levelNamesMap
        this.level = levelsMap[level ?? LogLevel.Info]
        this.metadata = { hostname, pid: process.pid, ...metadata }

        assertParam(this.level in this.levelsMap, `Invalid logger level: ${this.level}`)
    }

    public getLevel(level: LogLevelType) {
        return this.levelsMap[level]
    }

    public getLevelName(level: number) {
        return this.levelNamesMap[level]
    }

    public isLogLevelEnabled(level: LogLevelType) {
        return this.isLevelEnabled(this.getLevel(level))
    }

    public child({ filters = [], mergeFilters = true, mergeTransformers = true, metadata = {}, name, nameSeparator = ':', transformers = [], ...options }: ChildLoggerOptions = {}) {
        const childOptions = {
            ...options,
            filters: mergeFilters ? [...this.filters, ...filters] : filters,
            metadata: { ...this.metadata, ...metadata },
            name: this.name ? [this.name, name].filter(notNullish).join(nameSeparator) : name,
            parent: this,
            transformers: mergeTransformers ? [...this.transformers, ...transformers] : transformers,
        }

        return new (this.constructor as Constructor<Logger>)(this.transport, { ...this.options, ...childOptions }) as this
    }

    public with(metadata: Record<string, unknown>): this {
        const instance = Object.create(this)

        instance.metadata = {
            ...this.metadata, ...metadata,
        }

        return instance
    }

    public trace(...args: unknown[]) {
        return this.log(LogLevel.Trace, ...args)
    }

    public debug(...args: unknown[]) {
        return this.log(LogLevel.Debug, ...args)
    }

    public info(...args: unknown[]) {
        return this.log(LogLevel.Info, ...args)
    }

    public warn(...args: unknown[]) {
        return this.log(LogLevel.Warn, ...args)
    }

    public error(...args: unknown[]) {
        return this.log(LogLevel.Error, ...args)
    }

    public fatal(...args: unknown[]) {
        return this.log(LogLevel.Fatal, ...args)
    }

    public notice(...args: unknown[]) {
        return this.log(LogLevel.Notice, ...args)
    }

    public log(level: LogLevelType, ...args: unknown[]) {
        const levelValue = this.getLevel(level)

        if (!this.isLevelEnabled(levelValue)) {
            return this
        }

        return this._writeLog(levelValue, args)
    }

    protected _writeLog(level: number, args: unknown[]) {
        const entry: LogEntry = { timestamp: Date.now(), level, name: this.name, message: undefined, data: undefined, metadata: { ...this.metadata, levelName: this.getLevelName(level) } }

        if (args.length === 1 && isString(args[0])) {
            entry.message = args[0]
        } else if (args.length > 0) {
            const [first, ...rest] = args

            if (isString(first)) {
                entry.message = first
                entry.data = rest
            } else if (isObject(first) && LOGGER_LAZY_MESSAGE in first) {
                entry.message = first.toString()
                entry.data = rest
            } else {
                entry.data = args
            }
        }

        return tap(this, () => this.writeLog(entry))
    }
}
