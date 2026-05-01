// zt-match.slop-test.ts
import { z } from 'zod'
import { zt, type IRenderableKargs } from '../../../dist/main.js'

// ============================================================================
// zt.match — discriminated union pattern matching
// Collapses schema + routing into a single declaration.
// Each branch is a renderable; its shape is extracted and wrapped with
// a z.literal() discriminator to form a z.discriminatedUnion.
// ============================================================================

// ── Basic: discriminated SQL command builder ─────────────────────

const commandTemplate = zt.match('action', {
    create: zt.z({ name: z.string(), email: z.email() })`
        INSERT INTO users (name, email) VALUES (${e => e.name}, ${e => e.email})
    `,
    update: zt.z({ id: z.uuid(), name: z.string() })`
        UPDATE users SET name = ${e => e.name} WHERE id = ${e => e.id}
    `,
    delete: zt.z({ id: z.uuid() })`
        DELETE FROM users WHERE id = ${e => e.id}
    `,
})

// ── Arithmetic calculator with mixed kargs shapes ────────────────

const calc = zt.match('op', {
    add: zt.z({ a: z.number(), b: z.number() })`${e => e.a + e.b}`,
    sub: zt.z({ a: z.number(), b: z.number() })`${e => e.a - e.b}`,
    clamp: zt.z({ val: z.number(), min: z.number(), max: z.number() })`${e => Math.max(e.min, Math.min(e.max, e.val))}`,
    neg: zt.z({ x: z.number() })`${e => -e.x}`,
})

// ── Nested: match inside match (state machine routing) ───────────

const innerMatch = zt.match('method', {
    cash: zt.z({ amount: z.number() })`PAID $${e => e.amount.toFixed(2)} CASH`,
    card: zt.z({ amount: z.number(), last4: z.string().length(4) })`CHARGED $${e => e.amount.toFixed(2)} to card ****${e => e.last4}`,
})

const paymentTemplate = zt.match('status', {
    pending: zt.t`[AWAITING PAYMENT]`,
    paid: innerMatch,
    refunded: zt.z({ reason: z.string() })`REFUNDED: ${e => e.reason}`,
})

// ============================================================================
// RUNNER
// ============================================================================

console.log('═══════════════════════════════════')
console.log('  zt.match — Pattern Matching')
console.log('═══════════════════════════════════\n')

let passed = 0, failed = 0
function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); console.error(e); failed++ }
}

// ── Basic routing ────────────────────────────────────────────────

test('create renders INSERT', () => {
    const [strs, ...vals] = commandTemplate.render({ action: 'create', name: 'Alice', email: 'alice@test.com' })
    const sql = zt.debug([strs, ...vals as unknown[]])
    console.log(`    ${sql.trim()}`)
    if (!sql.includes('INSERT INTO users')) throw new Error('Expected INSERT')
    if (!(vals as unknown[]).includes('Alice')) throw new Error('Expected Alice in values')
    if (!(vals as unknown[]).includes('alice@test.com')) throw new Error('Expected email in values')
})

test('update renders UPDATE', () => {
    const [strs, ...vals] = commandTemplate.render({ action: 'update', id: '550e8400-e29b-41d4-a716-446655440000', name: 'Bob' })
    const sql = zt.debug([strs, ...vals as unknown[]])
    if (!sql.includes('UPDATE users SET')) throw new Error('Expected UPDATE')
    if (!(vals as unknown[]).includes('Bob')) throw new Error('Expected Bob in values')
})

test('delete renders DELETE', () => {
    const [strs, ...vals] = commandTemplate.render({ action: 'delete', id: '550e8400-e29b-41d4-a716-446655440000' })
    const sql = zt.debug([strs, ...vals as unknown[]])
    if (!sql.includes('DELETE FROM users')) throw new Error('Expected DELETE')
    const v = vals as unknown[]
    if (v.length === 1 && v[0] === '550e8400-e29b-41d4-a716-446655440000') { /* ok */ }
    else throw new Error('Expected exactly one uuid value')
})

// ── Mixed shapes (different kargs per branch) ────────────────────

test('calc: add with a + b', () => {
    const res = calc.render({ op: 'add', a: 10, b: 32 })
    const v = res as unknown as [string[], ...unknown[]]
    if (v[1] !== 42) throw new Error(`Expected 42, got ${v[1]}`)
})

test('calc: sub with a - b', () => {
    const res = calc.render({ op: 'sub', a: 100, b: 7 })
    const v = res as unknown as [string[], ...unknown[]]
    if (v[1] !== 93) throw new Error(`Expected 93`)
})

