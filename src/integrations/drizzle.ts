import type { Logger as IDrizzleLogger } from 'drizzle-orm/logger'
import type { Logger, LogLevelType } from '../logger'
import { AsyncLocalStorage } from 'node:async_hooks'
import { trim } from '@kdtlabs/utils'
import { LogLevel } from '../constants'
import { message } from '../logger'

export interface DrizzleContextOptions {
    level?: LogLevelType
    logger?: Logger
    metadata?: Record<string, unknown>
}

const drizzleContextStorage = new AsyncLocalStorage<DrizzleContextOptions>()

export const withDrizzleContext = <T>(options: DrizzleContextOptions, fn: () => T): T => (
    drizzleContextStorage.run(options, fn)
)

export class DrizzleLogger implements IDrizzleLogger {
    public constructor(protected readonly logger: Logger, protected readonly level: LogLevelType, protected readonly options: DrizzleLoggerOptions = {}) {}

    public logQuery(query: string, params: unknown[]) {
        const store = drizzleContextStorage.getStore()

        const logger = store?.logger ?? this.logger
        const level = store?.level ?? this.level
        const target = store?.metadata ? logger.with(store.metadata) : logger
        const msg = this.options.trim ? message(() => trim(query)) : query

        if (params.length > 0) {
            target.log(level, msg, params)
        } else {
            target.log(level, msg)
        }
    }
}

export interface DrizzleLoggerOptions {
    level?: LogLevelType
    trim?: boolean
}

export const createDrizzleLogger = (logger: Logger, { level = LogLevel.Debug, ...options }: DrizzleLoggerOptions = {}) => (
    new DrizzleLogger(logger, level, options)
)
