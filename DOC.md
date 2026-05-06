# Zod-Tag Documentation

## Overview

Zod-Tag is a **validation-first template composition library** that guarantees the separation of structure (trusted) from values (untrusted) at the type level. It combines Zod schema validation with tagged template literals to create composable, type-safe rendering pipelines.

### Core Guarantee
```
Structure strings ∋ User data    // User data CANNOT be in structure strings
Values array ⊆ User data          // User data IS in the values array
```

This isn't a convention, it's a **provable architectural boundary** enforced by the type system.

Zod-Tag simultaneously solves through a coherent conceptual framework:
```
Selector Classification Principle
└─ e => (structure-returning-value OR primitive-value) ONLY
   ├─ Enables: Monadic composition (proven algebraically)
   ├─ Enables: Type-safe validation (selectors ARE validation)
   ├─ Enables: Security boundary (structure protected from values)
   ├─ Enables: Pattern matching (zt.match + discriminatedUnion)
   └─ Enables: Composability (zt.p scoping prevents parameter explosion)
```

### Core Pipeline

```
[Definition]    [Compile]           [Render]              [Output]
zt.z({...})` → Flatten nested   → Validate kargs   → [strings[], ...values]
               schemas          Resolve selectors
               Detect async     Apply scopes
```

---

## Installation

```bash
npm install zod-tag zod
```

---

## Quick Start

### Basic Usage

```typescript
import { z } from 'zod';
import { zt } from 'zod-tag';

// Static template - no parameters
const hello = zt.t`Hello World!`;
hello.render(); // [['Hello World!']]

// Template with primitives (no validation needed)
const greet = zt.t`Hello ${'World'}! The answer is ${42}`;
const [strings, ...values] = greet.render();
// strings: ['Hello ', '! The answer is ', '']
// values: ['World', 42]

// Template with validation
const userCard = zt.z({
  name: z.string(),
  age: z.number().positive()
})`User ${e => e.name} is ${e => e.age} years old`;

userCard.render({ name: 'Alice', age: 30 });
// [['User ', ' is ', ' years old'], 'Alice', 30]

// Invalid data throws at render time
userCard.render({ name: 'Bob', age: -5 }); // Throws InterpolationError
```

### Format Outputs

```typescript
const result = userCard.render({ name: 'Alice', age: 30 });

// Debug: concatenate everything (for display)
zt.debug(result);  // "User Alice is 30 years old"

// SQL placeholders
zt.$n(result);     // "User $0 is $1 years old"

// Index-format placeholders
zt.atIndex(result); // "User @0 is @1 years old"
```

---

## Core Concepts

### 1. Structure vs Values

Every template produces a tuple: `[strings: string[], ...values: unknown[]]`

- **Strings**: The fixed structure—always trusted, never contains user input
- **Values**: The dynamic data—always validated, never concatenated into structure

```typescript
const sql = zt.z({ id: z.string() })`SELECT * FROM users WHERE id = ${e => e.id}`;
const [strs, ...vals] = sql.render({ id: 'user-123' });
// strs: ['SELECT * FROM users WHERE id = ', '']
// vals: ['user-123']

// The structure NEVER contains 'user-123'
// SQL injection is IMPOSSIBLE by construction
```

### 2. Rendering Pipeline

```
Template Creation → Compilation → Render with Kargs → Interpolation Tuple
     (once)            (once)         (many times)       [strings[], ...values[]]
```

- **Creation**: Define the template structure and validation rules
- **Compilation**: Flatten nested templates, merge schemas, optimize for rendering
- **Render**: Validate input, resolve selectors, produce output tuple

### 3. Three Template Types

| Type | Syntax | Kargs | Use Case |
|------|--------|-------|----------|
| `zt.t` | Tagged template | Inferred from values | Simple templates, composition |
| `zt.z(shape)` | Shape + template | Shape + inferred | Validated templates |
| `zt.match(key, cases)` | Discriminated union | Union of cases | Pattern matching |

---

## API Reference

### `zt.t` - Typed Tag (Dynamic Templates)

Infer types from template values:

```typescript
// No parameters
const static = zt.t`Hello World`;
static.render(); // void

// Primitives
const prim = zt.t`${1} ${'text'} ${true}`;
prim.render(); // void

// Selector functions
const dynamic = zt.t`${() => Math.random()}`;
dynamic.render(); // void

// Inline Zod schemas (unscoped)
const withSchema = zt.t`Name: ${z.object({ name: z.string() })}`;
withSchema.render({ name: 'Alice' });

