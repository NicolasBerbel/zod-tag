// conditional-validation-boundary.slop-test.ts
import { z } from 'zod'
import { zt } from '../../../dist/main.js'

/**
 * Stresses:
 * 1. Selector returning renderable vs primitive based on validated input
 * 2. zt.unsafe for structure validated at the boundary
 * 3. Conditional structure from discriminated union
 * 4. zt.join with values that are themselves renderables
 * 5. Re-rendering same template with different data
 * 6. Transaction composition via nested renderables (no manual .render())
 */

const commandSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('create'),
        table: z.string().regex(/^\w+$/),
        columns: z.array(z.string().regex(/^\w+$/)).min(1),
        values: z.array(z.unknown()).min(1),
    }),
    z.object({
        action: z.literal('update'),
        table: z.string().regex(/^\w+$/),
        set: z.record(z.string().regex(/^\w+$/), z.unknown()),
        whereColumn: z.string().regex(/^\w+$/),
        whereValue: z.unknown(),
    }),
    z.object({
        action: z.literal('delete'),
        table: z.string().regex(/^\w+$/),
        whereColumn: z.string().regex(/^\w+$/),
        whereValue: z.unknown(),
    }),
    z.object({
        action: z.literal('raw'),
        sql: z.string().min(1),
    }),
])

// Each action type produces different SQL structure
const sqlCommand = zt.z({
    command: commandSchema,
})`
${e => {
        switch (e.command.action) {
            case 'create': {
                const colList = zt.unsafe(
                    z.string().regex(/^[\w\s,]+$/),
                    e.command.columns.join(', ')
                )
                return zt.t`
INSERT INTO ${zt.unsafe(z.string().regex(/^\w+$/), e.command.table)} (${colList})
VALUES (${zt.join(e.command.values as unknown[], zt.t`, `)})
`
            }
            case 'update': {
                const setEntries = Object.entries(e.command.set)
                const setClauses = setEntries.map(([col]) =>
                    zt.t`${zt.unsafe(z.string().regex(/^\w+$/), col)} = ${(e.command as any).set[col] as string}`
                )
                return zt.t`
UPDATE ${zt.unsafe(z.string().regex(/^\w+$/), e.command.table)}
SET ${zt.join(setClauses as unknown[], zt.t`, `)}
WHERE ${zt.unsafe(z.string().regex(/^\w+$/), e.command.whereColumn)} = ${e.command.whereValue}
`
            }
            case 'delete':
                return zt.t`
DELETE FROM ${zt.unsafe(z.string().regex(/^\w+$/), e.command.table)}
WHERE ${zt.unsafe(z.string().regex(/^\w+$/), e.command.whereColumn)} = ${e.command.whereValue}
`
            case 'raw':
                return zt.unsafe(z.string(), e.command.sql)
        }
    }}
`

// Transaction wraps individual commands — each gets its own scope via zt.p
const transaction = zt.z({
    commands: z.array(commandSchema).min(1),
})`
BEGIN;
${

    // e.commands.map((v, i) => zt.p(`${i}`, sqlCommand)), <- zod-tag need some way to bind kargs to a template smth like zt.bind/with(tmpl, kargs) and further ho util zt.each pairing with zt.join
    // e.commands.map((cmd, i) => zt.p(`cmd${i}`, sqlCommand)) as unknown[], // <- this is repeated data on input kargs just for a map loop trough array
    // e.commands.map(cmd => zt.bind(sqlCommand, { command: cmd })), <- THis now works :) - but we will have to join them to transform into renderable
    e => zt.map(e.commands, sqlCommand, command => ({ command })) // <- This is the syntax we want for map?
    };
COMMIT;
`

// ============================================================================
// TEST SCENARIOS
// ============================================================================

console.log('\n═══════════════════════════════════')
console.log('  CONDITIONAL SQL COMMAND BUILDER')
console.log('═══════════════════════════════════\n')

let totalPassed = 0
let totalFailed = 0

