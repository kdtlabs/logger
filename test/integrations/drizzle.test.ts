import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../../src/constants'
import { createDrizzleLogger, DrizzleLogger, withDrizzleContext } from '../../src/integrations/drizzle'
import { Logger, LOGGER_LAZY_MESSAGE } from '../../src/logger'

const makeLogger = () => {
    const transport = mock()
    const logger = new Logger(transport, { level: 'trace' })
    const logSpy = mock()

    logger.log = logSpy

    return { logger, logSpy }
}

describe('createDrizzleLogger', () => {
    describe('default options', () => {
        test('level defaults to LogLevel.Debug', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT 1', [])

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Debug)
        })

        test('returns a DrizzleLogger instance', () => {
            const { logger } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            expect(drizzleLogger).toBeInstanceOf(DrizzleLogger)
        })
    })

    describe('logQuery', () => {
        test('passes query string as message', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT * FROM "users" WHERE "id" = $1', [1])

            expect(logSpy.mock.calls[0]![1]).toBe('SELECT * FROM "users" WHERE "id" = $1')
        })

        test('passes params as data', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT * FROM "users" WHERE "id" = $1', [42])

            expect(logSpy.mock.calls[0]![2]).toEqual([42])
        })

        test('omits params when empty', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT 1', [])

            expect(logSpy.mock.calls[0]![1]).toBe('SELECT 1')
            expect(logSpy.mock.calls[0]).toHaveLength(2)
        })

        test('handles multiple params', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('INSERT INTO "users" ("name", "age") VALUES ($1, $2)', ['Dan', 30])

            expect(logSpy.mock.calls[0]![2]).toEqual(['Dan', 30])
        })

        test('handles complex param types', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)
            const now = new Date()

            drizzleLogger.logQuery('SELECT $1, $2, $3, $4', [null, true, now, { nested: 'obj' }])

            expect(logSpy.mock.calls[0]![2]).toEqual([null, true, now, { nested: 'obj' }])
        })
    })

    describe('custom level', () => {
        test('uses provided level', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger, { level: LogLevel.Trace })

            drizzleLogger.logQuery('SELECT 1', [])

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Trace)
        })

        test('accepts string level', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger, { level: 'warn' })

            drizzleLogger.logQuery('SELECT 1', [])

            expect(logSpy.mock.calls[0]![0]).toBe('warn')
        })
    })

    describe('multiple calls', () => {
        test('logs each query independently', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT 1', [])
            drizzleLogger.logQuery('SELECT 2', [])
            drizzleLogger.logQuery('SELECT 3', [])

            expect(logSpy).toHaveBeenCalledTimes(3)
            expect(logSpy.mock.calls[0]![1]).toBe('SELECT 1')
            expect(logSpy.mock.calls[1]![1]).toBe('SELECT 2')
            expect(logSpy.mock.calls[2]![1]).toBe('SELECT 3')
        })
    })
})

describe('trim option', () => {
    test('trims whitespace from query when enabled', () => {
        const { logger, logSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger, { trim: true })

        drizzleLogger.logQuery('  SELECT 1  ', [])

        const msg = logSpy.mock.calls[0]![1]

        expect(msg[LOGGER_LAZY_MESSAGE]).toBe(true)
        expect(msg.toString()).toBe('SELECT 1')
    })

    test('trims tabs and newlines from query when enabled', () => {
        const { logger, logSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger, { trim: true })

        drizzleLogger.logQuery('\n\tSELECT 1\n\t', [])

        expect(logSpy.mock.calls[0]![1].toString()).toBe('SELECT 1')
    })

    test('does not trim when disabled', () => {
        const { logger, logSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger)

        drizzleLogger.logQuery('  SELECT 1  ', [])

        expect(logSpy.mock.calls[0]![1]).toBe('  SELECT 1  ')
    })

    test('does not trim when explicitly set to false', () => {
        const { logger, logSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger, { trim: false })

        drizzleLogger.logQuery('  SELECT 1  ', [])

        expect(logSpy.mock.calls[0]![1]).toBe('  SELECT 1  ')
    })

    test('trims query inside withDrizzleContext', () => {
        const { logger } = makeLogger()
        const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger, { trim: true })

        withDrizzleContext({ logger: contextLogger }, () => {
            drizzleLogger.logQuery('\n  SELECT 1  \n', [])
        })

        expect(contextLogSpy.mock.calls[0]![1].toString()).toBe('SELECT 1')
    })

    test('leaves inner whitespace intact', () => {
        const { logger, logSpy } = makeLogger()
        const drizzleLogger = createDrizzleLogger(logger, { trim: true })

        drizzleLogger.logQuery('  SELECT *  FROM  users  ', [])

        expect(logSpy.mock.calls[0]![1].toString()).toBe('SELECT *  FROM  users')
    })
})

