import type { Colors } from 'picocolors/types'

export enum LogLevel {
    Trace = 10,
    Debug = 20,
    Info = 30,
    Warn = 40,
    Error = 50,
    Fatal = 60,
    Notice = 70,
}

export const LOG_LEVEL_NAMES = <const>{
    [LogLevel.Trace]: 'trace',
    [LogLevel.Debug]: 'debug',
    [LogLevel.Info]: 'info',
    [LogLevel.Warn]: 'warn',
    [LogLevel.Error]: 'error',
    [LogLevel.Fatal]: 'fatal',
    [LogLevel.Notice]: 'notice',
}

export const LOG_LEVEL_FORMATS: Record<LogLevel, (cl: Colors) => string> = {
    [LogLevel.Trace]: (cl) => cl.dim('TRACE '),
    [LogLevel.Debug]: (cl) => cl.gray('DEBUG '),
    [LogLevel.Info]: (cl) => cl.cyan('INFO  '),
    [LogLevel.Warn]: (cl) => cl.yellow('WARN  '),
    [LogLevel.Error]: (cl) => cl.red('ERROR '),
    [LogLevel.Fatal]: (cl) => cl.red('FATAL '),
    [LogLevel.Notice]: (cl) => cl.blue('NOTICE'),
}
