import type { LogEntry, LogTransport } from '../types'
import { chunk, createDeferred, type DeferredPromise, entries, tryCatch, withTimeout } from '@kdtlabs/utils'

export type AsyncLogTransport<T = unknown> = (entry: LogEntry, logger: T) => Promise<void>

export interface AsyncTransportError {
    error: unknown
    transport: string
}

export type OnAsyncTransportError<T> = (errors: AsyncTransportError[], entry: LogEntry, logger: T) => void

export interface AsyncTransportOptions<T> {
    concurrency?: number
    maxQueueSize?: number
    onError?: OnAsyncTransportError<T>
    onQueueFull?: (entry: LogEntry, logger: T) => void
    timeout?: number
}

export interface AsyncTransportResult<T> {
    flush: () => Promise<void>
    transport: LogTransport<T>
}

async function process<T>(chunks: Array<Array<[string, AsyncLogTransport<T>]>>, entry: LogEntry, logger: T, timeout: number, onError?: OnAsyncTransportError<T>) {
    let errors: AsyncTransportError[] | undefined

    const onTransportError = (name: string, error: unknown) => {
        errors ??= []
        errors.push({ error, transport: name })
    }

    for (const transports of chunks) {
        await Promise.allSettled(transports.map(async ([name, transport]) => {
            await withTimeout(transport(entry, logger), timeout).catch((error) => onTransportError(name, error))
        }))
    }

    if (errors?.length && onError) {
        tryCatch(() => onError(errors!, entry, logger), void 0)
    }
}

export function createAsyncTransport<T>(transports: Record<string, AsyncLogTransport<T>>, { concurrency = Infinity, onError, onQueueFull, timeout = 5000, maxQueueSize = 1000 }: AsyncTransportOptions<T> = {}): AsyncTransportResult<T> {
    const queue = new Set<[entry: LogEntry, logger: T]>()
    const transportEntries = entries(transports)
    const transportList = concurrency < Infinity ? chunk(transportEntries, concurrency) : [transportEntries]

    let pending: DeferredPromise<void> | undefined

    const run = () => {
        const entry = queue.values().next().value

        if (!entry) {
            pending?.resolve()
            pending = undefined

            return
        }

        queue.delete(entry)

        process(transportList, entry[0], entry[1], timeout, onError).finally(() => {
            run()
        })
    }

    return {
        flush: async () => pending,
        transport: (entry: LogEntry, logger: T) => {
            if (queue.size >= maxQueueSize) {
                return onQueueFull?.(entry, logger)
            }

            queue.add([entry, logger])

            if (!pending) {
                pending = createDeferred()
                run()
            }
        },
    }
}
