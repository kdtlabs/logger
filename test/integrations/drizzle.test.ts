import { describe, expect, mock, test } from 'bun:test'
import { LogLevel } from '../../src/constants'
import { createDrizzleLogger, DrizzleLogger } from '../../src/integrations/drizzle'
import { Logger } from '../../src/logger'

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

        test('handles empty params', () => {
            const { logger, logSpy } = makeLogger()
            const drizzleLogger = createDrizzleLogger(logger)

            drizzleLogger.logQuery('SELECT 1', [])

            expect(logSpy.mock.calls[0]![1]).toBe('SELECT 1')
            expect(logSpy.mock.calls[0]![2]).toEqual([])
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