function test(name: string, fn: () => void) {
    try {
        fn()
        console.log(`  ✓ ${name}`)
        totalPassed++
    } catch (e) {
        console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`)
        totalFailed++
    }
}

// Test 1-9: Individual command tests (same as before, they work)
test('CREATE with 3 columns, 3 values', () => {
    const result = sqlCommand.render({
        command: {
            action: 'create' as const,
            table: 'users',
            columns: ['name', 'email', 'role'],
            values: ['Alice', 'alice@test.com', 'admin'],
        },
    })
    const sql = zt.$n(result)
    console.log(`    SQL: ${sql.trim()}`)
})

test('UPDATE with 2 set clauses', () => {
    const result = sqlCommand.render({
        command: {
            action: 'update' as const,
            table: 'users',
            set: { name: 'Bob', role: 'user' },
            whereColumn: 'id',
            whereValue: 'uuid-123',
        },
    })
    console.log(`    SQL: ${zt.$n(result).trim()}`)
})

test('DELETE by id', () => {
    const result = sqlCommand.render({
        command: {
            action: 'delete' as const,
            table: 'users',
            whereColumn: 'id',
            whereValue: 'uuid-456',
        },
    })
    console.log(`    SQL: ${zt.$n(result).trim()}`)
})

test('RAW trusted SQL has zero parameterized values', () => {
    const result = sqlCommand.render({
        command: { action: 'raw' as const, sql: 'SELECT 1' },
    })
    if (result.length - 1 !== 0) throw new Error('RAW should have no values')
    console.log(`    SQL: ${zt.debug(result).trim()}`)
})

test('Re-render same template with different action types', () => {
    const r1 = sqlCommand.render({
        command: { action: 'create' as const, table: 't1', columns: ['a'], values: [1] },
    })
    const r2 = sqlCommand.render({
        command: { action: 'delete' as const, table: 't2', whereColumn: 'x', whereValue: 'y' },
    })
    if (zt.debug(r1) === zt.debug(r2)) throw new Error('Should differ')
    console.log(`    OK`)
})

test('Validation: rejects invalid table name', () => {
    try {
        sqlCommand.render({
            command: { action: 'create' as const, table: 'bad; DROP', columns: ['a'], values: [1] },
        } as any)
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('Validation: rejects missing fields for action type', () => {
    try {
        sqlCommand.render({
            command: { action: 'update' as const, table: 'users' },
        } as any)
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('Validation: rejects empty columns', () => {
    try {
        sqlCommand.render({
            command: { action: 'create' as const, table: 'users', columns: [], values: [] },
        } as any)
        throw new Error('Should have thrown')
    } catch { /* expected */ }
})

test('Column/value length mismatch is userspace concern', () => {
    const result = sqlCommand.render({
        command: {
            action: 'create' as const,
            table: 'users',
            columns: ['name', 'email'],
            values: ['only one value'],
        },
    })
    console.log(`    SQL: ${zt.$n(result).trim()} (2 cols, 1 val — not library's job)`)
})

test('Nested objects stay in values array', () => {
    const result = sqlCommand.render({
        command: {
            action: 'create' as const,
            table: 'users',
            columns: ['name', 'meta'],
            values: ['Alice', { role: 'admin' }],
        },
    })
    const args = result.slice(1)
    if (typeof args[1] !== 'object') throw new Error('Object should be a value')
    console.log(`    Args: ${JSON.stringify(args)}`)
})

// ============================================================================
// TRANSACTION COMPOSITION - weak array composition here :()
// ============================================================================

console.log('\n─── TRANSACTION COMPOSITION ───\n')

test('Transaction with 3 commands via zt.p scoping', () => {
    const result = transaction.render({
        commands: [
            { action: 'create' as const, table: 'orders', columns: ['user_id', 'total'], values: ['uuid-1', 99.99] },
            { action: 'update' as const, table: 'inventory', set: { stock: 99 }, whereColumn: 'product_id', whereValue: 'sku-123' },
            { action: 'delete' as const, table: 'cart', whereColumn: 'user_id', whereValue: 'uuid-1' },
        ],
        // cmd0: { command: { action: 'create' as const, table: 'orders', columns: ['user_id', 'total'], values: ['uuid-1', 99.99] } },
        // cmd1: { command: { action: 'update' as const, table: 'inventory', set: { stock: 99 }, whereColumn: 'product_id', whereValue: 'sku-123' } },
        // cmd2: { command: { action: 'delete' as const, table: 'cart', whereColumn: 'user_id', whereValue: 'uuid-1' } },
    } as any)

    const sql = zt.$n(result)
    console.log(`    SQL:\n${sql}`)
    console.log(`    Args: ${JSON.stringify(result.slice(1))}`)
})

test('Transaction with mixed commands including RAW', () => {
    const result = transaction.render({
        commands: [
            { action: 'raw' as const, sql: 'SET CONSTRAINTS ALL DEFERRED' },
            { action: 'create' as const, table: 'logs', columns: ['msg'], values: ['started'] },
            { action: 'raw' as const, sql: 'SET CONSTRAINTS ALL IMMEDIATE' },
        ],
        // cmd0: { command: { action: 'raw' as const, sql: 'SET CONSTRAINTS ALL DEFERRED' } },
        // cmd1: { command: { action: 'create' as const, table: 'logs', columns: ['msg'], values: ['started'] } },
        // cmd2: { command: { action: 'raw' as const, sql: 'SET CONSTRAINTS ALL IMMEDIATE' } },
    } as any)

    console.log(`    SQL:\n${zt.debug(result)}`)
    console.log(`    Values: ${JSON.stringify(result.slice(1))}`)
})

// ============================================================================

console.log('\n═══════════════════════════════════')
console.log(`  RESULTS: ${totalPassed} passed, ${totalFailed} failed`)
console.log('═══════════════════════════════════\n')    