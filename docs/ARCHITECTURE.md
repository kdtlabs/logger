# Architecture — @kdtlabs/logger

Structured, extensible logging library for Node.js. Pipeline-based: log entries flow through filters, transformers, then transports.

**Stack**: TypeScript 6, ESM, Bun runtime, `@kdtlabs/utils`, `picocolors`, `clean-stack`

## Pipeline

```text
Logger.log(level, ...args)
  │
  ├─ getLevel(level)           ← resolve to numeric level
  ├─ isLevelEnabled(level)     ← early exit before building entry
  │
  ▼
Logger._writeLog(level, args)
  │
  ├─ build LogEntry { timestamp, level, name, message, data, metadata }
  │
  ▼
BaseLogger.writeLog(entry)
  │
  ├─ isEntryLoggable(entry)    ← isLevelEnabled + filters[]
  ├─ transform(entry)          ← transformers[]; mutate/replace/drop
  │
  ▼
transport(entry, logger)       ← output to console, combined targets, etc.
```

## Core Classes

### BaseLogger (`src/base.ts`)

Abstract base. Owns the pipeline: level gating, filter chain, transformer chain, transport dispatch.

- `writeLog(entry)` — main pipeline entry point
- `addFilter/removeFilter`, `addTransformer/removeTransformer` — runtime pipeline mutation
- `enable()/disable()` — toggle logging
- `isLevelEnabled(level)` — walks parent chain
- `onError` callback or throws `LoggerError`

### Logger (`src/logger.ts`) extends BaseLogger

User-facing class. Adds named levels, metadata, child loggers.

- `constructor(transport, options)` — sets level, metadata (`hostname`, `pid`), filters, transformers
- `getLevel(level)` — resolves `LogLevelType` (enum or string name) to numeric value
- `getLevelName(level)` — resolves numeric level to string name
- `isLogLevelEnabled(level)` — public check whether a `LogLevelType` would pass level gating (resolves level, delegates to `isLevelEnabled`)
- `trace/debug/info/warn/error/fatal/notice(...args)` — convenience methods calling `log()`
- `log(level, ...args)` — resolves level, early-exits via `isLevelEnabled`, then builds `LogEntry` from args (string message, lazy message, or raw data)
- `child(options)` — creates child with inherited/merged filters, transformers, metadata, concatenated name
- `with(metadata)` — lightweight prototype clone with extra metadata (no new instance)
  Standalone helpers:

- `message(fn)` — factory returning lazy message object via `LOGGER_LAZY_MESSAGE` symbol, evaluated only if level passes

### NonBlockingLogger (`src/non-blocking-logger.ts`) extends Logger

Deferred logging variant. Queues `_writeLog` calls and drains them via `queueMicrotask`. Child loggers share the same queue.

- `drain()` — flush all queued entries synchronously

## Types (`src/types.ts`)

```ts
LogEntry     { timestamp, level, name?, message?, data?, metadata }  // metadata is required
LogFilter    (entry, logger) => boolean           // true = pass
LogTransformer (entry, logger) => entry | false | nullish  // false/nullish = drop
LogTransport   (entry, logger) => void
```

## Log Levels (`src/constants.ts`)

Trace=10, Debug=20, Info=30, Warn=40, Error=50, Fatal=60, Notice=70. Levels can be referenced by enum value or string name.

## Modules

### Filters (`src/filters/`)

**name.ts** — `createNameFilter(filter, level?)`: wildcard pattern matching on `entry.name`. Supports `*` wildcard, `-prefix` exclusion, comma-separated patterns. Optional `level` param acts as a bypass threshold — entries with `level > threshold` skip the name filter (always pass).

**level.ts** — `createLevelFilter(level)`: minimum level gate. Passes entries whose `level >= minLevel`. Accepts `LogLevel` enum or string name. Resolves level via `logger.getLevel()`.

### Transformers (`src/transformers/`)

**resolve.ts** — `createResolveTransformer(options)`: resolves lazy data, extracts metadata markers into `entry.metadata`, collects Error instances into `metadata.errors`.

Helpers: `lazy(cb)` — factory for deferred data evaluation; `metadata(obj)` — factory for metadata injection.

Symbols: `LOGGER_LAZY_DATA`, `LOGGER_METADATA`.

### Transports (`src/transports/`)

**console.ts** — `createConsoleTransport(options)`: writes formatted entry to a stream (default `stdout`). Also exports `createDefaultConsoleFormatter(options?)` — JSON serialization with bigint and timer support, used as default formatter. Strips ANSI escape codes from `message` before serialization via `stripAnsi`.

**combine.ts** — `createCombineTransport(transports, options)`: fans out to multiple named transports. Handles errors per-transport. Failing transports are recorded in `LOGGER_EXCLUDE_TRANSPORTS` metadata — subsequent calls skip them if the same entry is reused. Exports `excludeTransports(names)` helper and `getExcludedTransports(entry)` reader.

**async.ts** — `createAsyncTransport(transports, options)`: wraps multiple `AsyncLogTransport` functions into a sync `LogTransport`. Returns `AsyncTransportResult<T>` with `{ transport, flush }`. Entries are queued and processed serially (FIFO). Per entry, transports run in parallel with configurable `concurrency` (chunk-based) and per-transport `timeout` via `withTimeout`. Backpressure via `maxQueueSize` / `onQueueFull`. Errors collected per entry and passed to optional `onError`.

**filtered.ts** — `createFilteredTransport(transport, filters)`: wrapper that gates a transport behind a filter chain. Accepts a single `LogFilter` or `LogFilter[]`. Runs all filters; skips the inner transport silently if any filter returns `false`.

