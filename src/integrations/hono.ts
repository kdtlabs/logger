import type { Context, MiddlewareHandler } from 'hono'
import type { Logger, LogLevelType } from '../logger'
import { tryCatch } from '@kdtlabs/utils'
import { createMiddleware } from 'hono/factory'
import { LogLevel } from '../constants'
import { timer } from '../formatters/pretty/formatter'
import { metadata } from '../transformers/resolve'

export type HonoLoggerLogType = 'request' | 'response'

export interface HonoLoggerOptions {
    enabled?: (logger: Logger, context: Context) => boolean
    filter?: (context: Context) => boolean
    level?: LogLevelType
    levelResolver?: (type: HonoLoggerLogType, context: Context) => LogLevelType | undefined
    mode?: 'double' | 'single'
    requestMetadata?: (context: Context) => Record<string, unknown>
    responseMetadata?: (context: Context) => Record<string, unknown>
}

export function createHonoLogger(logger: Logger, options: HonoLoggerOptions = {}): MiddlewareHandler {
    const { enabled, filter, level = LogLevel.Info, mode = 'single', levelResolver, requestMetadata, responseMetadata } = options

    const requestMetadataFn = requestMetadata ?? (() => ({}))
    const responseMetadataFn = responseMetadata ?? (() => ({}))
    const levelFn = levelResolver ?? (() => level)

    let requestCounter = 0

    return createMiddleware(async (c, next) => {
        if (enabled && !enabled(logger, c)) {
            await next()

            return
        }

        if (filter && !filter(c)) {
            await next()

            return
        }

        const start = process.hrtime.bigint()
        const requestId = ++requestCounter
        const requestMetadata_ = tryCatch(() => requestMetadataFn(c), {})

        const method = c.req.method
        const path = c.req.path

        if (mode === 'double') {
            logger.log(levelFn('request', c) ?? level, `--> ${method} ${path} #${requestId}`, metadata(requestMetadata_))
        }

        await next()

        const responseMetadata_ = tryCatch(() => responseMetadataFn(c), {})
        const meta = mode === 'single' ? { ...requestMetadata_, ...responseMetadata_ } : responseMetadata_
        const status = c.res.status

        logger.log(levelFn('response', c) ?? level, `${mode === 'double' ? '<-- ' : ''}${method} ${path} ${status} #${requestId}`, timer(start), metadata(meta))
    })
}
