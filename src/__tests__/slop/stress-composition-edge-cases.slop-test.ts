// stress-composition-edge-cases.slop-test.ts
import { z } from 'zod'
import { zt } from '../../../dist/main.js'

/**
 * STRESS TEST SUITE 2: Schema Conflicts, Type System, Output Edge Cases
 * 
 * Tests what happens at the boundaries of composition:
 * - Conflicting schemas across nested templates
 * - Deeply nested conditional composition
 * - Selectors returning different renderable types
 * - Output format edge cases (leading/trailing/adjacent values)
 * - Scoped + unscoped mixing
 * - Performance with large lists
 */

// ============================================================================
// TEST HELPERS
// ============================================================================

console.log('\n═══════════════════════════════════════')
console.log('  STRESS: COMPOSITION EDGE CASES')
console.log('═══════════════════════════════════════\n')

let passed = 0, failed = 0

function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); console.error(e); failed++ }
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
}

function assertThrows(fn: () => void, msg: string) {
    try { fn(); throw new Error(`Expected throw: ${msg}`) }
    catch (e) { if (e instanceof Error && e.message.startsWith('Expected throw')) throw e }
}

// ============================================================================
// 2A: SCHEMA CONFLICT & COMPOSITION
// ============================================================================

console.log('─── 2A: Schema Conflicts ───\n')

// Test 1: Conflicting schema keys (string vs number)
test('conflicting schemas: string vs number for same key', () => {
    const t1 = zt.z({ name: z.string() })`First: ${e => e.name}`
    const t2 = zt.z({ name: z.number() })`Second: ${e => e.name}`
    const composed = zt.t`${t1} ${t2}`
    
    // What happens? The intersection is string & number = never
    // Should be impossible to satisfy both schemas simultaneously
    assertThrows(
        // @ts-expect-error name should be never
        () => composed.render({ name: 'test' } ),
        'String should not satisfy number schema'
    )

    assertThrows(
        // @ts-expect-error name should be never
        () => composed.render({ name: 42 }),
        'Number should not satisfy string schema'
    )
})

// Test 2: Same key, same schema — should compose cleanly
test('same key + same schema: composes without conflict', () => {
    const t1 = zt.z({ id: z.uuid() })`ID: ${e => e.id}`
    const t2 = zt.z({ id: z.uuid() })`Ref: ${e => e.id}`
    const composed = zt.t`${t1} -> ${t2}`
    
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const result = composed.render({ id })
    assert(
        zt.debug(result) === `ID: ${id} -> Ref: ${id}`,
        'Same schema should merge and render both'
    )
})

// Test 3: Overlapping but compatible schemas (one has extra field)
test('overlapping schemas: one has extra optional field', () => {
    const t1 = zt.z({ name: z.string() })`Hi ${e => e.name}`
    const t2 = zt.z({ name: z.string(), age: z.number().optional() })`Age: ${e => e.age ?? 'unknown'}`
    const composed = zt.t`${t1} | ${t2}`
    
    const result = composed.render({ name: 'Alice', age: 30 })
    assert(
        zt.debug(result) === 'Hi Alice | Age: 30',
        'Extra field should pass through'
    )
    
    // Without age (optional)
    const result2 = composed.render({ name: 'Bob' })
    assert(
        zt.debug(result2) === 'Hi Bob | Age: unknown',
        'Missing optional field should use default'
    )
})

// Test 4: Scoped + unscoped mixing
test('scoped + unscoped: kargs merge correctly', () => {
    const inner = zt.z({ value: z.number() })`Value: ${e => e.value}`
    
    // Unscoped: expects { value: number } at parent level
    const withUnscoped = zt.t`Unscoped: ${inner}`
    
    // Scoped: expects { inner: { value: number } }
    const withScoped = zt.t`Scoped: ${zt.p('inner', inner)}`
    
    const r1 = withUnscoped.render({ value: 42 })
    assert(zt.debug(r1) === 'Unscoped: Value: 42', 'Unscoped picks up parent kargs')
    
    const r2 = withScoped.render({ inner: { value: 99 } })
    assert(zt.debug(r2) === 'Scoped: Value: 99', 'Scoped uses nested kargs')
})

// Test 5: Schema with defaults in nested composition
test('defaults propagate through nested composition', () => {
    const inner = zt.z({ 
        label: z.string().default('untitled'),
        count: z.number().default(0),
    })`[${e => e.label}: ${e => e.count}]`
    
    const composed = zt.t`A: ${inner} B: ${zt.p('b', inner)}`
    
    // Render with empty object — defaults should fill in
    const result = composed.render({ b: {} })
    assert(
        zt.debug(result) === 'A: [untitled: 0] B: [untitled: 0]',
        'Defaults should apply when kargs are missing'
    )
    
    // Override some defaults
    const result2 = composed.render({ label: 'main', count: 5, b: { label: 'scoped', count: 10 } })
    assert(
        zt.debug(result2) === 'A: [main: 5] B: [scoped: 10]',
        'Overrides should take precedence over defaults'
    )
})