// Scoped parameters
const scoped = zt.t`Hello ${zt.p('user', z.string())}`;
scoped.render({ user: 'World' });
```

### `zt.z(shape)` - Schema Tag (Validated Templates)

Define validation rules for keyword arguments:

```typescript
const userTemplate = zt.z({
  name: z.string().min(1),
  email: z.email(),
  age: z.number().optional()
})`
  User: ${e => e.name}
  Email: ${e => e.email}
  ${e => e.age ? `Age: ${e.age}` : ''}
`;

// Schema variants
const strict = zt.z.strict({ name: z.string() })`...`;  // Reject extra keys
const strip = zt.z.strip({ name: z.string() })`...`;    // Remove extra keys
const loose = zt.z({ name: z.string() })`...`;          // Allow extra keys (default)
```

### `zt.p(name, schema|renderable, transform?)` - Scoped Parameters

Create validated parameters with optional transformations:

```typescript
// Schema-based parameter
const tpl = zt.t`Email: ${zt.p('email', z.email(), e => e.toLowerCase())}`;
tpl.render({ email: 'User@Example.com' }); // "user@example.com"

// Renderable-based parameter (scopes kargs)
const child = zt.z({ age: z.number() })`Age: ${e => e.age}`;
const parent = zt.t`Child: ${zt.p('child', child)}`;
parent.render({ child: { age: 10 } }); // "Child: Age: 10"

// Without transform (identity)
zt.p('count', z.number())
```

### `zt.match(discriminator, cases)` - Pattern Matching

Route to different templates based on a discriminator value:

```typescript
const command = zt.match('action', {
  create: zt.z({ name: z.string(), email: z.email() })`
    INSERT INTO users (name, email) VALUES (${e => e.name}, ${e => e.email})
  `,
  update: zt.z({ id: z.uuid(), name: z.string() })`
    UPDATE users SET name = ${e => e.name} WHERE id = ${e => e.id}
  `,
  delete: zt.z({ id: z.uuid() })`
    DELETE FROM users WHERE id = ${e => e.id}
  `,
});

// TypeScript narrows: e.action is 'create' → only name + email needed
command.render({ action: 'create', name: 'Alice', email: 'a@b.com' });
command.render({ action: 'delete', id: '550e8400-...' });

// Nested matching
const payment = zt.match('status', {
  pending: zt.t`[AWAITING]`,
  paid: zt.match('method', {
    cash: zt.z({ amount: z.number() })`PAID $${e => e.amount.toFixed(2)}`,
    card: zt.z({ amount: z.number(), last4: z.string().length(4) })`
      CHARGED $${e => e.amount.toFixed(2)} card ****${e => e.last4}
    `,
  }),
});
```

### Composition Utilities

#### `zt.unsafe(schema, value)` - Static Structural Injection

Inject validated values as trusted structure:

```typescript
const table = zt.unsafe(z.string().regex(/^\w+$/), 'users');
const query = zt.t`SELECT * FROM ${table} WHERE id = ${'placeholder'}`;
// ['SELECT * FROM users WHERE id = ', ''] ['placeholder']
// 'users' is STRUCTURE, 'placeholder' is VALUE
```

**⚠️ Important**: `zt.unsafe` validates at creation time. Only use for identifiers and trusted strings.

#### `zt.join(list, separator?)` - Concatenation

```typescript
const a = zt.t`A`;
const b = zt.z({ n: z.number() })`B(${e => e.n})`;
const joined = zt.join([a, b], zt.t` - `);
joined.render({ n: 42 }); // [['A - B(', ')'], 42]

// With parameterized separator
const sep = zt.z({ lang: z.enum(['en', 'fr']) })` (${e => e.lang}) `;
const joined2 = zt.join([a, b], sep);
joined2.render({ n: 42, lang: 'en' });
```

#### `zt.map(list, template, mapFn, separator?)` - Mapping

```typescript
const item = zt.z({ product: z.string(), price: z.number() })`
  ${e => e.product}: $${e => e.price}
`;

const items = [
  { product: 'Sword', cost: 50 },
  { product: 'Shield', cost: 75 },
];

const list = zt.map(items, item, i => ({ product: i.product, price: i.cost }), zt.t`, `);
list.render(); // [['', ': $', ', ', ': $', ''], 'Sword', 50, 'Shield', 75]
```

#### `zt.bind(template, kargs)` - Partial Application

```typescript
const greet = zt.z({ name: z.string() })`Hello, ${e => e.name}!`;

