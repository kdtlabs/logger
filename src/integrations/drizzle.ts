import type { Logger as IDrizzleLogger } from 'drizzle-orm/logger'
import type { Logger, LogLevelType } from '../logger'
import { AsyncLocalStorage } from 'node:async_hooks'
import { LogLevel } from '../constants'

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
    public constructor(protected readonly logger: Logger, protected readonly level: LogLevelType) {}

    public logQuery(query: string, params: unknown[]) {
        const store = drizzleContextStorage.getStore()

        const logger = store?.logger ?? this.logger
        const level = store?.level ?? this.level
        const target = store?.metadata ? logger.with(store.metadata) : logger

        if (params.length > 0) {
            target.log(level, query, params)
        } else {
            target.log(level, query)
        }
    }
}

export interface DrizzleLoggerOptions {
    level?: LogLevelType
}

export const createDrizzleLogger = (logger: Logger, { level = LogLevel.Debug }: DrizzleLoggerOptions = {}) => (
    new DrizzleLogger(logger, level)
)
