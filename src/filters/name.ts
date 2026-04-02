import type { Logger, LogLevelType } from '../logger'
import type { LogFilter } from '../types'
import { escapeRegExp, isNullish, trim } from '@kdtlabs/utils'

export function parseFilter(filter: string) {
    const includes: RegExp[] = []
    const excludes: RegExp[] = []

    for (const raw of filter.split(/[\s,]+/u)) {
        if (!raw) {
            continue
        }

        const isExclude = raw.startsWith('-')
        const item = escapeRegExp(isExclude ? raw.slice(1) : raw).replaceAll(String.raw`\*`, '.*')
        const regex = new RegExp(`^${item}$`, 'u')

        if (isExclude) {
            excludes.push(regex)
        } else {
            includes.push(regex)
        }
    }

    return { includes, excludes }
}

export const createNameFilter = (filter = '*', level?: LogLevelType): LogFilter<Logger> => {
    filter = trim(filter)

    if (filter === '*' || filter === '') {
        return () => true
    }

    const { includes, excludes } = parseFilter(filter)

    return (entry, logger) => {
        if (!isNullish(level) && entry.level > logger.getLevel(level)) {
            return true
        }

        const key = entry.name

        if (filter === '-*' || isNullish(key) || excludes.some((re) => re.test(key))) {
            return false
        }

        return includes.length === 0 || includes.some((re) => re.test(key))
    }
}