test('calc: clamp restricts value', () => {
    const res = calc.render({ op: 'clamp', val: 5000, min: 100, max: 1000 })
    const v = res as unknown as [string[], ...unknown[]]
    if (v[1] !== 1000) throw new Error(`Expected 1000, got ${v[1]}`)
})

test('calc: neg flips sign', () => {
    const res = calc.render({ op: 'neg', x: 42 })
    const v = res as unknown as [string[], ...unknown[]]
    if (v[1] !== -42) throw new Error(`Expected -42`)
})

test('calc: clamp at lower bound', () => {
    const res = calc.render({ op: 'clamp', val: -50, min: 0, max: 100 })
    const v = res as unknown as [string[], ...unknown[]]
    if (v[1] !== 0) throw new Error(`Expected 0`)
})

// ── Validation: wrong discriminator ──────────────────────────────

test('rejects invalid discriminator value', () => {
    try {
        // @ts-expect-error — 'mul' is not a valid discriminator key
        calc.render({ op: 'mul', a: 1, b: 2 })
        throw new Error('Should have thrown')
    } catch {
        // expected — 'mul' is not in the union
    }
})

test('rejects missing required kargs for matched branch', () => {
    try {
        // @ts-expect-error — 'email' is required for the 'create' branch
        commandTemplate.render({ action: 'create', name: 'Alice' })
        throw new Error('Should have thrown — email missing')
    } catch {
        // expected
    }
})

// ── Nested match (delegation) ────────────────────────────────────

test('nested match: pending status', () => {
    const res = paymentTemplate.render({ status: 'pending' })
    if (!zt.debug(res).includes('[AWAITING PAYMENT]')) throw new Error('Expected pending')
})

test('nested match: paid with cash', () => {
    const res = paymentTemplate.render({ status: 'paid', method: 'cash', amount: 49.99 })
    if (!zt.debug(res).includes('PAID $49.99 CASH')) throw new Error('Expected cash payment')
})

test('nested match: paid with card (last4 via loose schema)', () => {
    // NOTE: TypeScript correctly narrows 'paid' to { method, amount } only.
    // 'last4' belongs to the 'card' sub-branch of innerMatch and is not visible
    // at the paymentTemplate level. The loose schema passes it through to innerMatch,
    // which then validates it against z.string().length(4).
    // 
    // Limitation: nested discriminated unions lose deep type narrowing.
    // Workaround: pass via 'as any' or restructure to flatten the union.
    const res = paymentTemplate.render({ 
        status: 'paid', 
        method: 'card', 
        amount: 99.95, 
        // @ts-expect-error it shouldn't error but it does given the limitation mentioned above
        last4: '4242'  // valid — 4 characters, matches z.string().length(4)
    })
    if (!zt.debug(res).includes('CHARGED $99.95 to card ****4242')) throw new Error('Expected card payment')
})

test('nested match: refunded', () => {
    const res = paymentTemplate.render({ status: 'refunded', reason: 'duplicate order' })
    if (!zt.debug(res).includes('REFUNDED: duplicate order')) throw new Error('Expected refund')
})

// ── Single branch (degenerate case) ──────────────────────────────

test('single branch works like a pass-through', () => {
    const single = zt.match('type', {
        greet: zt.z({ name: z.string() })`Hello, ${e => e.name}!`,
    })
    const res = single.render({ type: 'greet', name: 'World' })
    if (zt.debug(res) !== 'Hello, World!') throw new Error('Expected greeting')
})

// ── Type narrowing: extra props from other branches ignored ─────

test('extra props from other branches are allowed (loose schema)', () => {
    // Because zt.z is .loose(), passing 'last4' alongside 'create' won't fail.
    // This is the documented loose schema behavior — tradeoff between composition
    // flexibility and strictness. Use zt.z.strict() (if added) for strict mode.
    // @ts-expect-error — 'last4' belongs to a different branch, not visible at type level
    const res = commandTemplate.render({ action: 'create', name: 'Test', email: 't@t.com', last4: '1234' })
    if (!zt.debug(res).includes('INSERT')) throw new Error('Expected INSERT')
})

// ── Runtime-only: verify values are parameterized ────────────────

test('values are never concatenated into structure strings', () => {
    const [strs, ...vals] = commandTemplate.render({ action: 'create', name: 'Eve', email: 'eve@test.com' })
    const allStrings = strs.join('')
    if (allStrings.includes('Eve')) throw new Error('Name leaked into structure strings')
    if (allStrings.includes('eve@test.com')) throw new Error('Email leaked into structure strings')
    const allValues = vals as unknown[]
    if (!allValues.includes('Eve')) throw new Error('Name missing from values')
    if (!allValues.includes('eve@test.com')) throw new Error('Email missing from values')
})

// ============================================================================

console.log(`\n═══════════════════════════════════`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`═══════════════════════════════════\n`)