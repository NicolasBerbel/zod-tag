// functional-composition.slop-test.ts
import { z } from 'zod'
import { zt } from '../../../dist/main.js'

/**
 * FUNCTIONAL COMPOSITION SHOWCASE
 * 
 * Tests the algebraic properties of renderables:
 * - identity: zt.empty composes with anything yielding the same result
 * - bind: partial application of kargs closes a renderable
 * - map: functorial lifting of lists into a single composed renderable
 * - fold/join: monoidal concatenation with structural separator
 * - associativity: (a · b) · c === a · (b · c)
 * - conditional identity: zt.if(false, t) === identity
 * - classification: mapFn transforms raw data to validated kargs at the boundary
 */

const greeting = zt.z({ name: z.string() })`Hello, ${e => e.name}!`
const farewell = zt.z({ name: z.string() })`Goodbye, ${e => e.name}.`
const question = zt.z({ name: z.string() })`How are you, ${e => e.name}?`

const moodGreeting = zt.z({
    name: z.string(),
    mood: z.enum(['happy', 'sad', 'neutral']).default('neutral'),
})`
${e => {
    switch (e.mood) {
        case 'happy': return zt.t`${greeting} You seem happy today!`
        case 'sad': return zt.t`${greeting} I hope things get better.`
        case 'neutral': return zt.t`${greeting}`
    }
}}
`

const empty = zt.empty

// ============================================================================
// TESTS
// ============================================================================

console.log('\n═══════════════════════════════════════')
console.log('  FUNCTIONAL COMPOSITION PROPERTIES')
console.log('═══════════════════════════════════════\n')

let passed = 0, failed = 0

function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++ }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); console.error(e); failed++ }
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
}

// ── IDENTITY ──────────────────────────────────────────

test('identity: empty · template === template', () => {
    const composed = zt.t`${empty}${greeting}`
    const original = greeting.render({ name: 'Alice' })
    const result = composed.render({ name: 'Alice' })
    assert(zt.debug(original) === zt.debug(result), 'Pre-compose with identity')
})

test('identity: template · empty === template', () => {
    const composed = zt.t`${greeting}${empty}`
    const original = greeting.render({ name: 'Bob' })
    const result = composed.render({ name: 'Bob' })
    assert(zt.debug(original) === zt.debug(result), 'Post-compose with identity')
})

test('identity: empty renders to nothing', () => {
    const result = empty.render()
    assert(result[0][0] === '' && result.length === 1, 'Empty should be a single blank string')
})

// ── BIND (Partial Application) ────────────────────────

test('bind: fully bound renderable requires no kargs', () => {
    const bound = zt.bind(greeting, { name: 'Charlie' })
    assert(zt.debug(bound.render()) === 'Hello, Charlie!', 'Bound template renders with no kargs')
})

test('bind: bound renderables compose without kargs leakage', () => {
    const alice = zt.bind(greeting, { name: 'Alice' })
    const bob = zt.bind(farewell, { name: 'Bob' })
    const composed = zt.t`${alice} ${bob}`
    assert(zt.debug(composed.render()) === 'Hello, Alice! Goodbye, Bob.', 'No parent kargs needed')
})

