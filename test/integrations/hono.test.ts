import { describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'
import { LogLevel } from '../../src/constants'
import { LOGGER_TIMER } from '../../src/formatters/pretty/formatter'
import { createHonoLogger, type HonoLoggerOptions } from '../../src/integrations/hono'
import { Logger } from '../../src/logger'
import { LOGGER_METADATA } from '../../src/transformers/resolve'

const makeLogger = () => {
    const transport = mock()
    const logger = new Logger(transport, { level: 'trace' })
    const logSpy = mock()

    logger.log = logSpy

    return { logger, logSpy }
}

function makeApp(logger: Logger, options?: HonoLoggerOptions) {
    const app = new Hono()

    app.use(createHonoLogger(logger, options))
    app.get('/path', (c) => c.text('ok'))
    app.get('/other', (c) => c.text('other'))
    app.post('/submit', (c) => c.text('submitted'))
    app.get('/not-found', (c) => c.notFound())

    app.get('/error', (c) => {
        c.status(500)

        return c.text('error')
    })

    return app
}

function extractMetadataArgs(args: unknown[]) {
    const metadataArgs: Array<{ metadata: Record<string, unknown> }> = []

    for (const arg of args) {
        if (arg && typeof arg === 'object' && LOGGER_METADATA in arg) {
            metadataArgs.push(arg as unknown as { metadata: Record<string, unknown> })
        }
    }

    return metadataArgs
}

function hasTimerMetadata(args: unknown[]) {
    for (const metaArg of extractMetadataArgs(args)) {
        if (LOGGER_TIMER in metaArg.metadata) {
            return true
        }
    }

    return false
}

describe('createHonoLogger', () => {
    // ── Default options ──
    describe('default options', () => {
        test('mode defaults to single', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger)

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })

        test('level defaults to LogLevel.Info', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger)

            await app.request('/path')

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Info)
        })
    })

    // ── Single mode ──
    describe('single mode', () => {
        test('logs one entry after response', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })

        test('message format: METHOD /path STATUS #ID', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/path')

            const message = logSpy.mock.calls[0]![1]
            expect(message).toBe('GET /path 200 #1')
        })

        test('includes timer metadata', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/path')

            const args = logSpy.mock.calls[0]!
            expect(hasTimerMetadata(args)).toBe(true)
        })

        test('includes response status in message', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/error')

            const message = logSpy.mock.calls[0]![1]
            expect(message).toBe('GET /error 500 #1')
        })

        test('includes POST method in message', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/submit', { method: 'POST' })

            const message = logSpy.mock.calls[0]![1]
            expect(message).toBe('POST /submit 200 #1')
        })
    })

    // ── Double mode ──
    describe('double mode', () => {
        test('logs two entries per request', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(2)
        })

        test('incoming message format: --> METHOD /path #ID', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')

            const message = logSpy.mock.calls[0]![1]
            expect(message).toBe('--> GET /path #1')
        })

        test('outgoing message format: <-- METHOD /path STATUS #ID', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')

            const message = logSpy.mock.calls[1]![1]
            expect(message).toBe('<-- GET /path 200 #1')
        })

        test('incoming entry has no timer metadata', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')

            const incomingArgs = logSpy.mock.calls[0]!
            expect(hasTimerMetadata(incomingArgs)).toBe(false)
        })

        test('outgoing entry has timer metadata', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')

            const outgoingArgs = logSpy.mock.calls[1]!
            expect(hasTimerMetadata(outgoingArgs)).toBe(true)
        })
    })

    // ── Request ID counter ──
    describe('request ID counter', () => {
        test('increments per request within same middleware', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'single' })

            await app.request('/path')
            await app.request('/path')
            await app.request('/path')

            expect(logSpy.mock.calls[0]![1]).toBe('GET /path 200 #1')
            expect(logSpy.mock.calls[1]![1]).toBe('GET /path 200 #2')
            expect(logSpy.mock.calls[2]![1]).toBe('GET /path 200 #3')
        })

        test('each createHonoLogger call has its own counter', async () => {
            const { logger, logSpy } = makeLogger()

            const app = new Hono()
            const middleware1 = createHonoLogger(logger)
            const middleware2 = createHonoLogger(logger)

            app.use('/a/*', middleware1)
            app.use('/b/*', middleware2)
            app.get('/a/path', (c) => c.text('a'))
            app.get('/b/path', (c) => c.text('b'))

            await app.request('/a/path')
            await app.request('/b/path')

            const messageA = logSpy.mock.calls[0]![1] as string
            const messageB = logSpy.mock.calls[1]![1] as string

            expect(messageA).toContain('#1')
            expect(messageB).toContain('#1')
        })

        test('counter increments in double mode for both entries', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double' })

            await app.request('/path')
            await app.request('/other')

            expect(logSpy.mock.calls[0]![1]).toBe('--> GET /path #1')
            expect(logSpy.mock.calls[1]![1]).toBe('<-- GET /path 200 #1')
            expect(logSpy.mock.calls[2]![1]).toBe('--> GET /other #2')
            expect(logSpy.mock.calls[3]![1]).toBe('<-- GET /other 200 #2')
        })
    })

    // ── levelResolver ──
    describe('levelResolver', () => {
        test('uses default level when no resolver', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { level: LogLevel.Warn })

            await app.request('/path')

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Warn)
        })

        test('resolver overrides level for response', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                levelResolver: (type) => {
                    if (type === 'response') {
                        return LogLevel.Error
                    }

                    return void 0
                },
            })

            await app.request('/path')

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Error)
        })

        test('resolver returning undefined falls back to default', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                level: LogLevel.Warn,
                // eslint-disable-next-line unicorn/no-useless-undefined
                levelResolver: () => undefined,
            })

            await app.request('/path')

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Warn)
        })

        test('resolver receives type for both entries in double mode', async () => {
            const { logger, logSpy } = makeLogger()
            const receivedTypes: string[] = []

            const app = makeApp(logger, {
                mode: 'double',
                levelResolver: (type) => {
                    receivedTypes.push(type)

                    return type === 'request' ? LogLevel.Debug : LogLevel.Error
                },
            })

            await app.request('/path')

            expect(receivedTypes).toEqual(['request', 'response'])
            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Debug)
            expect(logSpy.mock.calls[1]![0]).toBe(LogLevel.Error)
        })

        test('resolver can set different levels for request and response', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                mode: 'double',
                levelResolver: (type) => {
                    return type === 'request' ? LogLevel.Trace : LogLevel.Fatal
                },
            })

            await app.request('/path')

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Trace)
            expect(logSpy.mock.calls[1]![0]).toBe(LogLevel.Fatal)
        })
    })

    // ── requestMetadata / responseMetadata ──
    describe('requestMetadata and responseMetadata', () => {
        test('requestMetadata merged into single entry', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                requestMetadata: () => ({ reqKey: 'reqVal' }),
            })

            await app.request('/path')

            const args = logSpy.mock.calls[0]!
            const metaArgs = extractMetadataArgs(args)
            const merged = Object.assign({}, ...metaArgs.map((m) => m.metadata))

            expect(merged).toHaveProperty('reqKey', 'reqVal')
        })

        test('responseMetadata merged into single entry', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                responseMetadata: () => ({ resKey: 'resVal' }),
            })

            await app.request('/path')

            const args = logSpy.mock.calls[0]!
            const metaArgs = extractMetadataArgs(args)
            const merged = Object.assign({}, ...metaArgs.map((m) => m.metadata))

            expect(merged).toHaveProperty('resKey', 'resVal')
        })

        test('in single mode responseMetadata overwrites requestMetadata on key collision', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                requestMetadata: () => ({ key: 'fromReq' }),
                responseMetadata: () => ({ key: 'fromRes' }),
            })

            await app.request('/path')

            const args = logSpy.mock.calls[0]!
            const metaArgs = extractMetadataArgs(args)
            const merged = Object.assign({}, ...metaArgs.map((m) => m.metadata))

            expect(merged).toHaveProperty('key', 'fromRes')
        })

        test('in double mode requestMetadata only on incoming', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                mode: 'double',
                requestMetadata: () => ({ reqKey: 'reqVal' }),
            })

            await app.request('/path')

            const incomingArgs = logSpy.mock.calls[0]!
            const outgoingArgs = logSpy.mock.calls[1]!

            const incomingMeta = extractMetadataArgs(incomingArgs)
            const outgoingMeta = extractMetadataArgs(outgoingArgs)

            const incomingMerged = Object.assign({}, ...incomingMeta.map((m) => m.metadata))
            const outgoingMerged = Object.assign({}, ...outgoingMeta.map((m) => m.metadata))

            expect(incomingMerged).toHaveProperty('reqKey', 'reqVal')
            expect(outgoingMerged).not.toHaveProperty('reqKey')
        })

        test('in double mode responseMetadata only on outgoing', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                mode: 'double',
                responseMetadata: () => ({ resKey: 'resVal' }),
            })

            await app.request('/path')

            const incomingArgs = logSpy.mock.calls[0]!
            const outgoingArgs = logSpy.mock.calls[1]!

            const incomingMeta = extractMetadataArgs(incomingArgs)
            const outgoingMeta = extractMetadataArgs(outgoingArgs)

            const incomingMerged = Object.assign({}, ...incomingMeta.map((m) => m.metadata))
            const outgoingMerged = Object.assign({}, ...outgoingMeta.map((m) => m.metadata))

            expect(incomingMerged).not.toHaveProperty('resKey')
            expect(outgoingMerged).toHaveProperty('resKey', 'resVal')
        })
    })

    // ── Enabled ──
    describe('enabled', () => {
        test('logs when enabled returns true', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { enabled: () => true })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })

        test('skips logging when enabled returns false', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { enabled: () => false })

            await app.request('/path')

            expect(logSpy).not.toHaveBeenCalled()
        })

        test('still calls next() when enabled returns false', async () => {
            const { logger } = makeLogger()
            const app = new Hono()

            app.use(createHonoLogger(logger, { enabled: () => false }))

            let handlerCalled = false

            app.get('/path', (c) => {
                handlerCalled = true

                return c.text('ok')
            })

            const res = await app.request('/path')

            expect(handlerCalled).toBe(true)
            expect(res.status).toBe(200)
        })

        test('receives logger and context as arguments', async () => {
            const { logger } = makeLogger()
            let receivedLogger: unknown
            let receivedPath: string | undefined

            const app = makeApp(logger, {
                enabled: (l, c) => {
                    receivedLogger = l
                    receivedPath = c.req.path

                    return true
                },
            })

            await app.request('/path')

            expect(receivedLogger).toBe(logger)
            expect(receivedPath).toBe('/path')
        })

        test('runs before filter', async () => {
            const { logger, logSpy } = makeLogger()
            const order: string[] = []

            const app = makeApp(logger, {
                enabled: () => {
                    order.push('enabled')

                    return false
                },
                filter: () => {
                    order.push('filter')

                    return true
                },
            })

            await app.request('/path')

            expect(order).toEqual(['enabled'])
            expect(logSpy).not.toHaveBeenCalled()
        })

        test('does not increment request counter when disabled', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { enabled: (l) => l.isEnabled })

            logger.disable()
            await app.request('/path')
            logger.enable()
            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
            expect(logSpy.mock.calls[0]![1]).toBe('GET /path 200 #1')
        })

        test('skips both entries in double mode when disabled', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double', enabled: () => false })

            await app.request('/path')

            expect(logSpy).not.toHaveBeenCalled()
        })

        test('logs normally when no enabled option is provided', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger)

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })
    })

    // ── Filter ──
    describe('filter', () => {
        test('logs when filter returns true', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { filter: () => true })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })

        test('skips logging when filter returns false', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { filter: () => false })

            await app.request('/path')

            expect(logSpy).not.toHaveBeenCalled()
        })

        test('still calls next() when filter returns false', async () => {
            const { logger } = makeLogger()
            const app = new Hono()

            app.use(createHonoLogger(logger, { filter: () => false }))

            let handlerCalled = false

            app.get('/path', (c) => {
                handlerCalled = true

                return c.text('ok')
            })

            const res = await app.request('/path')

            expect(handlerCalled).toBe(true)
            expect(res.status).toBe(200)
        })

        test('filters by path', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { filter: (c) => c.req.path !== '/other' })

            await app.request('/path')
            await app.request('/other')

            expect(logSpy).toHaveBeenCalledTimes(1)
            expect(logSpy.mock.calls[0]![1]).toBe('GET /path 200 #1')
        })

        test('filters by method', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { filter: (c) => c.req.method === 'POST' })

            await app.request('/path')
            await app.request('/submit', { method: 'POST' })

            expect(logSpy).toHaveBeenCalledTimes(1)
            expect(logSpy.mock.calls[0]![1]).toBe('POST /submit 200 #1')
        })

        test('skips both entries in double mode when filter returns false', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double', filter: () => false })

            await app.request('/path')

            expect(logSpy).not.toHaveBeenCalled()
        })

        test('logs both entries in double mode when filter returns true', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { mode: 'double', filter: () => true })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(2)
        })

        test('does not increment request counter when filtered out', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger, { filter: (c) => c.req.path !== '/other' })

            await app.request('/other')
            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
            expect(logSpy.mock.calls[0]![1]).toBe('GET /path 200 #1')
        })

        test('logs normally when no filter is provided', async () => {
            const { logger, logSpy } = makeLogger()
            const app = makeApp(logger)

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)
        })
    })

    // ── Callback error handling ──
    describe('callback error handling', () => {
        test('requestMetadata throwing returns empty metadata, no crash', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                requestMetadata: () => {
                    throw new Error('boom')
                },
            })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)

            const args = logSpy.mock.calls[0]!
            const metaArgs = extractMetadataArgs(args)
            const merged = Object.assign({}, ...metaArgs.map((m) => m.metadata))

            expect(merged).not.toHaveProperty('reqKey')
        })

        test('responseMetadata throwing returns empty metadata, no crash', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                responseMetadata: () => {
                    throw new Error('boom')
                },
            })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(1)

            const args = logSpy.mock.calls[0]!
            const metaArgs = extractMetadataArgs(args)
            const merged = Object.assign({}, ...metaArgs.map((m) => m.metadata))

            expect(merged).not.toHaveProperty('resKey')
        })

        test('requestMetadata throwing in double mode does not crash', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                mode: 'double',
                requestMetadata: () => {
                    throw new Error('boom')
                },
            })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(2)
        })

        test('responseMetadata throwing in double mode does not crash', async () => {
            const { logger, logSpy } = makeLogger()

            const app = makeApp(logger, {
                mode: 'double',
                responseMetadata: () => {
                    throw new Error('boom')
                },
            })

            await app.request('/path')

            expect(logSpy).toHaveBeenCalledTimes(2)
        })
    })
})
