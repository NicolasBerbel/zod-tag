# Schema Strategies: Loose, Strict, and Strip

This guide explains when and how to use different schema validation strategies in Zod-Tag.

## Overview

Every template can define how its keyword arguments (kargs) are validated:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `zt.z()` (loose, default) | Allows extra keys | Composable templates, intermediate layers |
| `zt.z.strict()` | Rejects extra keys | Leaf templates, final entry points |
| `zt.z.strip()` | Silently removes extra keys | Defensive parsing, legacy data |

## Quick Examples

### Loose (Default) - Composable

```ts
import { z } from 'zod';
import { zt } from 'zod-tag';

// Allows extra keys - perfect for composition
const userCard = zt.z({ name: z.string() })`
  User: ${e => e.name}
`;

userCard.render({ name: 'Alice', extra: 'ignored' }); // ✓ Works
```

### Strict - Reject Unknown Keys

```ts
// Rejects extra keys - for final entry points
const apiResponse = zt.z.strict({ 
  userId: z.string(),
  email: z.email() 
})`
  User ${e => e.userId} (<${e => e.email}>)
`;

apiResponse.render({ userId: '123', email: 'a@b.com', extra: 'error!' });
// ✗ Throws InterpolationError: 'extra' is not a recognized key
```

### Strip - Silent Removal

```ts
// Strips extra keys - safe for untrusted data
const safe = zt.z.strip({ 
  title: z.string() 
})`Title: ${e => e.title}`;

safe.render({ title: 'Hello', unknown: 'removed', other: 'gone' });
// ✓ Works, extra keys removed silently
```

## Scoped vs Unscoped Composition

The strategy behavior differs based on composition style.


### ✓ Scoped Composition (Safe with All Strategies)

Use `zt.p(name, renderable)` to scope renderables. Each child has its own schema boundary:

```ts
const child = zt.z.strict({ title: z.string() })`${e => e.title}`;

// Strict parent doesn't interfere with scoped child
const parent = zt.z.strict({})`Section: ${zt.p('body', child)}`;

parent.render({
  body: { title: 'Hello', extra: 'allowed here' } // ✓ Scoped child is loose by default
});
```

Why this works: Scoped children have their own independent schema validation boundary.

### ⚠️ Unscoped Composition (Limited with Strict/Strip)

When you nest a renderable directly (not via `zt.p`), schemas merge:

```ts
const child = zt.z({ title: z.string() })`${e => e.title}`;

// Unscoped - merged schema
const parent = zt.z.strict({})`Title: ${child}`;

parent.render({ title: 'Hello', extra: 'rejected' });
// ✗ Throws - strict parent rejects 'extra'
```

**Key limitation**: With unscoped composition and dynamic renderable selection, strict mode breaks:

```ts
// ✗ PROBLEMATIC PATTERN - Avoid this:
const template = zt.z.strict({ type: z.enum(['a', 'b']) })`
  ${e => e.type === 'a' ? templateA : templateB}
`;
// At compile time, strict parent doesn't know if templateA or templateB 
// need keys that the strict schema doesn't have
```

## Best Practice Patterns

### Pattern 1: Composable Intermediate Layer (Always Loose)

```ts
// Reusable blocks: loose for maximum composability
const userField = zt.z({ user: z.object({ id: z.string(), name: z.string() }) })`
  User: ${e => e.user.name} (${e => e.user.id})
`;

const teamField = zt.z({ team: z.array(z.string()) })`
  Team: ${e => e.team.join(', ')}
`;
```

### Pattern 2: Strict Final Entry Point

```ts
// Top-level: strict for safety
const report = zt.z.strict({
  title: z.string(),
  author: z.string(),
  timestamp: z.date(),
})`
  Report: ${e => e.title}
  By: ${e => e.author}
  At: ${e => e.timestamp}
`;

// Type-safe: can only pass these three keys
report.render({
  title: 'Q1 Report',
  author: 'Alice',
  timestamp: new Date(),
  // ✗ extra: 'rejected' would throw
});
```

### Pattern 3: Safe Data Ingestion (Strip)

```ts
// Untrusted or legacy data source
const unsafeData = zt.z.strip({
  id: z.string().uuid(),
  name: z.string().trim(),
  // Ignores any other fields
})`
  ID: ${e => e.id}
  Name: ${e => e.name}
`;

unsafeData.render({
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: '  John  ',
  __v: 1,            // ✓ Silently removed
  unknown_field: 42, // ✓ Silently removed
});
```

## From Unscoped to Scoped (Recommended for Strict Mode)

If you're using strict mode with nested renderables and hitting composition issues:

```ts
// BEFORE: Unscoped, hard to compose with strict
const strict = zt.z.strict({ name: z.string(), age: z.number() })`
  ${child}
  Name: ${e => e.name}
`;

// AFTER: Scoped, works reliably with strict
const strict = zt.z.strict({ name: z.string(), age: z.number() })`
  ${zt.p('user', child)}
  Name: ${e => e.name}
`;
// Now strict only validates its own keys; child validates in its scope
```

## Type Safety

All strategies are fully type-safe as strict and dont allow extra keys even in loose mode:

```ts
const userStrict = zt.z.strict({ name: z.string() })`${e => e.name}`;
// ✓ TypeScript knows 'name' is required, no extra keys allowed
userStrict.render({ name: 'Alice' });
// ✗ TypeScript error: 'extra' does not exist in type
userStrict.render({ name: 'Alice', extra: true });

const userLoose = zt.z({ name: z.string() })`${e => e.name}`;
// Same! ✗ TypeScript error: 'extra' does not exist in type
userLoose.render({ name: 'Alice', extra: true });
```
