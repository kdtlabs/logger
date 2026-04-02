import type { LogEntry } from '../types'
import { type AnyObject, isObject } from '@kdtlabs/utils'

export const LOGGER_LAZY_DATA = Symbol.for('logger.lazy-data')
export const LOGGER_METADATA = Symbol.for('logger.metadata')

export const lazy = (cb: () => unknown) => ({
    [LOGGER_LAZY_DATA]: true, cb,
})

export interface LogMetadataMarker {
    [LOGGER_METADATA]: true
    metadata: Record<string, unknown>
}

export const metadata = (metadata: Record<string, unknown>): LogMetadataMarker => ({
    [LOGGER_METADATA]: true, metadata,
})

const isLazyData = (value: AnyObject): value is { cb: () => unknown } => LOGGER_LAZY_DATA in value
const isMetadata = (value: AnyObject): value is { metadata: Record<string, unknown> } => LOGGER_METADATA in value

export interface ResolveTransformerOptions {
    errors?: boolean
}

export const createResolveTransformer = ({ errors = true }: ResolveTransformerOptions = {}) => (entry: LogEntry) => {
    if (entry.data?.length) {
        let data: unknown[] | undefined
        let errors_: Error[] | undefined

        for (const item of entry.data) {
            const resolved = isObject(item) && isLazyData(item) ? item.cb() : item

            if (isObject(resolved) && isMetadata(resolved)) {
                Object.assign(entry.metadata, resolved.metadata)
            } else if (errors && resolved instanceof Error) {
                errors_ ??= []
                errors_.push(resolved)
            } else {
                data ??= []
                data.push(resolved)
            }
        }

        entry.data = data

        if (errors_?.length) {
            entry.metadata.errors = errors_
        }
    }

    return entry
}