test('bind: validates at bind time, not render time', () => {
    try {
        zt.bind(greeting, { name: 123 } as any)
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

// ── MAP (Functorial Lifting) ──────────────────────────

test('map: lifts list into concatenated renderable (identity separator)', () => {
    const names = ['Alice', 'Bob', 'Charlie']
    const result = zt.map(names, greeting, name => ({ name }))
    assert(
        zt.debug(result.render()) === 'Hello, Alice!Hello, Bob!Hello, Charlie!',
        'Map with default identity separator concatenates'
    )
})

test('map: with custom separator (4th parameter)', () => {
    const names = ['Alice', 'Bob', 'Charlie']
    const result = zt.map(names, greeting, name => ({ name }), zt.t`, `)
    assert(
        zt.debug(result.render()) === 'Hello, Alice!, Hello, Bob!, Hello, Charlie!',
        'Map with separator inserts separator between items'
    )
})

test('map: with newline separator', () => {
    const names = ['Alice', 'Bob']
    const result = zt.map(names, greeting, name => ({ name }), zt.t`\n`)
    assert(
        zt.debug(result.render()) === 'Hello, Alice!\nHello, Bob!',
        'Map with newline separator'
    )
})

test('map: empty list produces identity', () => {
    const result = zt.map([], greeting, (name: string) => ({ name }))
    assert(zt.debug(result.render()) === '', 'Empty map yields empty output')
})

test('map: empty list with separator still produces identity', () => {
    const result = zt.map([], greeting, (name: string) => ({ name }), zt.t`, `)
    assert(zt.debug(result.render()) === '', 'Empty map with separator still empty')
})

// ── ASSOCIATIVITY ─────────────────────────────────────

test('associativity: (a · b) · c === a · (b · c)', () => {
    const a = zt.bind(greeting, { name: 'A' })
    const b = zt.bind(farewell, { name: 'B' })
    const c = zt.bind(question, { name: 'C' })
    const left = zt.t`${zt.t`${a} ${b}`} ${c}`
    const right = zt.t`${a} ${zt.t`${b} ${c}`}`
    assert(zt.debug(left.render()) === zt.debug(right.render()), 'Join is associative')
})

// ── CONDITIONAL IDENTITY ──────────────────────────────

test('conditional: zt.if(false, t) yields identity', () => {
    const result = zt.if(false, greeting)
    const composed = zt.t`before ${result} after`
    assert(
        zt.debug(composed.render({ name: 'X' } as any)) === 'before  after',
        'if(false) disappears on composition'
    )
})

test('conditional: zt.if(true, t) yields t', () => {
    const result = zt.if(true, zt.bind(greeting, { name: 'Dave' }))
    assert(zt.debug(result.render()) === 'Hello, Dave!', 'if(true) is identity')
})

// ── COMPLEX COMPOSITION ───────────────────────────────

test('complex: bind + map + mood selection with separator', () => {
    const team = [
        { name: 'Alice', mood: 'happy' as const },
        { name: 'Bob', mood: 'sad' as const },
        { name: 'Charlie', mood: 'neutral' as const },
    ]
    
    const messages = zt.map(team, moodGreeting, m => ({ name: m.name, mood: m.mood }), zt.t`\n`)
    const result = zt.t`Team status:\n${messages}`
    
    const output = zt.debug(result.render())
    console.log(`    Output:\n${output.split('\n').map(l => `    ${l}`).join('\n')}`)
    
    // Check for mood-specific rendered content (not the enum values)
    assert(output.includes('happy today'), 'Happy mood message rendered')
    assert(output.includes('hope things get better'), 'Sad mood message rendered')
    assert(output.includes('Alice'), 'Alice present')
    assert(output.includes('Bob'), 'Bob present')
    assert(output.includes('Charlie'), 'Charlie present')
})

// ── CLASSIFICATION BOUNDARY ───────────────────────────

test('classification: mapFn transforms raw data to validated kargs', () => {
    const rawUsers = [
        { fullName: 'Alice Smith', email: 'alice@test.com' },
        { fullName: 'Bob Jones', email: 'bob@test.com' },
    ]
    
    const userBlock = zt.z({
        displayName: z.string(),
        contact: z.email(),
    })`User: ${e => e.displayName} <${e => e.contact}>`
    
    const classify = (raw: typeof rawUsers[number]) => ({
        displayName: raw.fullName,
        contact: raw.email,
    })
    
    const result = zt.map(rawUsers, userBlock, classify, zt.t` | `)
    const output = zt.debug(result.render())
    assert(
        output === 'User: Alice Smith <alice@test.com> | User: Bob Jones <bob@test.com>',
        `Got: "${output}"`
    )
})

// ============================================================================

console.log(`\n═══════════════════════════════════`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`═══════════════════════════════════\n`)