// Fully bound - no kargs needed
const greetWorld = zt.bind(greet, { name: 'World' });
greetWorld.render(); // [['Hello, ', '!'], 'World']

// Compose without adding kargs to parent
const combined = zt.t`${greetWorld} How are you?`;
combined.render(); // [['Hello, ', '! How are you?'], 'World']
```

#### `zt.if(condition, template)` - Conditional Rendering

```typescript
const show = zt.z({ visible: z.boolean() })`
  ${e => zt.if(e.visible, zt.t`Can you see me?`)}
`;

show.render({ visible: true });  // "Can you see me?"
show.render({ visible: false }); // ""
```

#### `zt.opaque(template)` - Type Erasure

Hide output types to reduce TypeScript compilation complexity:

```typescript
const complex = deeplyNestedTemplate();
const opaque = zt.opaque(complex); // Output type is now []
// Use when TS compiler slows down with deeply nested templates
```

---

## Design Patterns

### Pattern 1: SQL Query Builder

```typescript
const select = zt.z({ table: z.string(), columns: z.array(z.string()) })`
  SELECT ${e => zt.unsafe(z.string(), e.columns.join(', '))}
  FROM ${e => zt.unsafe(z.string().regex(/^\w+$/), e.table)}
`;

const where = zt.z({ conditions: z.record(z.unknown()) })`
  WHERE ${e => 
    zt.join(
      Object.entries(e.conditions).map(([col, val]) => 
        zt.t`${zt.unsafe(z.string().regex(/^\w+$/), col)} = ${val}`
      ),
      zt.t` AND `
    )
  }
`;

const query = zt.t`${select}${where}`;
```

### Pattern 2: Code Generator

```typescript
const field = zt.z({
  name: z.string().regex(/^[a-zA-Z_]\w*$/),
  type: z.enum(['string', 'number', 'boolean']),
  language: z.enum(['typescript', 'python']),
})`
  ${e => {
    if (e.language === 'typescript')
      return zt.t`\n  ${zt.unsafe(z.string(), e.name)}: ${e.type};`;
    return zt.t`\n    ${zt.unsafe(z.string(), e.name)}: ${e.type}`;
  }}
`;

const entity = zt.z({
  name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/),
  fields: z.array(z.object({ name: z.string(), type: z.enum(['string', 'number', 'boolean']) })),
  language: z.enum(['typescript', 'python']),
})`
  ${e => {
    const header = e.language === 'typescript' 
      ? zt.t`export class ${zt.unsafe(z.string(), e.name)} {`
      : zt.t`class ${zt.unsafe(z.string(), e.name)}:`;
    
    const body = zt.map(e.fields, field, f => ({ name: f.name, type: f.type, language: e.language }));
    const footer = e.language === 'typescript' ? zt.t`\n}` : '';
    
    return zt.t`${header}${body}${footer}`;
  }}
`;
```

### Pattern 3: LLM Prompt Engineering

```typescript
const persona = zt.match('role', {
  'senior-dev': zt.z({ xp: z.number() })`Act as a senior engineer with ${e => e.xp} years experience.`,
  mentor: zt.t`Act as a supportive mentor. Explain the *why* behind suggestions.`,
});

const format = zt.z({ format: z.enum(['diff', 'bullets', 'checklist']) })`
  [Format]: ${e => {
    const formats = {
      diff: 'Output as unified diff with inline comments.',
      bullets: 'Output as bulleted list grouped by severity.',
      checklist: 'Output as markdown checklist.',
    };
    return formats[e.format];
  }}
`;

const reviewPrompt = zt.z.strict({
  language: z.string(),
  code: z.string(),
  role: z.enum(['senior-dev', 'mentor']),
  xp: z.number().optional(),
  format: z.enum(['diff', 'bullets', 'checklist']),
})`
  [System]
  ${persona}
  ${format}
  
  Review this ${e => e.language} code:
  ${e => e.code}
`;
```

### Pattern 4: Configuration Generation

```typescript
const featureFlag = zt.z({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  enabled: z.boolean(),
  rollout: z.number().int().min(0).max(100),
})`
  ${e => zt.unsafe(z.string(), e.name)}:
    enabled: ${e => e.enabled}
    rollout: ${e => e.rollout}%
`;

