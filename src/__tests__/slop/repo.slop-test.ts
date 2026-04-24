import { z } from 'zod';
import { zt, type IRenderable, type TagTypes } from '../../../dist/main.js';
import Database from 'better-sqlite3';

// ============================================================================
// DATABASE SETUP
// ============================================================================
const WORD_REGEX = z.string().regex(/^\w+$/)


const db = new Database(':memory:');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'guest')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Insert sample data
  INSERT OR IGNORE INTO users (id, name, email, role) VALUES 
    ('d577d021-1d38-4769-a27a-3a3a03d3425c', 'Alice Johnson', 'alice@example.com', 'admin'),
    ('cf4f5b2b-6c13-42ba-b6dd-53d6f5e75825', 'Bob Smith', 'bob@example.com', 'user'),
    ('5770c836-1608-483a-98cc-8572cc2a1390', 'Carol Davis', 'carol@example.com', 'guest');

  INSERT OR IGNORE INTO posts (id, user_id, title, content) VALUES
    ('edc9bc8b-5f0c-4b95-8d77-7e629c918755', 'd577d021-1d38-4769-a27a-3a3a03d3425c', 'First Post', 'Hello world!'),
    ('c25303ab-f869-424a-bd2f-2a0629e8ef91', 'd577d021-1d38-4769-a27a-3a3a03d3425c', 'Second Post', 'Zod is awesome'),
    ('dce7cab9-f24e-4a2f-a914-17b61f6069be', 'cf4f5b2b-6c13-42ba-b6dd-53d6f5e75825', 'My Journey', 'Learning TypeScript');
