import type { Logger, LogLevelType } from '../logger'
import type { LogFilter } from '../types'

export const createLevelFilter = (level: LogLevelType): LogFilter<Logger> => {
    return (entry, logger) => entry.level >= logger.getLevel(level)
}
