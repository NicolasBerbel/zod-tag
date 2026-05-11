# Zod Tag API Reference

## Overview

Zod Tag is a validation-first template composition library that guarantees the separation of **structure** (trusted) from **values** (untrusted) at the type level. It combines Zod schema validation with tagged template literals to create composable, type-safe rendering pipelines.

Every template produces an **interpolation tuple**:

```
[strings: string[], ...values: unknown[]]
```

- `strings` — the fixed, trusted structure, **never** containing user input  
- `values` — the validated, parameterized data  

This separation is enforced by the type system and runtime validation, making it impossible to accidentally inject values into structure.

---

## Installation

```bash
npm install zod-tag zod
```

---

## Core API

### `zt` – Main namespace
All functionality is accessed through the `zt` object.

```ts
import { z } from 'zod'
import { zt } from 'zod-tag'
```

`zt` alone is an alias for `zt.t`.

---

### `zt.t` — Typed Tag (Dynamic Templates)

Creates a renderable from a tagged template literal. The types of keyword arguments and outputs are inferred from the interpolated values.

```ts
// Static – no interpolations, no kargs
const static = zt.t`Hello World`
static.render() // → [['Hello World']]

// Primitives – void kargs
zt.t`${1}, ${'text'}`.render() // → [['', ', ', ''], 1, 'text']

// Selector functions (pure, sync)
zt.t`${() => Math.random()}`.render() // → [['', ''], 0.123...]

// Inline schemas – kargs inferred
zt.t`Name: ${z.object({ name: z.string() })}`.render({ name: 'Alice' })

// Scoped parameters
zt.t`Hello ${zt.p('user', z.string())}`.render({ user: 'World' })
```

---

### `zt.z(shape)` — Schema Tag (Validated Templates)

Creates a renderable with a Zod schema that validates all keyword arguments at render time. Supports three modes:

- `zt.z(shape)` — **loose** (default, allows extra keys)  
- `zt.z.strict(shape)` — **strict** (rejects extra keys)  
- `zt.z.strip(shape)` — **strip** (removes extra keys)

```ts
const user = zt.z({
  name: z.string(),
  email: z.email(),
})`User: ${e => e.name} <${e => e.email}>`

user.render({ name: 'Alice', email: 'a@b.com' })
// → [['User: ', ' <', '>'], 'Alice', 'a@b.com']
```

---

### `zt.p(name, schemaOrRenderable, transform?)` — Scoped Parameters

Declares a keyword argument inline.

- **With a schema** — scopes a single key and optionally transforms its output:
  ```ts
  zt.t`Email: ${zt.p('email', z.email(), e => e.toLowerCase())}`
  // render({ email: 'User@Example.com' }) → ... 'user@example.com'
  ```

- **With a renderable** — scopes a nested template’s kargs under a namespace:
  ```ts
  const button = zt.z({ label: z.string() })`<button>${e => e.label}</button>`
  const form = zt.t`Save: ${zt.p('saveBtn', button)} Cancel: ${zt.p('cancelBtn', button)}`
  form.render({ saveBtn: { label: 'Save' }, cancelBtn: { label: 'Cancel' } })
  ```

---

### `zt.match(discriminator, cases)` — Pattern Matching

Discriminated union routing. Each branch is a renderable; the discriminator selects the branch and validates only its required fields.

```ts
const cmd = zt.match('action', {
  create: zt.z({ name: z.string(), email: z.email() })`INSERT users ${e => e.name}`,
  delete: zt.z({ id: z.uuid() })`DELETE WHERE id = ${e => e.id}`,
})

cmd.render({ action: 'create', name: 'Alice', email: 'a@b.com' })
// → [['INSERT users ', ''], 'Alice']

cmd.render({ action: 'delete', id: '550e8400-...' })
// → [['DELETE WHERE id = ', ''], '550e8400-...']
```

