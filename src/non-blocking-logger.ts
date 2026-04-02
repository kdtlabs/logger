import type { LogTransport } from './types'
import { Logger, type LoggerOptions } from './logger'

interface LogQueue {
    entries: Array<() => void>
    head: number
    scheduled: boolean
}

export interface NonBlockingLoggerOptions extends LoggerOptions {
    queue?: LogQueue
}

export class NonBlockingLogger extends Logger {
    protected readonly queue: LogQueue

    protected readonly _drain = () => this.drain()

    public constructor(transport: LogTransport, protected override readonly options: NonBlockingLoggerOptions = {}) {
        super(transport, options)

        this.queue = options.queue ?? { entries: [], head: 0, scheduled: false }
        this.options.queue = this.queue
    }

    public drain() {
        const q = this.queue

        while (q.head < q.entries.length) {
            q.entries[q.head++]!()
        }

        q.entries.length = 0
        q.head = 0
        q.scheduled = false
    }

    protected override _writeLog(level: number, args: unknown[]) {
        const q = this.queue

        q.entries.push(
            () => super._writeLog(level, args),
        )

        if (!q.scheduled) {
            q.scheduled = true
            queueMicrotask(this._drain)
        }

        return this
    }
}