**file.ts** — `createFileTransport(config)`: async file transport with log rotation. Returns `AsyncLogTransport<T>`. Writes formatted entries via `appendFile`. Supports rotation by interval (`hourly`, `daily`, `weekly`, `monthly`, `yearly`), configurable `maxFiles` cleanup, and custom filename formatting. Config: `dir` (required), `extension`, `name`, `formatter` (defaults to JSON console formatter), `rotate` (`boolean | FileRotateOptions`), `onError`. Also exports `defaultFileNameFormatter` helper.

### Formatters (`src/formatters/pretty/`)

**formatter.ts** — `createPrettyFormatter(options)`: produces colored, human-readable output. Formats timestamp, level badge, pid, name, message, errors, metadata, data. Exports `timer(start)` helper that records elapsed time via `LOGGER_TIMER` symbol for display in formatted output.

**data.ts** — `createDataPrettier(options)`: wraps `util.formatWithOptions` for inspecting arbitrary data with color and indentation.

**error.ts** — `createErrorPretty(colors, options)`: formats errors with type badge, cleaned stack, nested cause/AggregateError support.

### Integrations (`src/integrations/`)

Framework-specific middleware that pipes structured logging through the `@kdtlabs/logger` pipeline. Exported via subpath exports (e.g., `@kdtlabs/logger/hono`) — not re-exported from the main barrel to avoid leaking framework types to consumers who don't use them.

**hono.ts** — `createHonoLogger(logger, options?)`: Hono middleware factory. Logs HTTP requests/responses with configurable single (one entry after response) or double (incoming + outgoing) mode. Uses `timer()` for duration tracking and `metadata()` for entry injection. Options: `enabled(logger, context)` (first check — return false to skip all logging, next() still called), `filter(context)` (return false to skip logging, next() still called), `mode`, `level`, `levelResolver(type, context)`, `requestMetadata(context)`, `responseMetadata(context)`. Exports `HonoLoggerOptions` interface and `HonoLoggerLogType` union type.

**drizzle.ts** — `createDrizzleLogger(logger, options?)`: Implements DrizzleORM's `Logger` interface to pipe SQL query logs through the pipeline. Calls `logger.log(level, query, params)` — query string becomes `message`, params become `data` (omitted when empty). Default level: `Debug`. Options: `level` (override default level), `trim` (trim whitespace/tabs/newlines from query via `@kdtlabs/utils` `trim`). Exports `DrizzleLogger` class, `DrizzleLoggerOptions` interface, `DrizzleContextOptions` interface, and `withDrizzleContext(options, fn)` — scoped context via `AsyncLocalStorage` that overrides `logger`, `level`, and/or `metadata` for all `DrizzleLogger.logQuery` calls within the callback. Metadata is applied via `logger.with(metadata)`. Supports sync and async callbacks, nested contexts, and transparent fallback to instance defaults when options are omitted.

## Error Handling (`src/error.ts`)

`LoggerError` extends `BaseError` from `@kdtlabs/utils`. Wraps the original `LogEntry` that caused the error.

## Styles (`src/styles.ts`)

Semantic text formatting utils built on `picocolors`. Each accepts an optional second `Colors` parameter (defaults to global `pc`), allowing pretty formatter to pass its color-aware instance.

- `text(str, colors?)` — `whiteBright`
- `highlight(str, colors?)` — `bold(yellow())`
- `muted(str, colors?)` — `dim`
- `accent(str, colors?)` — `magenta`
- `badge(str, colors?)` — `bgRed(bold(whiteBright()))` with space padding
- `bold(str, colors?)` — `bold`

Used internally by pretty formatter and error formatter. Exported for callers to format log messages with consistent styling.

## Key Patterns

- **Factory functions** — all filters, transformers, transports, formatters are created via `create*()` factories returning closures
- **Barrel exports** — each module has `index.ts` re-exporting everything; root `src/index.ts` re-exports all modules
- **Symbol markers** — `LOGGER_LAZY_MESSAGE`, `LOGGER_LAZY_DATA`, `LOGGER_METADATA`, `LOGGER_EXCLUDE_TRANSPORTS`, `LOGGER_TIMER` — all use `Symbol.for()` keys on data objects
- **Chainable API** — `Logger` methods return `this` via `tap()` for chaining
- **Parent chain** — `isLevelEnabled()` walks up the parent chain; child inherits parent's level gate

## Typical Usage

```ts
const transport = createConsoleTransport({
    formatter: createPrettyFormatter(),
})

const logger = new Logger(transport, {
    level: 'info',
    name: 'app',
    transformers: [createResolveTransformer()],
})

logger.info('started')
logger.child({ name: 'db' }).warn('connection slow', { latency: 150 })
logger.with({ requestId: '123' }).error('failed', new Error('timeout'))
```

## Extension Points

| To add a...     | Create                    | Place in                     | Wire via                                           |
| --------------- | ------------------------- | ---------------------------- | -------------------------------------------------- |
| New filter      | `LogFilter` function      | `src/filters/<name>.ts`      | `Logger` options or `addFilter()`                  |
| New transformer | `LogTransformer` function | `src/transformers/<name>.ts` | `Logger` options or `addTransformer()`             |
| New transport   | `LogTransport` function   | `src/transports/<name>.ts`   | `Logger` constructor or `createCombineTransport()` |
| New formatter   | Formatter function        | `src/formatters/<name>/`     | Passed to transport's `formatter` option           |
| New integration | Middleware factory        | `src/integrations/<name>.ts` | Subpath export `@kdtlabs/logger/<name>`            |
