import { formatWithOptions, type InspectOptions } from 'node:util'
import { indent } from '@kdtlabs/utils'

export const resolveInspectOptions = ({ maxColumns = 80, ...options }: InspectOptions & { maxColumns?: number } = {}): InspectOptions => {
    const { depth = 6, colors = true } = options
    const { maxArrayLength = 100, maxStringLength = 100 } = options
    const breakLength = options.breakLength ?? Math.max(maxColumns, process.stdout.columns)

    return { depth, colors, maxArrayLength, maxStringLength, breakLength, ...options }
}

export interface DataPrettierOptions extends InspectOptions {
    indent?: number
    maxColumns?: number
}

export const createDataPrettier = (options: DataPrettierOptions = {}) => {
    const { indent: indentLength = 2, ...rest } = options
    const inspectOptions = resolveInspectOptions(rest)

    return (...context: any[]) => indent(formatWithOptions(inspectOptions, ...context), indentLength)
}