// ============================================================================
// 2B: DEEPLY NESTED CONDITIONALS
// ============================================================================

console.log('\n─── 2B: Deep Nesting ───\n')

// Test 6: 5 levels of conditional nesting
test('5 levels of conditional template nesting', () => {
    const level5 = zt.z({ v: z.string() })`L5:${e => e.v}`
    const level4 = zt.z({ v: z.string(), showL5: z.boolean() })`
${e => e.showL5 ? zt.t`${level5}` : zt.t`[hidden]`}`
    const level3 = zt.z({ v: z.string(), showL4: z.boolean(), showL5: z.boolean() })`
${e => e.showL4 ? zt.t`${level4}` : zt.t`[hidden]`}`
    const level2 = zt.z({ v: z.string(), showL3: z.boolean(), showL4: z.boolean(), showL5: z.boolean() })`
${e => e.showL3 ? zt.t`${level3}` : zt.t`[hidden]`}`
    const level1 = zt.z({ 
        v: z.string(),
        showL2: z.boolean(), showL3: z.boolean(), 
        showL4: z.boolean(), showL5: z.boolean(),
    })`
${e => e.showL2 ? zt.t`${level2}` : zt.t`[hidden]`}`
    
    const result = level1.render({
        v: 'deep',
        showL2: true, showL3: true, showL4: true, showL5: true,
    })
    assert(zt.debug(result).includes('L5:deep'), 'Should reach level 5')
    
    // Hide level 3 — everything below should hide
    const result2 = level1.render({
        v: 'shallow',
        showL2: true, showL3: false, showL4: true, showL5: true,
    })
    assert(zt.debug(result2).includes('[hidden]'), 'Should stop at hidden level')
    assert(!zt.debug(result2).includes('L5'), 'Level 5 should not appear')
})

// Test 7: Conditional returning different schema requirements
test('conditional branch changes kargs requirements', () => {
    const t = zt.z({ branch: z.enum(['simple', 'detailed']) })`
${e => e.branch === 'simple'
    ? zt.t`Simple output`
    : zt.z({ detail: z.string() })`Detailed: ${e2 => e2.detail}`
}`
    
    // Simple branch: only needs { branch: 'simple' }
    const r1 = t.render({ branch: 'simple' })
    assert(zt.debug(r1).includes('Simple'), 'Simple branch renders with minimal kargs')
    
    // Detailed branch: needs { branch: 'detailed', detail: '...' }
    // @ts-expect-error zod tag doesn't support this branching yet? 
    const r2 = t.render({ branch: 'detailed', detail: 'extra info' })
    assert(zt.debug(r2).includes('Detailed: extra info'), 'Detailed branch requires extra kargs')
    
    // Detailed branch without detail should fail but we dont support this
    assertThrows(
        () => t.render({ branch: 'detailed' }),
        'Missing detail should fail validation'
    )
})

// ============================================================================
// 2C: OUTPUT FORMAT EDGE CASES
// ============================================================================

console.log('\n─── 2C: Output Format Edges ───\n')

// Test 8: Single value, no surrounding strings
test('single value with no surrounding strings', () => {
    const t = zt.z({ x: z.number() })`${e => e.x}`
    const result = t.render({ x: 42 })
    const [strs, ...vals] = result
    assert(strs.length === 2, `Should have 2 strings (before + after), got ${strs.length}`)
    assert(strs[0] === '' && strs[1] === '', `Strings should be empty: ["${strs[0]}", "${strs[1]}"]`)
    assert(vals[0] === 42, `Value should be 42, got ${vals[0]}`)
})

// Test 9: Leading value
test('leading value — template starts with interpolation', () => {
    const t = zt.t`${'START'} middle ${'END'}`
    const [strs, ...vals] = t.render()
    assert(strs.length === 3, `Should have 3 strings, got ${strs.length}`)
    assert(strs[0] === '', 'First string should be empty (before leading value)')
    assert(strs[1] === ' middle ', 'Middle string preserved')
    assert(strs[2] === '', 'Last string should be empty (after trailing value)')
    assert(vals[0] === 'START' && vals[1] === 'END', 'Values in correct order')
})

// Test 10: Adjacent values (no string between)
test('adjacent values with no string between them', () => {
    const t = zt.t`${'a'}${'b'}${'c'}`
    const [strs, ...vals] = t.render()
    assert(strs.length === 4, `Should have 4 strings for 3 adjacent values, got ${strs.length}`)
    assert(strs.every((s: string) => s === ''), 'All strings should be empty between adjacent values')
    assert(vals[0] === 'a' && vals[1] === 'b' && vals[2] === 'c', 'Values in order')
})

