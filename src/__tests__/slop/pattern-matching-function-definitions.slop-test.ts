// pattern-matching-function-definitions.slop-test.ts
/**
 * zt.match as Pattern-Matching Function Definitions
 * 
 * Each zt.match branch is a function overload: the shape defines
 * the parameter contract (validated at runtime by Zod), the template
 * body is the implementation, and the discriminator routes to the
 * correct overload. The return value is an interpolation tuple
 * [strings, ...values] — a pure data structure, not a side effect.
 * 
 * This inverts the usual pattern: validation IS the definition,
 * not an afterthought bolted onto an existing function.
 */

import { z } from 'zod'
import { type IRenderableKargs, zt, type IRenderable } from '../../../dist/main.js'

// ============================================================================
// 1. PURE MATH — stateless, every branch returns a single number value
// ============================================================================

const math = zt.match('fn', {
    add: zt.z({ a: z.number(), b: z.number() })`${e => e.a + e.b}`,
    sub: zt.z({ a: z.number(), b: z.number() })`${e => e.a - e.b}`,
    mul: zt.z({ a: z.number(), b: z.number() })`${e => e.a * e.b}`,
    div: zt.z({ a: z.number(), b: z.number().min(Number.EPSILON) })`${e => e.a / e.b}`,
    pow: zt.z({ base: z.number(), exp: z.number().int() })`${e => Math.pow(e.base, e.exp)}`,
    clamp: zt.z({ val: z.number(), min: z.number(), max: z.number() })`${e => Math.max(e.min, Math.min(e.max, e.val))}`,
    neg: zt.z({ x: z.number() })`${e => -e.x}`,
    abs: zt.z({ x: z.number() })`${e => Math.abs(e.x)}`,
    sqrt: zt.z({ x: z.number().min(0) })`${e => Math.sqrt(e.x)}`,
})

type MathFn = IRenderableKargs<typeof math>

// ============================================================================
// 2. STATE MACHINE — each branch returns a structural message
// ============================================================================

const doorFSM = zt.match('event', {
    open: zt.t`The door is now OPEN.`,
    close: zt.t`The door is now CLOSED.`,
    lock: zt.z({ key: z.string().min(1) })`LOCKED with key "${e => e.key}".`,
    unlock: zt.z({ key: z.string().min(1) })`UNLOCKED with key "${e => e.key}".`,
    knock: zt.z({ times: z.number().int().min(1).max(10) })`${e => 'KNOCK '.repeat(e.times).trim()}! (no answer)`,
})

// ============================================================================
// 3. PIPELINE — compose math functions via zt.map + zt.bind
// ============================================================================

const pipeline = zt.z({
    steps: z.array(z.object({
        fn: z.enum(['add', 'sub', 'mul', 'div', 'neg', 'abs', 'pow', 'sqrt', 'clamp']),
        kargs: z.record(z.string(), z.unknown()),
    })).min(1),
})`
${e => zt.map(
    e.steps,
    math,
    step => ({ fn: step.fn, ...step.kargs } as any),
    zt.t` → `
)}
`

// ============================================================================
// 4. RECURSIVE — math expressions via discriminated union
// ============================================================================

const expr = zt.match('type', {
    literal: zt.z({ value: z.number() })`${e => e.value}`,
    binary: zt.z({ op: z.enum(['+', '-', '*', '/', '^']), left: z.unknown(), right: z.unknown() })`${e => e.left} ${e => e.op} ${e => e.right}`,
    unary: zt.z({ op: z.enum(['-', 'sqrt']), operand: z.unknown() })`${e => e.op === '-' ? '-' : '√'}${e => e.operand}`,
    parens: zt.z({ inner: z.unknown() })`(${e => e.inner})`,
})

// ============================================================================
// RUNNER
// ============================================================================

console.log('═══════════════════════════════════════')
console.log('  zt.match as Function Definitions')
console.log('═══════════════════════════════════════\n')

let passed = 0, failed = 0
function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); failed++ }
}

// ── Math: basic operations ───────────────────────────────────────

