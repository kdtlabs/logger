import type { LogEntry, LogTransport } from '../types'
import { createSerializer, isJsonablePrimitive, isString, type SerializeOptions, stripAnsi, typeOf } from '@kdtlabs/utils'
import { LOGGER_TIMER } from '../formatters'

export interface ConsoleTransportOptions {
    formatter?: (entry: LogEntry) => string
    onError?: (error: unknown) => void
    stream?: NodeJS.WritableStream
}

export function createDefaultConsoleFormatter(options?: SerializeOptions) {
    const serializer = createSerializer(options)

    return (e: LogEntry) => {
        const entry = isString(e.message) ? { ...e, message: stripAnsi(e.message) } : e

        return JSON.stringify(entry, (key, value) => {
            const valType = typeOf(value)

            if (key === 'metadata' && valType === 'object' && LOGGER_TIMER in value) {
                return { ...value, timer: `${value[LOGGER_TIMER]}n` }
            }

            if (valType === 'object' || valType === 'array' || valType === 'undefined') {
                return value
            }

            if (valType === 'bigint') {
                return `${value}n`
            }

            if (isJsonablePrimitive(value)) {
                return value
            }

            return serializer(value)
        })
    }
}

export const createConsoleTransport = ({ formatter = createDefaultConsoleFormatter(), onError, stream = process.stdout }: ConsoleTransportOptions = {}): LogTransport => (entry: LogEntry) => {
    try {
        stream.write(`${formatter(entry)}\n`)
    } catch (error) {
        onError?.(error)
    }
}
