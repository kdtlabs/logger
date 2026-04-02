# Agent Rules — @kdtlabs/logger

## STOP — Mandatory First Read

- Do not analyze project code, edit files, implement changes, or run project commands until this file has been read.
- After reading this file, read `docs/ARCHITECTURE.md` to understand the codebase before exploring source files.
- If the task touches code, read the routed rule files below before continuing.
- `AGENTS.md` is the canonical project rule file. `CLAUDE.md` only points here.

## Task Routing

- Write or modify code → read `docs/rules/CODE_QUALITY.md` and `docs/rules/CODE_STYLE.md`, and load the `kdtlabs-utils` skill
- Review, plan, or edit docs only → read this file only unless the task also changes code or rule content
- Edit the rule system itself → read this file and only the affected rule files
- Mixed tasks → read every relevant rule file before continuing

## Dependencies

- This project depends on `@kdtlabs/utils`. Before writing code, load the `kdtlabs-utils` skill (`.claude/skills/utils/SKILL.md`) to know which utility functions are already available. Do not reimplement functions that exist in `@kdtlabs/utils`.

## Critical Rules Summary

- Do not write duplicate logic.
- Do not duplicate declarations unless keeping them local is clearly simpler.
- Do not put too much code or logic in one file.
- Do not put too much logic in one function.
- All control-flow statements use full multi-line brace blocks.
- Do not modify tests to hide broken implementation.
- Run `lint:fix` only for files changed by the current task, then run the repo typecheck command.
- After any code change that alters architecture, modules, types, pipeline, patterns, or extension points, update `docs/ARCHITECTURE.md` to reflect the current state.

## Rule Maintenance

- Keep `AGENTS.md` as the router and short-summary file.
- Put full rule wording in the most specific rule file.
- If a rule change affects routing, critical summaries, or rule-file descriptions, update `AGENTS.md` too.
- For child-owned rules, keep only a one-line summary in `AGENTS.md`.
- Preserve the task-based modular layout so agents read only relevant rule files.
- Prefer rewriting, reordering, and compressing wording over expanding the rule surface.

## Directory Layout

```text
├── src/                  ← source code, organized by module
│   ├── index.ts          ← root barrel: re-exports everything
│   ├── base.ts           ← base logger class
│   ├── logger.ts         ← main logger implementation
│   ├── types.ts          ← shared types
│   ├── constants.ts      ← shared constants
│   ├── filters/          ← log filter implementations
│   │   ├── index.ts      ← barrel: re-exports all filters
│   │   └── <name>.ts     ← individual filter
│   ├── formatters/       ← log formatter implementations
│   │   ├── index.ts      ← barrel: re-exports all formatters
│   │   └── <name>/       ← complex formatter with sub-modules
│   ├── transformers/     ← log transformer implementations
│   │   ├── index.ts      ← barrel: re-exports all transformers
│   │   └── <name>.ts     ← individual transformer
│   └── transports/       ← log transport implementations
│       ├── index.ts      ← barrel: re-exports all transports
│       └── <name>.ts     ← individual transport
├── test/                 ← mirrors src/ structure
│   └── <module>/
│       └── <name>.test.ts
├── scripts/              ← build and release scripts
│   ├── build.ts
│   └── release.ts
├── docs/ARCHITECTURE.md  ← codebase map for AI agents (pipeline, modules, types, patterns)
├── docs/rules/           ← agent rule files (SCREAMING_SNAKE_CASE.md)
├── AGENTS.md             ← canonical project rules (this file)
└── CLAUDE.md             ← points to AGENTS.md and docs/ARCHITECTURE.md
```

### Current modules under `src/`

`filters` · `formatters` · `transformers` · `transports`

### Where to place new files

- **New filter/formatter/transformer/transport** → add a source file under the matching `src/<module>/`, export it from the module `index.ts`, and add a test file in the mirrored path.
- **New module category** → create `src/<module>/index.ts` (barrel only), add the module to `src/index.ts`, create matching `test/<module>/` folder.
- **Complex implementation** → dedicated file `src/<module>/<name>.ts` or subfolder `src/<module>/<name>/`.
- **Short/simple implementations** → may share one file when closely related.

### Test mirroring rules

- Individual source file → test file at the same relative path: `src/filters/name.ts` → `test/filters/name.test.ts`.
- Complex source with subfolder → test subfolder mirroring source: `src/formatters/pretty/` → `test/formatters/pretty/`.
- Each test file covers exactly one module or class.

## Project-Wide Rules

### Naming

- All `.ts` files use `kebab-case`.
- Test files use `<name>.test.ts`.
- All `.md` files use `SCREAMING_SNAKE_CASE`.
- Variables, functions, methods, and properties use `camelCase`.
- Classes, interfaces, and types use `PascalCase`.
- Constants use `SCREAMING_SNAKE_CASE`.
- Shared names must be unique within their scope. Avoid generic names like `Options`, `Result`, or `Config`.

### Exports

- Export everything that can be exported.
- Prefer explicit exports over keeping things private by default.

### File Structure

- Function-specific options or class-specific config types stay in the same file as the function/class that uses them.
- `index.ts` files are barrel files only. No logic.

### Git

- Do not perform git operations unless the user explicitly requests them.

### Do Not

- Do not turn `CLAUDE.md` into a second detailed rule file.
- Do not dump workflow-specific detail into `AGENTS.md`.

## Rule Files

- `docs/ARCHITECTURE.md` — codebase map: pipeline, modules, types, patterns, extension points
- `docs/rules/CODE_QUALITY.md` — implementation quality, reuse, file/function size, tests, scoped verification
- `docs/rules/CODE_STYLE.md` — layout, formatting, declaration grouping, control-flow style, class structure