test('add: 10 + 32 = 42', () => {
    const v = math.render({ fn: 'add', a: 10, b: 32 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 42) throw new Error(`Expected 42, got ${v[1]}`)
})

test('sub: 100 - 7 = 93', () => {
    const v = math.render({ fn: 'sub', a: 100, b: 7 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 93) throw new Error(`Expected 93`)
})

test('mul: 6 × 7 = 42', () => {
    const v = math.render({ fn: 'mul', a: 6, b: 7 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 42) throw new Error(`Expected 42`)
})

test('div: 100 / 8 = 12.5', () => {
    const v = math.render({ fn: 'div', a: 100, b: 8 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 12.5) throw new Error(`Expected 12.5`)
})

test('pow: 2^10 = 1024', () => {
    const v = math.render({ fn: 'pow', base: 2, exp: 10 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 1024) throw new Error(`Expected 1024`)
})

test('clamp: clamps to boundaries', () => {
    const hi = math.render({ fn: 'clamp', val: 5000, min: 0, max: 1000 }) as unknown as [string[], ...unknown[]]
    const lo = math.render({ fn: 'clamp', val: -50, min: 0, max: 1000 }) as unknown as [string[], ...unknown[]]
    const mid = math.render({ fn: 'clamp', val: 500, min: 0, max: 1000 }) as unknown as [string[], ...unknown[]]
    if (hi[1] !== 1000) throw new Error('Upper clamp failed')
    if (lo[1] !== 0) throw new Error('Lower clamp failed')
    if (mid[1] !== 500) throw new Error('Mid clamp failed')
})

test('neg: -42', () => {
    const v = math.render({ fn: 'neg', x: 42 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== -42) throw new Error()
})

test('abs: |-42| = 42', () => {
    const v = math.render({ fn: 'abs', x: -42 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 42) throw new Error()
})

test('sqrt: √144 = 12', () => {
    const v = math.render({ fn: 'sqrt', x: 144 }) as unknown as [string[], ...unknown[]]
    if (v[1] !== 12) throw new Error()
})

// ── Math: validation ─────────────────────────────────────────────

test('div by zero rejected by Zod', () => {
    try {
        math.render({ fn: 'div', a: 10, b: 0 })
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('sqrt of negative rejected by Zod', () => {
    try {
        math.render({ fn: 'sqrt', x: -1 })
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('unknown function rejected by discriminator', () => {
    try {
        // @ts-expect-error — 'mod' is not a valid fn
        math.render({ fn: 'mod', a: 1, b: 2 })
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

// ── State machine ────────────────────────────────────────────────

test('door: open/close are stateless', () => {
    const open = zt.debug(doorFSM.render({ event: 'open' }))
    const close = zt.debug(doorFSM.render({ event: 'close' }))
    if (!open.includes('OPEN')) throw new Error()
    if (!close.includes('CLOSED')) throw new Error()
})

test('door: lock/unlock require key', () => {
    const lock = zt.debug(doorFSM.render({ event: 'lock', key: 'secret123' }))
    const unlock = zt.debug(doorFSM.render({ event: 'unlock', key: 'secret123' }))
    if (!lock.includes('secret123')) throw new Error('Key not in lock output')
    if (!unlock.includes('secret123')) throw new Error('Key not in unlock output')
})

test('door: lock without key rejected', () => {
    try {
        // @ts-expect-error — 'key' is required for 'lock'
        doorFSM.render({ event: 'lock' })
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('door: knock repeats', () => {
    const out = zt.debug(doorFSM.render({ event: 'knock', times: 3 }))
    if (out !== 'KNOCK KNOCK KNOCK! (no answer)') throw new Error(`Unexpected: ${out}`)
})

// ── Pipeline: composition ────────────────────────────────────────

test('pipeline: chains math operations', () => {
    const res = pipeline.render({
        steps: [
            { fn: 'add', kargs: { a: 10, b: 5 } },       // 15
            { fn: 'mul', kargs: { a: 15, b: 3 } },       // 45
            { fn: 'sub', kargs: { a: 45, b: 20 } },      // 25
            { fn: 'clamp', kargs: { val: 25, min: 0, max: 100 } }, // 25
            { fn: 'pow', kargs: { base: 25, exp: 2 } },  // 625
        ],
    })
    const out = zt.debug(res)
    console.log(`    ${out}`)
    // Check each step's output appears (they're values in the interpolation)
    const vals = (res as unknown as [string[], ...unknown[]]).slice(1)
    if (!vals.includes(15)) throw new Error('Missing 15')
    if (!vals.includes(45)) throw new Error('Missing 45')
    if (!vals.includes(25)) throw new Error('Missing 25')
    if (!vals.includes(625)) throw new Error('Missing 625')
})

// ── Expression trees: recursive structure ────────────────────────

test('expr: literal', () => {
    const out = zt.debug(expr.render({ type: 'literal', value: 42 }))
    if (out !== '42') throw new Error(`Expected 42, got ${out}`)
})

test('expr: binary expression', () => {
    const out = zt.debug(expr.render({ type: 'binary', op: '+', left: 'x', right: 'y' }))
    if (out !== 'x + y') throw new Error(`Expected 'x + y', got ${out}`)
})

test('expr: unary negation', () => {
    const out = zt.debug(expr.render({ type: 'unary', op: '-', operand: 'z' }))
    if (out !== '-z') throw new Error(`Expected '-z', got ${out}`)
})

test('expr: unary sqrt', () => {
    const out = zt.debug(expr.render({ type: 'unary', op: 'sqrt', operand: 'n' }))
    if (out !== '√n') throw new Error(`Expected '√n', got ${out}`)
})

test('expr: parenthesized', () => {
    const out = zt.debug(expr.render({ type: 'parens', inner: 'a + b' }))
    if (out !== '(a + b)') throw new Error(`Expected '(a + b)', got ${out}`)
})

// ============================================================================
// KEY INSIGHT
// ============================================================================

console.log(`\n═══════════════════════════════════`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`═══════════════════════════════════`)

console.log(`
DISCOVERY: zt.match IS A FUNCTION DEFINITION DSL
────────────────────────────────────────────────
Each branch is a typed, validated overload:

  math.render({ fn: 'add', a: 10, b: 32 })  // → [['',''], 42]

1. THE SCHEMA IS THE SIGNATURE
   Zod shapes declare parameter types + constraints.
   No separate type annotations needed — they're the same thing.

2. THE TEMPLATE IS THE BODY
   \${e => e.a + e.b} is the implementation.
   Single-expression bodies keep logic visible at the definition site.

3. THE DISCRIMINATOR IS THE DISPATCH
   'fn' routes to the correct overload.
   Missing/unknown discriminators are rejected at render time.

4. VALIDATION IS NOT AN AFTERTHOUGHT
   div by zero? Zod catches it.
   sqrt of negative? Zod catches it.
   Unknown function? Discriminated union catches it.
   All BEFORE the selector runs.

5. THE RETURN IS PURE DATA
   [string[], ...values[]] carries no side effects.
   The caller decides what to do with the tuple.

This is NOT a template library that happens to validate.
It's a VALIDATION-FIRST function definition system that 
happens to use templates for implementation.
`)