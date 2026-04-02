import type { Logger as IDrizzleLogger } from 'drizzle-orm/logger'
import type { Logger, LogLevelType } from '../logger'
import { LogLevel } from '../constants'

export class DrizzleLogger implements IDrizzleLogger {
    public constructor(protected readonly logger: Logger, protected readonly level: LogLevelType) {}

    public logQuery(query: string, params: unknown[]) {
        this.logger.log(this.level, query, params)
    }
}

export interface DrizzleLoggerOptions {
    level?: LogLevelType
}

export const createDrizzleLogger = (logger: Logger, { level = LogLevel.Debug }: DrizzleLoggerOptions = {}) => (
    new DrizzleLogger(logger, level)
)