describe('withDrizzleContext', () => {
    describe('logger override', () => {
        test('uses context logger instead of instance logger', () => {
            const { logger, logSpy } = makeLogger()
            const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: contextLogger }, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(logSpy).not.toHaveBeenCalled()
            expect(contextLogSpy).toHaveBeenCalledTimes(1)
            expect(contextLogSpy.mock.calls[0]![1]).toBe('SELECT 1')
        })

        test('falls back to instance logger when context logger is not provided', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({}, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(logSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('level override', () => {
        test('uses context level instead of instance level', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ level: LogLevel.Warn }, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Warn)
        })

        test('falls back to instance level when context level is not provided', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger, { level: LogLevel.Trace })

            withDrizzleContext({}, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(logSpy.mock.calls[0]![0]).toBe(LogLevel.Trace)
        })
    })

    describe('metadata override', () => {
        test('merges metadata via logger.with()', () => {
            const transport = mock()
            const logger = new Logger(transport, { level: 'trace' })
            const withSpy = mock()

            const fakeWithResult = { log: mock() }

            withSpy.mockReturnValue(fakeWithResult)
            logger.with = withSpy

            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ metadata: { requestId: '123' } }, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(withSpy).toHaveBeenCalledWith({ requestId: '123' })
            expect(fakeWithResult.log).toHaveBeenCalledTimes(1)
        })

        test('does not call logger.with() when metadata is not provided', () => {
            const transport = mock()
            const logger = new Logger(transport, { level: 'trace' })
            const withSpy = mock()

            logger.with = withSpy
            logger.log = mock()

            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({}, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(withSpy).not.toHaveBeenCalled()
        })
    })

    describe('combined overrides', () => {
        test('applies logger, level, and metadata together', () => {
            const { logger } = makeLogger()
            const { logger: contextLogger } = makeLogger()

            const withSpy = mock()
            const fakeWithResult = { log: mock() }

            withSpy.mockReturnValue(fakeWithResult)
            contextLogger.with = withSpy

            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: contextLogger, level: LogLevel.Error, metadata: { traceId: 'abc' } }, () => {
                drizzleLogger.logQuery('SELECT 1', [42])
            })

            expect(withSpy).toHaveBeenCalledWith({ traceId: 'abc' })
            expect(fakeWithResult.log.mock.calls[0]![0]).toBe(LogLevel.Error)
            expect(fakeWithResult.log.mock.calls[0]![1]).toBe('SELECT 1')
            expect(fakeWithResult.log.mock.calls[0]![2]).toEqual([42])
        })
    })

    describe('scope isolation', () => {
        test('does not affect queries outside the context', () => {
            const { logger, logSpy } = makeLogger()
            const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: contextLogger }, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            drizzleLogger.logQuery('SELECT 2', [])

            expect(contextLogSpy).toHaveBeenCalledTimes(1)
            expect(logSpy).toHaveBeenCalledTimes(1)
            expect(logSpy.mock.calls[0]![1]).toBe('SELECT 2')
        })

        test('supports nested contexts', () => {
            const { logger } = makeLogger()
            const { logger: outerLogger, logSpy: outerLogSpy } = makeLogger()
            const { logger: innerLogger, logSpy: innerLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: outerLogger }, () => {
                drizzleLogger.logQuery('OUTER', [])

                withDrizzleContext({ logger: innerLogger }, () => {
                    drizzleLogger.logQuery('INNER', [])
                })

                drizzleLogger.logQuery('OUTER AGAIN', [])
            })

            expect(outerLogSpy).toHaveBeenCalledTimes(2)
            expect(outerLogSpy.mock.calls[0]![1]).toBe('OUTER')
            expect(outerLogSpy.mock.calls[1]![1]).toBe('OUTER AGAIN')
            expect(innerLogSpy).toHaveBeenCalledTimes(1)
            expect(innerLogSpy.mock.calls[0]![1]).toBe('INNER')
        })
    })

    describe('async support', () => {
        test('works with async callbacks', async () => {
            const { logger } = makeLogger()
            const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            await withDrizzleContext({ logger: contextLogger }, async () => {
                await Promise.resolve()
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(contextLogSpy).toHaveBeenCalledTimes(1)
            expect(contextLogSpy.mock.calls[0]![1]).toBe('SELECT 1')
        })
    })

    describe('return value', () => {
        test('returns the callback return value', () => {
            const { logger } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            const result = withDrizzleContext({}, () => {
                drizzleLogger.logQuery('SELECT 1', [])

                return 42
            })

            expect(result).toBe(42)
        })

        test('returns async callback return value', async () => {
            const { logger } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            const result = await withDrizzleContext({}, async () => {
                await Promise.resolve()
                drizzleLogger.logQuery('SELECT 1', [])

                return 'done'
            })

            expect(result).toBe('done')
        })
    })

    describe('empty params in context', () => {
        test('omits empty params when inside context', () => {
            const { logger } = makeLogger()
            const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: contextLogger }, () => {
                drizzleLogger.logQuery('SELECT 1', [])
            })

            expect(contextLogSpy.mock.calls[0]).toHaveLength(2)
        })

        test('passes non-empty params when inside context', () => {
            const { logger } = makeLogger()
            const { logger: contextLogger, logSpy: contextLogSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            withDrizzleContext({ logger: contextLogger }, () => {
                drizzleLogger.logQuery('SELECT $1', [42])
            })

            expect(contextLogSpy.mock.calls[0]).toHaveLength(3)
            expect(contextLogSpy.mock.calls[0]![2]).toEqual([42])
        })
    })
})
