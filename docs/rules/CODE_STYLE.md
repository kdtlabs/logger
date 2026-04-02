# Code Style

## When to Read

- Before writing or modifying code
- Before style cleanup or structural refactors

## Required For

- All code changes
- Declaration layout changes
- Class structure changes

## Critical Rules

- Group variable declarations by kind first, then by form.
- Keep destructuring declarations separate from plain declarations.
- All control-flow statements use full multi-line brace blocks.
- Avoid comments unless they are truly necessary.
- Extract complex type expressions into named type aliases.
- Extract multi-statement inline callbacks into named functions.

## Declaration Layout

- Declare function, method, and class signatures on a single line.
- Single-line variable declarations (`const` / `let` / `var`) must be grouped by declaration kind first, then by declaration form.
- Keep `const`, `let`, and `var` in separate groups.
- Keep destructuring declarations in separate groups from plain identifier declarations.
- Do not add blank lines inside a declaration group. Separate different groups with one blank line.
- `export type` statements must be at the bottom of barrel files, separated from other exports by a blank line.

## Control-Flow Formatting

- All control-flow statements must be full multi-line blocks with braces.
- Never use one-line `if`, `else`, `for`, `while`, `do...while`, `for...of`, or `for...in` statements.
- This also applies to early `return`, `continue`, `break`, and `throw` inside control-flow statements.

## General Style Rules

- Do not declare a return type when TypeScript already infers it correctly. Declare one only when the intended type is broader or different.
- Avoid comments. Prefer clearer naming and simpler structure.
- Barrel files must use `export * from './module'`.
- Extract complex or long type expressions into named type aliases.
- Never use `eslint-disable` or `ts-ignore` unless there is no real alternative.
- Inline callbacks must be a single expression on one line. If they need multiple statements, extract them into a named function first.
- Destructure options objects in the parameter list unless doing so would make the signature too long to read on one line.

## Class Member Ordering

Class members must follow this top-to-bottom order:

1. Properties
2. Constructor
3. Static methods
4. Getters
5. Setters
6. Instance methods

Additional rules:

- Properties stay at the top.
- Group properties by access modifier in this order: `public` → `protected` → private `#`.
- Within an access group, order members as `static readonly` → `static` → `readonly` → non-readonly.
- Leave a blank line between property groups.
- Do not leave blank lines between properties inside the same group.
- Leave a blank line between every getter, setter, and method.
- Order static methods, getters, setters, and instance methods by access modifier: `public` → `protected` → private `#`.

## Class Access Modifier Preferences

- Prefer `protected` over `private` unless there is a reason to hide behavior from subclasses.
- Private members must use `#` syntax, not the `private` keyword.