**Note:** Extra keys from non‑selected branches are allowed only if the schema is loose (default). Strict/strip parents have limitations — see [Schema Strategies](#schema-strategies).

---

### `zt.unsafe(schema, value)` — Trusted Structure Injection

Validates a value against `schema` at creation time, then embeds the stringified result directly as **structure** (never as a value). Use only for identifiers, keywords, or protocol‑level strings that you are certain are safe.

```ts
const table = zt.unsafe(z.string().regex(/^\w+$/), 'users')
const q = zt.t`SELECT * FROM ${table}`
q.render() // → [['SELECT * FROM users']]   // table was validated and embedded as structure
```

> **⚠️ Gotcha:** Validation happens at creation time, not render time. If the value fails, an error is thrown immediately.

---

### `zt.empty` — Identity Renderable

Represents an empty structural string. Composes with any renderable and leaves it unchanged.

```ts
zt.empty.render() // → [['']]

// Identity: empty + anything == anything + empty == anything
zt.t`${zt.empty}Hello${zt.empty}`.render() === zt.t`Hello`.render()  // true
```

`zt.t`\`\` is the same reference as `zt.empty` (singleton).

---

## Composition Utilities

### `zt.bind(renderable, kargs)` — Partial Application

Binds keyword arguments to a renderable, returning a new renderable with `void` kargs. Validates `kargs` immediately at bind time.

```ts
const greet = zt.z({ name: z.string() })`Hello, ${e => e.name}!`
const greetAlice = zt.bind(greet, { name: 'Alice' })
greetAlice.render() // → [['Hello, ', '!'], 'Alice']   (no kargs required)
```

If the source renderable is async, the bound renderable will also be async (require `renderAsync()`).

### `zt.map(list, renderable, mapFn, separator?)` — Mapping

Lifts an array of data into a single composed renderable. Each element is transformed by `mapFn` into the kargs expected by `renderable`, bound, and joined with the optional `separator`.

```ts
const itemTpl = zt.z({ name: z.string(), price: z.number() })`${e => e.name}: $${e => e.price}`
const items = [{ product: 'Sword', cost: 50 }, { product: 'Shield', cost: 75 }]
const list = zt.map(items, itemTpl, i => ({ name: i.product, price: i.cost }), zt.t`, `)
list.render() // → [['', ': $', ', ', ': $', ''], 'Sword', 50, 'Shield', 75]
```

**Edge cases:**
- Empty list → returns `zt.empty`
- Single element → no separator around it

### `zt.join(list, separator?)` — Concatenation

Joins a list of renderables (or primitives) with a structural separator.

```ts
const a = zt.t`A`, b = zt.t`B`
zt.join([a, b], zt.t` | `).render() // → [['A | B']]

// Also works with primitives:
zt.join([1, 2, 3], zt.t`, `).render() // → [['', ', ', ', ', ''], 1, 2, 3]
```

**Edge cases:**
- Empty list → `zt.empty`
- Single element → that element’s output preserved, no separator added

### `zt.if(condition, renderable)` — Conditional Rendering

Returns `renderable` if `condition` is truthy, otherwise `zt.empty`.

```ts
const t = zt.z({ show: z.boolean() })`Prefix ${e => zt.if(e.show, zt.t`VISIBLE`)} Suffix`
t.render({ show: true })  // → "Prefix VISIBLE Suffix"
t.render({ show: false }) // → "Prefix  Suffix"
```

Falsy values: `false`, `0`, `""`, `null`, `undefined`.

### `zt.opaque(renderable)` — Type Erasure

Hides the output tuple type to reduce TypeScript compiler pressure in deeply nested compositions. Runtime behaviour is preserved identically.

```ts
const complex = deeplyNestedTemplate()
const safe = zt.opaque(complex)
// safe is now IRenderable<K, []> — output type hidden
```

---

## Format Utilities

These transform a rendered interpolation tuple into a formatted string.

### `zt.debug(result)` — Debug String

Concatenates everything using `String.raw`. **Never use in production** (SQL, HTML, etc.) — it bypasses all parameterization.

```ts
const res = zt.z({ x: z.number() })`Value: ${e => e.x}`.render({ x: 42 })
zt.debug(res) // → "Value: 42"
```

### `zt.$n(result)` — PostgreSQL‑style placeholders

```ts
zt.$n(res) // → "Value: $0"
```

### `zt.atIndex(result)` — Index placeholders

```ts
zt.atIndex(res) // → "Value: @0"
```

### `zt.raw(mapFn)` — Custom formatter

Creates a formatter that applies `mapFn` to each value before interpolation.

```ts
const bracket = zt.raw((v, i) => `<${i}>${v}</${i}>`)
bracket(res) // → "Value: <0>42</0>"
```

### `zt.collect(stream)` — Collect chunks to tuple

Consumes a `Generator<ZtChunk>` and returns an immutable interpolation tuple.

```ts
const gen = renderable.stream(kargs)
const [strings, ...values] = zt.collect(gen)
```

---

## Schema Strategies (strict / strip / loose)

### Strategy per Template

- **loose** (default via `zt.z(shape)`) — extra keys allowed, useful for composition.
- **strict** (`zt.z.strict(shape)`) — extra keys rejected at render time.
- **strip** (`zt.z.strip(shape)`) — extra keys silently removed.

### Scoped vs Unscoped Composition

- **Scoped children** (`zt.p('key', renderable)`) retain their **own** strategy. The parent’s strategy does not affect them.
- **Unscoped children** (direct nesting) merge into the parent’s shape and **inherit** the parent’s strategy.

### Important Limitation: Dynamic Selectors

Selectors that return renderables (e.g., conditional branching) introduce keys **at render time**, which cannot be known during compilation.

- **Strict parents** will reject those dynamic keys.
- **Strip parents** will remove them, likely causing validation failure in the child.
- **Loose parents** are required if you use dynamic selectors that introduce new kargs.

**Rule of thumb:** Reserve strict/strip for branches scoped with zt.p or top‑level templates where all keys are known at compile time. Use `zt.p` to scope dynamic sections when possible.

---

## Async & Streaming Rendering

### Async Methods

Every renderable exposes four rendering methods:

| Method | Signature | Returns | Use when |
|--------|-----------|---------|----------|
| `.render(kargs)` | synchronous | `[string[], ...values]` | No async schemas involved |
| `.renderAsync(kargs)` | asynchronous | `Promise<[string[], ...values]>` | Any async schema is present |
| `.stream(kargs)` | sync generator | `Generator<ZtChunk>` | Large templates, progressive output |
| `.streamAsync(kargs)` | async generator | `AsyncGenerator<ZtChunk>` | Async schemas + streaming |

A `ZtChunk` is either a pair `[structure, value]` or a final `[lastStructure]`.

### Async Detection & Propagation

A renderable is considered async if:
- Its schema contains an `async` transform (e.g., `z.string().transform(async () => ...)`)
- Any nested child is async

**Crucial rules:**
1. **Async function constructors** in transforms/refines are detected automatically. The renderable is flagged as async, and calling `.render()` will throw an `InterpolationError` advising to use `renderAsync()`.
2. **Returning a raw `Promise`** from a transform (e.g., `z.string().transform(() => new Promise(...))`) is **not** detected. Such schemas will **fail with a cryptic error** at render time if you call sync `.render()`, if you have such tranforms be sure to always use `.renderAsync()`/`streamAsync()`. Otherwise always use `async () => ...` when you need async validation.
3. **Selectors must be synchronous pure functions.** Returning a `Promise` from a selector violates the pipeline and will throw an `InterpolationError` with a clear message. Async operations belong in the schema, not in the selector. For now, by a design choice, the synchronous path treat Promise as primitives, the asynchronous path treat as a violation of side-effect free selectors 

```ts
// ✅ correct: async transform detected, must use renderAsync()
const t = zt.z({ name: z.string().transform(async n => n.toUpperCase()) })`Hello ${e => e.name}`
await t.renderAsync({ name: 'alice' })

// ❌ wrong: sync render() on async schema throws
t.render({ name: 'alice' }) // InterpolationError

// ❌ wrong: raw Promise in transform is NOT detected, will error at runtime
zt.t`${zt.p('x', z.string().transform(() => Promise.resolve('ok')))}`
```

### Collecting Chunks

Use `zt.collect()` to gather all chunks from a generator into a tuple:

```ts
const gen = renderable.stream(kargs)
const [strings, ...values] = zt.collect(gen)
```

For async streams, iterate manually and collect:

```ts
const chunks: ZtChunk[] = []
for await (const chunk of renderable.streamAsync(kargs)) {
  chunks.push(chunk)
}
```

---

## Error Handling

All validation errors (schema, selectors, nested renderables) are wrapped in `InterpolationError`.

```ts
import { InterpolationError } from 'zod-tag'

try {
  template.render(kargs)
} catch (e) {
  if (e instanceof InterpolationError) {
    console.log(e.message)  // human‑readable description
    console.log(e.error)    // original Zod or selector error
    console.log(e.cause)    // detailed trace with preview
  }
}
```

---

## Type Utilities

```ts
import {
  IRenderableKargs,    // extracts the kargs type of a renderable
  IRenderableOutput,   // extracts the output tuple type
  IRenderableResult,   // extracts the full [string[], ...output] type
  isRenderable,        // type guard
  type ZtChunk,        // chunk type for streams
} from 'zod-tag'
```

---

## Low‑Level API

These functions are exported but rarely needed directly.

### `createRenderable(strs, vals, schema?, scope?, trait?, merge?, asyncConfig?)`

Builds a raw renderable. Used internally by all high‑level constructors.

### `interpolate(renderable, kargs)`

Synchronous collapse of a renderable into an interpolation tuple. Equivalent to `renderable.render(kargs)`.

### `isRenderable(value)`

Type guard for renderable instances.

---

## Performance & Immutability

- Templates are compiled **once at creation** — nested structures flattened, schemas merged.
- Static templates (no interpolations) return a **pre‑computed frozen tuple** on every render.
- All output tuples and their string/value arrays are **deep frozen** via `Object.freeze`.
- Using `zt.opaque()` can reduce TypeScript compilation time for deeply nested compositions where output tuple inference explodes.

---

## Gotchas & Best Practices

1. **Async detection fragility**  
   Only `transform(async () => ...)` is reliably detected. Avoid returning raw `Promise` objects from transforms. If you must, manually ensure you always call `renderAsync()`.

2. **Strict/strip and dynamic selectors**  
   Dynamic keys introduced by selectors are invisible at compile time. Strict/strip parents will reject or lose them. Use loose parents or scoped children (`zt.p`) for dynamic sections.

3. **`zt.unsafe` validates at creation**  
   If the value fails validation, it throws immediately, not at render time.

4. **`zt.debug` bypasses all safety**  
   It concatenates values directly — never use for SQL, HTML, or command generation.

5. **Selectors must be pure and synchronous**  
   Async logic belongs in the schema’s validation pipeline (using async transforms).

6. **TypeScript compiler pressure**  
   Deeply nested templates or repeated large renderables can slow down TypeScript. Use `zt.opaque()` to hide output tuple types and relieve the compiler.

7. **Loose is default for composability**  
   `zt.z(shape)` creates a loose schema. If you need final strictness, add a strict wrapper using `zt.z.strict({ ... })` that captures the full final shape.

8. **Empty lists in `zt.map`/`zt.join` return `zt.empty`**  
   Single‑element maps/joins never add separator strings — the element’s output is returned as‑is.

---

## Example: Complex SQL Query Builder

```ts
const select = zt.p('columns', z.array(z.enum(['id','name','email'])).min(1).default(['*']),
  cols => zt.unsafe(z.string(), cols.join(', ')))

const order = zt.p('order', z.object({ col: z.string(), dir: z.enum(['ASC','DESC']).default('ASC') }).optional(),
  q => q?.col ? zt.t`ORDER BY ${zt.unsafe(z.string().regex(/^\w+$/), q.col)} ${zt.unsafe(z.enum(['ASC','DESC']), q.dir)}` : zt.empty)

const limit = zt.p('limit', z.number().int().min(1).max(1000).default(10),
  l => zt.t`LIMIT ${l}`)

const query = zt.t`
  SELECT ${select}
  FROM users
  WHERE id = ${e => e.id}
  ${order}
  ${limit}
`

const [strings, ...vals] = query.render({
  id: '550e8400-...',
  columns: ['name', 'email'],
  order: { col: 'name', dir: 'ASC' },
  limit: 20
})

// strings: ['\n  SELECT name, email\n  FROM users\n  WHERE id = ', '\n  ORDER BY name ASC\n  LIMIT ', '\n']
// vals: ['550e8400-...', 20]
```

---

For a deeper dive into design patterns and conceptual background, see the [main documentation](./DOC.md) and [README](./README.md).