const environment = zt.z({
  env: z.enum(['dev', 'staging', 'prod']),
  flags: z.array(z.object({
    name: z.string(),
    enabled: z.boolean(),
    rollout: z.number(),
  }))
})`
  # ${e => e.env} environment
  ${e => zt.map(e.flags, featureFlag, f => f, zt.t`\n`)}
`;
```

---

## Schema Strategies

### Loose (Default)

```typescript
const loose = zt.z({ name: z.string() })`Hello ${e => e.name}`;
// Allows extra kargs, useful for composition
loose.render({ name: 'Alice', extra: 'ignored' }); // Works
```

### Strict

```typescript
const strict = zt.z.strict({ name: z.string() })`Hello ${e => e.name}`;
// Rejects extra kargs, useful for final entry points
strict.render({ name: 'Alice', extra: 'nope' }); // Throws InterpolationError
```

### Strip

```typescript
const strip = zt.z.strip({ name: z.string() })`Hello ${e => e.name}`;
// Removes extra kargs silently
strip.render({ name: 'Alice', extra: 'removed' }); // Works, extra discarded
```

### Strategy Inheritance

```typescript
// Scoped child retains its own strategy
const strictParent = zt.z.strict({})`${zt.p('child', looseChild)}`;
// child can have extra keys within its scope

// Unscoped child inherits parent strategy
const strictParent = zt.z.strict({})`${looseChild}`;
// child cannot have extra keys (merged into parent's strict shape)
```

---

## Error Handling

```typescript
import { InterpolationError } from 'zod-tag';

try {
  const result = template.render(invalidKargs);
} catch (error) {
  if (error instanceof InterpolationError) {
    console.log(error.message);     // Formatted error with template preview
    console.log(error.cause);       // Trace with operation context
    console.log(error.error);       // Original Zod/selector error
  }
}
```

InterpolationError provides:
- **Template preview** showing error location with markers
- **Operation context** (root-schema, karg-schema, renderable, selector)
- **Source stacks** for template definitions
- **Operation chain** for nested template errors

---

## Best Practices

### 1. Build Loosely, Finalize Strictly
```typescript
// Reusable blocks: loose (composable)
const block = zt.z({ name: z.string() })`...`;

// Final entry point: strict (closed)
const final = zt.z.strict({/* all possible keys */})`...`;
```

### 2. Scope External Data
```typescript
// Instead of flat kargs:
const bad = zt.z({ child_name: z.string(), child_age: z.number() })`...`;

// Use scoped parameters:
const good = zt.t`Child: ${zt.p('child', zt.z({ name: z.string(), age: z.number() })`...`)}`;
```

### 3. Validate Identifiers Before `zt.unsafe`
```typescript
// ❌ Dangerous
zt.unsafe(z.string(), userInput);

// ✅ Safe
zt.unsafe(z.string().regex(/^\w+$/), validatedInput);
const column = zt.unsafe(z.enum(['id', 'name', 'email']), validatedColumn);
```

### 4. Use `zt.match` for Branching Logic
```typescript
// ❌ Multiple if/else in selector
const tpl = zt.z({ type: z.enum(['a', 'b']) })`
  ${e => e.type === 'a' ? templateA : templateB}
`;

// ✅ Discriminated union
const tpl = zt.match('type', {
  a: templateA,
  b: templateB,
});
```

### 5. Prefer `zt.t` for Static Content
```typescript
// ❌ Unnecessary schema
const title = zt.z({})`My Title`;

// ✅ Static template
const title = zt.t`My Title`;
```

### 6. Use `zt.map` + `zt.bind` Instead of Array Mapping in Selectors
```typescript
// ❌ Manual mapping in selector
const tpl = zt.z({ items: z.array(z.string()) })`
  ${e => zt.join(e.items.map(i => zt.t`- ${i}`), zt.t`\n`)}
`;

// ✅ Use zt.map with proper validation
const tpl = zt.z({ items: z.array(itemSchema) })`
  ${e => zt.map(e.items, itemTemplate, i => i, zt.t`\n`)}
`;
```

---

## Type Safety

### Extracting Types

```typescript
import { type IRenderableKargs, type IRenderableOutput } from 'zod-tag';

