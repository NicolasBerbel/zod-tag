import { z } from 'zod';
import {
    zt,
    type IRenderableKargs,
    type IRenderable
} from '../../../dist/main.js';

/**
 * SQL Template Examples - Safe Parameterized Query Building
 * 
 * Demonstrates type-safe SQL generation with automatic parameterization.
 * Structure is hardcoded, values are always parameterized via $1, $2, etc.
 */

// =====================================================================
// 1. Basic SELECT with WHERE clause
// =====================================================================

const getUserById = zt.z({
    userId: z.uuid(),
})`
SELECT id, name, email, created_at
FROM users
WHERE id = ${e => e.userId}
`;

// =====================================================================
// 2. INSERT with validation
// =====================================================================

const createUser = zt.z({
    name: z.string().min(1).max(255),
    email: z.email(),
    role: z.enum(['admin', 'user', 'guest']).default('user'),
})`
INSERT INTO users (name, email, role)
VALUES (${e => e.name}, ${e => e.email}, ${e => e.role})
RETURNING id, created_at
`;

// =====================================================================
// 3. UPDATE with conditions
// =====================================================================

const updateUserEmail = zt.z({
    newEmail: z.email(),
    userId: z.uuid(),
})`
UPDATE users
SET email = ${e => e.newEmail}, updated_at = NOW()
WHERE id = ${e => e.userId}
RETURNING id, email, updated_at
`;

// =====================================================================
// 4. Dynamic WHERE conditions (using selector functions)
// =====================================================================

const listUsersByRole = zt.z({
    role: z.enum(['admin', 'user', 'guest']),
    limit: z.number().int().positive().max(1000).default(50),
})`
SELECT id, name, email, role, created_at
FROM users
WHERE role = ${e => e.role}
ORDER BY created_at DESC
LIMIT ${e => e.limit}
`;

// =====================================================================
// 5. Dynamic column selection (using zt.p for inline params)
// =====================================================================

const selectUserColumns = zt.z({
    userId: z.uuid(),
})`
SELECT ${zt.p(
    'columns',
    z.array(z.enum([
        'id',
        'name',
        'email',
        'role',
        'created_at',
        'updated_at',
    ])).min(1),
    (cols) => (
        // z.string() here isn't validating nothing but cols are already valid z.enum() item.
        zt.unsafe(z.string(), cols.join(', '))
    )
)}
FROM users
WHERE id = ${e => e.userId}
`;

// =====================================================================
// 6. JOIN query with nested object schema
// =====================================================================

const postSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
});

const getUserWithPosts = zt.z({
    userId: z.uuid(),
})`
SELECT 
    u.id,
    u.name,
    u.email,
    p.id as post_id,
    p.title,
    p.content,
    p.created_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.id = ${e => e.userId}
ORDER BY p.created_at DESC
`;

// =====================================================================
// 7. Complex WHERE with AND/OR conditions
// =====================================================================

const searchUsers = zt.z({
    namePattern: z.string().min(1).max(100),
    roles: z.array(z.enum(['admin', 'user', 'guest'])).min(1),
    createdAfter: z.date().optional(),
})`
SELECT id, name, email, role, created_at
FROM users
WHERE name ILIKE ${e => e.namePattern}
  AND role = ANY(${e => e.roles.join(', ')})
  ${(ctx) => ctx.createdAfter ? zt.t`AND created_at >= ${ctx.createdAfter.toISOString()}` : zt.t``}
ORDER BY created_at DESC
`;

// =====================================================================
// 8. Transaction-style queries (multiple statements)
// =====================================================================

const createUserAndProfile = zt.z({
    name: z.string().min(1),
    email: z.email(),
    bio: z.string().max(500).optional(),
})`
BEGIN;

INSERT INTO users (name, email)
VALUES (${e => e.name}, ${e => e.email})
RETURNING id INTO user_id;

${e => e.bio ? zt.t`
INSERT INTO user_profiles (user_id, bio)
VALUES (user_id, ${e.bio});
` : zt.t``}
COMMIT;
`;

// =====================================================================
// 9. Using zt.unsafe() for validated enums (column names, order directions)
// =====================================================================

// Pre-validate the column name and sort direction against Zod enums
const allowedSortColumns = z.enum(['name', 'email', 'created_at', 'updated_at']);
const sortDirection = z.enum(['ASC', 'DESC']);

const sortUsersByColumn = zt.z({
    column: allowedSortColumns,
    direction: sortDirection,
})`
SELECT id, name, email, created_at
FROM users
ORDER BY ${(ctx) => zt.unsafe(z.string().regex(/^\w+$/), ctx.column)} ${(ctx) => zt.unsafe(z.enum(['ASC', 'DESC']), ctx.direction)}
LIMIT 50
`;

// =====================================================================
// 10. UPSERT (INSERT ... ON CONFLICT)
// =====================================================================

