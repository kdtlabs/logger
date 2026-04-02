# Code Quality

## When to Read

- Before writing, modifying, or refactoring code
- Before changing tests tied to implementation changes

## Required For

- Features
- Bug fixes
- Refactors

## Critical Rules

- Run `lint:fix` only for files changed by the current task, then run the repo typecheck command.
- Do not write duplicate logic.
- Do not duplicate declarations unless keeping them local is clearly simpler.
- Do not put too much code or logic in one file.
- Do not put too much logic in one function.
- Do not change tests to hide broken implementation.

## Lint & Typecheck Per Task

After each task, verify with the repo commands in this order:

```sh
bun run lint:fix src/module/file.ts
bun run typecheck
```

- Always run `lint:fix`, not plain `lint`.
- Scope `lint:fix` to files changed by the current task.
- This repo's `typecheck` command is project-wide (`tsc --noEmit`), so run the repo command after scoped linting.
- Let ESLint auto-fix first, then fix only what remains.
- Do not run project-wide `lint:fix` during a task.

## Logic & Reuse

- Do not write duplicate logic. If the same decision, transformation, or branch behavior appears more than once, extract or restructure it.
- Do not duplicate declarations such as `type`, `interface`, or similar definitions unless keeping them local is clearly simpler than sharing an existing declaration.
- When multiple branches produce the same kind of output, normalize input first, then use a single return.
- Do not re-check conditions that a called function already handles internally.

## File Size

- Do not put too much code in one file.
- If a file grows large or mixes responsibilities, split it into smaller focused files.
- If a file contains multiple independent flows or reusable chunks, extract them into focused functions, modules, classes, or utils.

## Function Size

- Do not put too much logic in one function.
- If a function grows long, extract sub-functions with clear names.
- Each function should do one thing.
- If a function starts reading like "Step 1 / Step 2 / Step 3", those steps should probably be separate functions.

## Test Discipline

### When tests fail

Decide whether the test is wrong or the implementation is wrong:

- Test is wrong → fix the test.
- Implementation is wrong → do not modify the test to force a pass. Stop, warn the user, and find the right fix.

### Coverage

- Target 100% code coverage for all source files.
- If 100% coverage is blocked by a runtime limitation, stop and warn the user instead of hacking around it.

### Edge cases

- Write tests for happy paths, boundaries, invalid inputs, empty inputs, extremes, coercion traps, and other relevant edge cases.
- The goal is to surface bugs in tests, not in production.