type GetUserParams = IRenderableKargs<typeof getUserTemplate>;
type GetUserOutput = IRenderableOutput<typeof getUserTemplate>;
```

### Type Inference Rules

- `zt.t` + primitives → `IRenderable<void, primitive[]>`
- `zt.t` + `zt.p('name', schema)` → `IRenderable<{ name: z.input<typeof schema> }, [z.output<typeof schema>]>`
- `zt.z(shape)` + template → `IRenderable<shape & inferred, inferredOutputs>`
- `zt.match(k, cases)` → `IRenderable<Union of case kargs, Union of case outputs>`
- `zt.bind(t, kargs)` → `IRenderable<void, OutputOf<typeof t>>`
- `zt.map(list, t, fn)` → `IRenderable<void, Repeated<OutputOf<typeof t>>>`
- `zt.join([a, b], sep)` → `IRenderable<KargsOf<a> & KargsOf<b> & KargsOf<sep>, [...OutputOf<a>, ...OutputOf<b>]>`

---

## Performance

- **Compilation**: Templates are compiled once at creation—nested templates are flattened
- **Static detection**: Templates without dynamic parts return pre-computed results
- **Rendering**: O(values) after compilation—no tree traversal at render time
- **Memory**: `Object.freeze` for immutability; singletons for identity templates

```typescript
// Static template = O(1) render (returns cached result)
const static = zt.t`Hello World`;
static.render(); // Returns same frozen array each time

// Dynamic template = O(values) render
const dynamic = zt.z({ n: z.number() })`Value: ${e => e.n}`;
dynamic.render({ n: 42 });
```

---

## Comparison with Alternatives

| Feature | Zod-Tag | Template Literals | Handlebars | sqltag |
|---------|---------|-------------------|------------|--------|
| Type-safe outputs | ✅ | ❌ | ❌ | Partial |
| Runtime validation | ✅ (Zod) | ❌ | ❌ | ❌ |
| Structure/value boundary | ✅ (guaranteed) | ❌ | ❌ | ✅ |
| Composition | ✅ (schema merging) | Limited | Partial | ❌ |
| Pattern matching | ✅ (zt.match) | ❌ | ❌ | ❌ |
| Scoped parameters | ✅ | ❌ | Partial | ❌ |
| SQL injection prevention | ✅ (by construction) | ❌ | ❌ | ✅ |
| Conditional rendering | ✅ | ✅ | ✅ | ❌ |

---

## API Reference Summary

| Function | Description |
|----------|-------------|
| `zt.t` | Create template with type inference |
| `zt.z(shape)` | Create validated template (loose by default) |
| `zt.z.strict(shape)` | Create validated template (reject extra keys) |
| `zt.z.strip(shape)` | Create validated template (remove extra keys) |
| `zt.match(key, cases)` | Pattern match on discriminator |
| `zt.p(name, schema, transform?)` | Scoped parameter |
| `zt.unsafe(schema, value)` | Inject validated static structure |
| `zt.bind(template, kargs)` | Partially apply kargs |
| `zt.map(list, template, mapFn, sep?)` | Map array to composed template |
| `zt.join(list, separator?)` | Join templates with separator |
| `zt.if(cond, template)` | Conditional rendering |
| `zt.opaque(template)` | Hide output types for TS performance |
| `zt.empty` | Identity template (renders to `['']`) |
| `zt.debug(result)` | Render tuple to string |
| `zt.$n(result)` | Render with `$n` placeholders |
| `zt.atIndex(result)` | Render with `@n` placeholders |
| `zt.collect(generator)` | Collect stream chunks into tuple |
| `zt.raw(transform)` | Create custom string renderer |

---

## Common Issues

### TypeScript Compilation Slows Down

Use `zt.opaque()` to hide output types:
```typescript
const complex = deeplyNestedTemplate();
const safe = zt.opaque(complex);
// safe now has Output = [] instead of full tuple type
```

### Extra Keys Rejected by Strict Parent

Add keys to shape or use loose strategy:
```typescript
// Option 1: Add to shape
const tpl = zt.z.strict({ name: z.string(), extra: z.string().optional() })`...`;

// Option 2: Use loose for composition
const child = zt.z({ name: z.string() })`...`; // loose
const parent = zt.z.strict({})`${zt.p('child', child)}`; // scoped, extra keys in child OK
```

### Dynamic Selectors with Strict Parents

Dynamic selectors can't be known at compile time—use loose parent:
```typescript
// ❌ Strict parent rejects dynamic keys
zt.z.strict({})`${e => e.show ? dynamicTemplate : zt.empty}`;

// ✅ Loose parent allows dynamic keys
zt.z({})`${e => e.show ? dynamicTemplate : zt.empty}`;
```

----

Zod-Tag is a specialized tool for high-integrity template systems where the structure/value boundary matters for security, compliance, or correctness - not a general-purpose replacement for string interpolation.