`);

// ============================================================================
// REUSABLE PARAMETER FRAGMENTS
// ============================================================================

const fragments = {
    // Safe column selection with validation
    select: z.array(z.string().trim().regex(/^\w+$/)).min(1)
        .default(['*'])
        .transform((e) => zt.unsafe(z.string(), e.join(', '))
        ),

    // Dynamic ORDER BY clause
    orderBy: z.object({
        column: z.string().optional(),
        order: z.enum(['ASC', 'DESC']).default('ASC')
    }).optional().transform((q) => {
        if (!q?.column) return zt.t``;
        return zt.t`ORDER BY ${q.column} ${zt.unsafe(z.enum(['ASC', 'DESC']), q.order)}`;
    }),

    // Pagination limit
    limit: z.number().min(1).max(100).default(10).transform(
        (limit) => zt.t`LIMIT ${limit}`
    ),

    // Offset for pagination
    offset: z.number().min(0).default(0).transform(
        (offset) => zt.t`OFFSET ${offset}`
    ),
};

// ============================================================================
// BASE REPOSITORY CLASS
// ============================================================================

class Repository {
    protected table: IRenderable<void, [], []>;
    protected name: string;

    constructor(name: string) {
        this.table = zt.unsafe(WORD_REGEX, name);
        this.name = name;
    }

    /**
     * Generic SQL builder factory
     * @param shape - Zod shape defining the method parameters
     * @returns A tagged template function that builds SQL queries
     */
    protected sql = <S extends z.ZodRawShape>(shape: S) => {
        const schemaTag = zt.z(shape);
        type Params = z.input<z.ZodObject<S>>;

        return <
            L extends T,
            R extends T[],
            T extends TagTypes<z.output<z.ZodObject<S>>>,
        >(strs: TemplateStringsArray, ...vals: [L, ...R]) => {
            const renderable = schemaTag(strs, ...vals as any);

            // Return the actual repository method
            return (params: Params): QueryResult => {
                const [queryStrings, ...queryArgs] = renderable.render(params as any, undefined);

                return {
                    sql: queryStrings.join('?'),
                    text: String.raw({ raw: queryStrings }, ...queryArgs.map((_, i) => `$${i}`)),
                    args: queryArgs,
                };
            };
        };
    };

    /**
     * Execute a query and return all rows
     */
    queryMany<T = any>(query: QueryResult): T[] {
        const stmt = db.prepare(query.sql);
        return stmt.all(...query.args) as T[];
    }

    /**
     * Execute a query and return first row
     */
    queryOne<T = any>(query: QueryResult): T | null {
        const stmt = db.prepare(query.sql);
        return stmt.get(...query.args) as T | null;
    }

    /**
     * Execute a write query (INSERT, UPDATE, DELETE)
     */
    queryRun(query: QueryResult): { changes: number; lastInsertRowid: number } {
        const stmt = db.prepare(query.sql);
        const result = stmt.run(...query.args);
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid as number };
    }
}

// ============================================================================
// USER REPOSITORY
// ============================================================================

interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
    created_at: string;
    updated_at: string;
}

class UserRepository extends Repository {
    constructor() {
        super('users');
    }

    // Create a new user
    create = this.sql({
        id: z.uuid().optional().default(() => crypto.randomUUID()),
        name: z.string().min(1).max(255),
        email: z.email(),
        role: z.enum(['admin', 'user', 'guest']).default('user'),
    })`
    INSERT INTO ${this.table} 
      (id, name, email, role)
    VALUES (
      ${e => e.id},
      ${e => e.name}, 
      ${e => e.email}, 
      ${e => e.role}
    )
    RETURNING *
  `;

    // Find user by ID
    findById = this.sql({
        id: z.uuid(),
    })`
    SELECT * FROM ${this.table}
    WHERE id = ${e => e.id}
  `;

    // Find user by email
    findByEmail = this.sql({
        email: z.email(),
    })`
    SELECT * FROM ${this.table}
    WHERE email = ${e => e.email}
  `;

    // Get all users with pagination and sorting
    findAll = this.sql({
        select: fragments.select,
        orderBy: fragments.orderBy,
        limit: fragments.limit,
        offset: fragments.offset,
    })`
    SELECT ${e => e.select}
    FROM ${this.table}
    ${e => e.orderBy}
    ${e => e.limit}
    ${e => e.offset}
  `;

    // Update user
    update = this.sql({
        id: z.uuid(),
        name: z.string().min(1).max(255).optional(),
        email: z.email().optional(),
        role: z.enum(['admin', 'user', 'guest']).optional(),
    })`
    UPDATE ${this.table}
    SET 
      ${e => zt.if(e.name, zt.t`name = COALESCE(${e.name}, name),`)}
      ${e => e.email ? zt.t`email = COALESCE(${e.email}, email),` : zt.t``}
      ${e => e.role ? zt.t`role = COALESCE(${e.role}, role),` : zt.t``}
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${e => e.id}
    RETURNING *
  `;

    // Delete user
    delete = this.sql({
        id: z.uuid(),
    })`
    DELETE FROM ${this.table}
    WHERE id = ${e => e.id}
    RETURNING id
  `;

    // Complex search with dynamic conditions
    search = this.sql({
        name: z.string().optional(),
        email: z.string().optional(),
        role: z.enum(['admin', 'user', 'guest']).optional(),
        orderBy: fragments.orderBy,
        limit: fragments.limit,
    })`
    SELECT * FROM ${this.table}
    WHERE 1=1
    ${e => e.name ? zt.t`AND name LIKE ${'%' + e.name + '%'}` : zt.t``}
    ${e => e.email ? zt.t`AND email = ${e.email}` : zt.t``}
    ${e => e.role ? zt.t`AND role = ${e.role}` : zt.t``}
    ${e => e.orderBy}
    ${e => e.limit}
  `;

    // Batch get by multiple IDs
    findByIds = this.sql({
        ids: z.array(z.uuid()).min(1),
    })`
    SELECT * FROM ${this.table}
    WHERE id IN (${e => zt.join(e.ids, zt.t`, `)})
  `;
}

// WHERE id IN (
//     ${e => (e.ids.reduce((acc, id) => {
//     return (acc ? zt.t`${acc},${id}` : zt`${id}`) as any
// }, null as any as IRenderable<void, [], []>))}
// 

// ============================================================================
// POSTS REPOSITORY
// ============================================================================

interface Post {
    id: string;
    user_id: string;
    title: string;
    content: string;
    created_at: string;
}

class PostRepository extends Repository {
    constructor() {
        super('posts');
    }

    create = this.sql({
        user_id: z.uuid(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
    })`
    INSERT INTO ${this.table} 
      (id, user_id, title, content)
    VALUES (
      ${crypto.randomUUID()},
      ${e => e.user_id},
      ${e => e.title},
      ${e => e.content}
    )
    RETURNING *
  `;

    findByUser = this.sql({
        user_id: z.uuid(),
        orderBy: fragments.orderBy,
    })`
    SELECT * FROM ${this.table}
    WHERE user_id = ${e => e.user_id}
    ${e => e.orderBy}
  `;

    getUserWithPosts = this.sql({
        user_id: z.uuid(),
    })`
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      p.id as post_id,
      p.title,
      p.content,
      p.created_at as post_created_at
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    WHERE u.id = ${e => e.user_id}
    ORDER BY p.created_at DESC
  `;
}

// ============================================================================
// QUERY RESULT TYPE
// ============================================================================

interface QueryResult {
    sql: string;
    text: string;
    args: unknown[];
}

// ============================================================================
// DEMO & TESTING
// ============================================================================

const users = new UserRepository();
const posts = new PostRepository();

async function main() {
    console.log('\n========== ZOD-TAG SQLITE REPOSITORY DEMO ==========\n');

    // 1. CREATE a new user
    console.log('1. CREATE USER:');
    const newUser = users.create({
        name: 'Diana Prince',
        email: 'diana@example.com',
        role: 'admin',
    });
    const created = users.queryOne<User>(newUser);
    console.log('   Created:', created);
    console.log();

    // 2. FIND by ID
    console.log('2. FIND USER BY ID:');
    const findQuery = users.findById({ id: 'd577d021-1d38-4769-a27a-3a3a03d3425c' });
    const user = users.queryOne<User>(findQuery);
    console.log('   Found:', user);
    console.log('   SQL:', findQuery.sql);
    console.log('   Args:', findQuery.args);
    console.log();

    // 3. FIND ALL with pagination and sorting
    console.log('3. FIND ALL USERS (sorted by name DESC):');
    const allUsers = users.findAll({
        select: ['id', 'name', 'email', 'role'],
        orderBy: { column: 'name', order: 'DESC' },
        limit: 10,
        offset: 0,
    });
    const userList = users.queryMany(allUsers);
    console.log('   Users:', userList);
    console.log('   SQL:', allUsers.sql);
    console.log();

    // 4. CREATE a post
    console.log('4. CREATE POST:');
    const newPost = posts.create({
        user_id: created?.id!,
        title: 'Working with zod-tag',
        content: 'This library is amazing for type-safe SQL!',
    });
    const createdPost = posts.queryOne<Post>(newPost);
    console.log('   Created post:', createdPost);
    console.log();

    // 5. FIND posts by user
    console.log('5. FIND POSTS BY USER:');
    const userPosts = posts.findByUser({
        user_id: 'd577d021-1d38-4769-a27a-3a3a03d3425c',
        orderBy: { column: 'created_at', order: 'DESC' },
    });
    const postList = posts.queryMany(userPosts);
    console.log('   Posts:', postList);
    console.log();

    // 6. UPDATE user
    console.log('6. UPDATE USER:');
    const updateQuery = users.update({
        id: 'cf4f5b2b-6c13-42ba-b6dd-53d6f5e75825',
        role: 'admin',
    });
    const updated = users.queryOne<User>(updateQuery);
    console.log('   Updated user:', updated);
    console.log();

    // 7. SEARCH with dynamic conditions
    console.log('7. SEARCH USERS (name contains "a", role = admin):');
    const searchQuery = users.search({
        name: 'a',
        role: 'admin',
        orderBy: { column: 'name', order: 'ASC' },
        limit: 5,
    });
    const searchResults = users.queryMany(searchQuery);
    console.log('   Search results:', searchResults);
    console.log('   SQL:', searchQuery.sql);
    console.log('   Args:', searchQuery.args);
    console.log();

    // 8. FIND BY MULTIPLE IDs (batch)
    console.log('8. BATCH GET USERS:');
    const batchQuery = users.findByIds({
        ids: ['d577d021-1d38-4769-a27a-3a3a03d3425c', 'cf4f5b2b-6c13-42ba-b6dd-53d6f5e75825', '5770c836-1608-483a-98cc-8572cc2a1390'],
    });
    const batchResults = users.queryMany(batchQuery);
    console.log('   Batch results:', batchResults);
    console.log('   SQL:', batchQuery.sql);
    console.log('   Args:', batchQuery.args);
    console.log();

    // 9. JOIN query (user with posts)
    console.log('9. USER WITH POSTS (JOIN):');
    const joinQuery = posts.getUserWithPosts({ user_id: 'd577d021-1d38-4769-a27a-3a3a03d3425c' });
    const joinResults = posts.queryMany(joinQuery);
    console.log('   User with posts:', joinResults);
    console.log('   SQL:', joinQuery.sql);
    console.log();

    // 10. DELETE user
    console.log('10. DELETE USER:');
    const deleteQuery = users.delete({ id: created?.id || '' });
    if (created?.id) {
        const result = users.queryRun(deleteQuery);
        console.log('   Deleted user ID:', result);
    }
    console.log();

    // 11. ERROR HANDLING DEMO
    console.log('11. ERROR HANDLING (invalid email):');
    try {
        const invalidQuery = users.create({
            name: 'Invalid',
            email: 'not-an-email',
            role: 'user',
        });
        users.queryOne(invalidQuery);
    } catch (error) {
        console.log('   ✓ Caught validation error:', error instanceof Error ? error.message : error);
    }
    console.log();

    // 12. RENDER DEBUG INFO
    console.log('12. QUERY INSPECTION:');
    const sampleQuery = users.findById({ id: 'd577d021-1d38-4769-a27a-3a3a03d3425c' });
    console.log('   Raw SQL (with ?):', sampleQuery.sql);
    console.log('   Debug SQL (with $n):', sampleQuery.text);
    console.log('   Parameters:', sampleQuery.args);
    console.log();
}

// ============================================================================
// RUN THE DEMO
// ============================================================================

main().catch(console.error);

// ============================================================================
// EXPORT FOR USE IN OTHER FILES
// ============================================================================

export { UserRepository, PostRepository, users, posts };