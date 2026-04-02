import type { LogEntry } from './types'
import { BaseError, type BaseErrorOptions } from '@kdtlabs/utils'

export class LoggerError extends BaseError {
    public constructor(public readonly entry: LogEntry, message: string, options?: BaseErrorOptions) {
        super(message, options)
    }
}
