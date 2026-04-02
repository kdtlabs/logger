import type { LogEntry } from '../types'
import type { AsyncLogTransport } from './async'
import { existsSync, unlinkSync } from 'node:fs'
import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type DayOfWeek, ensureDirectory, formatDate, isErrnoException, isMissingDirectoryError, isWritableDirectory, resolveInterval, resolveOptions, resolvePath, subtractInterval, type TimeInterval, transform } from '@kdtlabs/utils'
import { createDefaultConsoleFormatter } from './console'

export interface FileRotateOptions {
    filename?: (interval: TimeInterval, date: Date, name: string, extension: string) => string
    interval?: TimeInterval
    maxFiles?: number
    weekStartsOn?: DayOfWeek
}

export interface FileTransportConfig {
    dir: string
    extension?: string
    formatter?: (entry: LogEntry) => string
    name?: string
    onError?: (error: unknown) => void
    rotate?: FileRotateOptions | boolean
}

const DATE_FORMATS: Record<TimeInterval, string> = {
    hourly: 'yyyy-MM-dd-HH',
    daily: 'yyyy-MM-dd',
    weekly: 'yyyy-MM-dd',
    monthly: 'yyyy-MM',
    yearly: 'yyyy',
}

export const defaultFileNameFormatter = (interval: TimeInterval, date: Date, name: string, extension: string) => {
    return `${name.length > 0 ? `${name}.` : ''}${formatDate(date, DATE_FORMATS[interval])}${extension}`
}

export function createFileTransport<T>({ formatter = createDefaultConsoleFormatter(), dir, extension = '.log', name = '', rotate = true, onError }: FileTransportConfig): AsyncLogTransport<T> {
    const { enabled: rotateEnabled, interval = 'daily', weekStartsOn, maxFiles = 10, filename = defaultFileNameFormatter } = transform(resolveOptions(rotate, {}), (opts) => (opts === false ? { enabled: false } : { enabled: true, ...opts }))

    if (!rotateEnabled && name.length === 0) {
        throw new Error('Name must be present when log rotate is disabled')
    }

    const logDir = resolvePath(dir)
    const isValidMaxFiles = Number.isFinite(maxFiles) && maxFiles > 0

    if (!isWritableDirectory(logDir)) {
        throw new Error('Directory for file log is not writable')
    }

    const staticLogPath = !rotateEnabled && join(logDir, `${name}${extension}`)

    if (staticLogPath) {
        ensureDirectory(logDir)
    }

    let nextBoundary: number | undefined
    let currentFilePath: string | undefined

    const filePath = (timestamp: number) => {
        if (staticLogPath) {
            return staticLogPath
        }

        if (!currentFilePath || !nextBoundary || timestamp >= nextBoundary) {
            ensureDirectory(logDir)

            nextBoundary = resolveInterval(interval, 'end', { weekStartsOn, now: timestamp }).getTime() + 1
            currentFilePath = join(logDir, filename(interval, new Date(timestamp), name, extension))

            if (isValidMaxFiles) {
                const expired = subtractInterval(interval, maxFiles, 'start', { weekStartsOn, now: timestamp })
                const expiredPath = join(logDir, filename(interval, expired, name, extension))

                if (existsSync(expiredPath)) {
                    unlinkSync(expiredPath)
                }
            }
        }

        return currentFilePath
    }

    return async function transport(entry: LogEntry, logger: T, checked = false): Promise<void> {
        try {
            await appendFile(filePath(entry.timestamp), `${formatter(entry)}\n`, { encoding: 'utf8' })
        } catch (error) {
            if (!checked && isErrnoException(error) && isMissingDirectoryError(error)) {
                ensureDirectory(logDir)

                return transport(entry, logger, true)
            }

            onError?.(error)
        }
    }
}
