import type { LogFilter, LogTransport } from '../types'
import { wrap } from '@kdtlabs/utils'

export function createFilteredTransport<T>(transport: LogTransport<T>, filters: Array<LogFilter<T>> | LogFilter<T>): LogTransport<T> {
    const filterList = wrap(filters)

    return (entry, logger) => {
        for (const filter of filterList) {
            if (!filter(entry, logger)) {
                return
            }
        }

        transport(entry, logger)
    }
}