const upsertUser = zt.z({
    email: z.email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'user', 'guest']),
})`
INSERT INTO users (email, name, role)
VALUES (${e => e.email}, ${e => e.name}, ${e => e.role})
ON CONFLICT (email)
DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = NOW()
RETURNING id, email, created_at, updated_at
`;

// =====================================================================
// BATCH QUERY: Composition example
// =====================================================================

const userBatch = zt.z({
    userIds: z.array(z.uuid()).min(1),
})`
SELECT id, name, email, role
FROM users
WHERE id = ANY(
  ${e => e.userIds.reduce((acc, id, i) => {
    return i ? zt.t`${acc}, ${id}` : zt.t`${id}` as any;
}, zt.t``) as any as IRenderable<void, [...unknown[]]>}
)
ORDER BY created_at DESC
`;

// =====================================================================
// TYPE SAFETY: Extract inferred types
// =====================================================================

type GetUserByIdParams = IRenderableKargs<typeof getUserById>;
type CreateUserParams = IRenderableKargs<typeof createUser>;
type ListUsersByRoleParams = IRenderableKargs<typeof listUsersByRole>;
type SortUsersByColumnParams = IRenderableKargs<typeof sortUsersByColumn>;

// =====================================================================
// RENDERING EXAMPLES
// =====================================================================

function renderExamples() {
    console.log('\n========== SQL Query Examples ==========\n');

    // Example 1: Basic SELECT
    {
        const rendered = getUserById.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('1. GET USER BY ID:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 2: INSERT
    {
        const rendered = createUser.render({
            name: 'Alice Johnson',
            email: 'alice@example.com',
            role: 'user',
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('2. CREATE USER:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 3: UPDATE
    {
        const rendered = updateUserEmail.render({
            newEmail: 'newemail@example.com',
            userId: '550e8400-e29b-41d4-a716-446655440000',
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('3. UPDATE USER EMAIL:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 4: LIST BY ROLE
    {
        const rendered = listUsersByRole.render({
            role: 'admin',
            limit: 100,
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('4. LIST USERS BY ROLE:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 5: SELECT SPECIFIC COLUMNS
    {
        const rendered = selectUserColumns.render({
            userId: '550e8400-e29b-41d4-a716-446655440000',
            columns: ['id', 'name', 'email'],
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('5. SELECT USER COLUMNS:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 6: SORT BY COLUMN
    {
        const rendered = sortUsersByColumn.render({
            column: 'created_at',
            direction: 'DESC',
        });
        const [strings, ...values] = rendered;
        const query = zt.debug(rendered);
        console.log('6. SORT USERS (unsafe validated identifiers):');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 7: UPSERT
    {
        const rendered = upsertUser.render({
            email: 'bob@example.com',
            name: 'Bob Smith',
            role: 'user',
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('7. UPSERT USER:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }

    // Example 8: BATCH QUERY
    {
        const rendered = userBatch.render({
            userIds: [
                '550e8400-e29b-41d4-a716-446655440000',
                '660e8400-e29b-41d4-a716-446655440000',
            ],
        });
        const [strings, ...values] = rendered;
        const query = zt.$n(rendered);
        console.log('8. BATCH GET USERS:');
        console.log('   Query:', query);
        console.log('   Values:', values);
        console.log();
    }
}

// =====================================================================
// ERROR HANDLING EXAMPLE
// =====================================================================

function demonstrateValidation() {
    console.log('\n========== VALIDATION EXAMPLES ==========\n');

    // Valid
    try {
        const rendered = createUser.render({
            name: 'Valid User',
            email: 'valid@example.com',
            role: 'admin',
        });
        console.log('✓ Valid user creation renders successfully');
    } catch (err) {
        console.error('✗ Unexpected error:', err);
    }

    // Invalid email
    try {
        const rendered = createUser.render({
            name: 'Invalid User',
            email: 'not-an-email',
            role: 'user',
        });
    } catch (err) {
        console.log('✓ Invalid email caught at validation time');
    }

    // Invalid role
    try {
        const rendered = createUser.render({
            name: 'Invalid User',
            email: 'user@example.com',
            role: 'superadmin' as any,
        });
    } catch (err) {
        console.log('✓ Invalid role caught at validation time');
    }

    // Missing required field
    try {
        const rendered = createUser.render({
            name: '',
            email: 'user@example.com',
            role: 'user',
        });
    } catch (err) {
        console.log('✓ Empty name caught at validation time');
    }
}

// =====================================================================
// RUN EXAMPLES
// =====================================================================

renderExamples();
demonstrateValidation();

console.log('\n========== KEY TAKEAWAYS ==========');
console.log('✓ All values are parameterized ($1, $2, etc.)');
console.log('✓ All identifiers validated before tz.unsafe()');
console.log('✓ Zod schemas provide runtime validation');
console.log('✓ TypeScript infers exact parameter types');
console.log('✓ SQL injection is prevented by parameterization');
