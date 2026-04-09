import type { Colors } from 'picocolors/types'
import pc from 'picocolors'

export const text = (str: string, colors: Colors = pc) => colors.whiteBright(str)

export const highlight = (str: string, colors: Colors = pc) => colors.bold(colors.yellow(str))

export const muted = (str: string, colors: Colors = pc) => colors.dim(str)

export const accent = (str: string, colors: Colors = pc) => colors.magenta(str)

export const badge = (str: string, colors: Colors = pc) => colors.bgRed(colors.bold(colors.whiteBright(` ${str} `)))

export const bold = (str: string, colors: Colors = pc) => colors.bold(str)