// Test 11: All-static template with no interpolations
test('static template: no values, single string', () => {
    const t = zt.t`Just some static text`
    const result = t.render()
    assert(result.length === 1 && result[0].length === 1, 'Should have only strings array, no values')
    assert(result[0][0] === 'Just some static text', 'Static text preserved')
})

// Test 12: Empty template
test('empty template: zt.t``', () => {
    const result = zt.t``.render()
    assert(result.length === 1 && result[0].length === 1, 'Empty template produces single empty string')
    assert(result[0][0] === '', 'String is empty')
})

// Test 13: Format utilities with edge cases
test('zt.$n with static template (no values)', () => {
    const t = zt.t`No values here`
    assert(zt.$n(t.render()) === 'No values here', '$n with no values is identity')
})

test('zt.$n with multiple values', () => {
    const t = zt.z({ a: z.string(), b: z.number() })`${e => e.a} = ${e => e.b}`
    const result = t.render({ a: 'x', b: 1 })
    assert(zt.$n(result) === '$0 = $1', 'Values replaced with $n placeholders')
})

test('zt.atIndex with multiple values', () => {
    const t = zt.z({ a: z.string(), b: z.string() })`${e => e.a} -> ${e => e.b}`
    const result = t.render({ a: 'src', b: 'dst' })
    assert(zt.atIndex(result) === '@0 -> @1', 'Values replaced with @n placeholders')
})

test('zt.debug preserves full output', () => {
    const t = zt.z({ x: z.number() })`Value: ${e => e.x}`
    const result = t.render({ x: 99 })
    assert(zt.debug(result) === 'Value: 99', 'Debug concatenates values into string')
})

// ============================================================================
// 2D: BIND + MAP EDGE CASES
// ============================================================================

console.log('\n─── 2D: Bind + Map Edges ───\n')

// Test 14: zt.bind with all kargs satisfied
test('zt.bind: fully satisfied, renders with no parent kargs', () => {
    const t = zt.z({ a: z.string(), b: z.number() })`${e => e.a}:${e => e.b}`
    const bound = zt.bind(t, { a: 'hello', b: 42 })
    assert(zt.debug(bound.render()) === 'hello:42', 'Fully bound renders standalone')
})

// Test 15: zt.map with single element
test('zt.map: single element with separator', () => {
    const t = zt.z({ n: z.string() })`[${e => e.n}]`
    const result = zt.map(['only'], t, n => ({ n }), zt.t`, `)
    assert(zt.debug(result.render()) === '[only]', 'Single element has no separator around it')
})

// Test 16: zt.map with exactly 2 elements
test('zt.map: two elements with separator', () => {
    const t = zt.z({ n: z.string() })`[${e => e.n}]`
    const result = zt.map(['a', 'b'], t, n => ({ n }), zt.t` | `)
    assert(zt.debug(result.render()) === '[a] | [b]', 'Separator between exactly two items')
})

// ============================================================================
// 2E: PERFORMANCE SMOKE TEST
// ============================================================================

console.log('\n─── 2E: Performance ───\n')

// Test 17: Render 500 bound items
test('performance: 500 items via zt.map with separator', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ name: `Item-${i}` }))
    const t = zt.z({ name: z.string() })`${e => e.name}`
    
    const start = performance.now()
    const result = zt.map(items, t, item => ({ name: item.name }), zt.t`, `)
    const output = zt.debug(result.render())
    const elapsed = performance.now() - start
    
    assert(output.includes('Item-0') && output.includes('Item-499'), 'First and last items present')
    assert(elapsed < 100, `Should render in under 100ms, took ${elapsed.toFixed(1)}ms`)
    console.log(`    Rendered 500 items in ${elapsed.toFixed(1)}ms`)
})

// Test 18: Repeated renders — no state bleed
test('state isolation: repeated renders with different data', () => {
    const t = zt.z({ name: z.string() })`Hello, ${e => e.name}!`
    
    const r1 = t.render({ name: 'Alice' })
    const r2 = t.render({ name: 'Bob' })
    const r3 = t.render({ name: 'Charlie' })
    
    assert(zt.debug(r1) === 'Hello, Alice!', 'First render correct')
    assert(zt.debug(r2) === 'Hello, Bob!', 'Second render independent')
    assert(zt.debug(r3) === 'Hello, Charlie!', 'Third render independent')
    
    // Re-render with first kargs — should be identical to r1
    const r1Again = t.render({ name: 'Alice' })
    assert(zt.debug(r1Again) === zt.debug(r1), 'Re-render produces identical output')
})

// ============================================================================

console.log(`\n═══════════════════════════════════════`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`═══════════════════════════════════════\n`)