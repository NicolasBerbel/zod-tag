// cli-dashboard.slop-test.ts
/**
 * CLI Dashboard with Persistent Prompt History
 * 
 * Showcases zod-tag's two-domain strength:
 * 1. Type-safe SQL for persisting LLM prompt configurations
 * 2. Composable prompt templates with validated parameterization
 * 
 * The dashboard lets users create, store, and render code review prompts
 * with different personas/formats, all backed by SQLite.
 */
import { z } from 'zod';
import { zt, type IRenderableKargs, type TagTypes } from '../../../dist/main.js';
import Database from 'better-sqlite3';

// ============================================================================
// DATABASE SETUP
// ============================================================================

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    persona TEXT NOT NULL CHECK(persona IN ('senior-dev', 'mentor', 'pedantic-reviewer')),
    format TEXT NOT NULL CHECK(format IN ('diff', 'bullets', 'checklist')),
    severity TEXT NOT NULL CHECK(severity IN ('gentle', 'strict', 'nitpicky')),
    focus_areas TEXT NOT NULL DEFAULT 'readability,performance',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prompt_executions (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    language TEXT NOT NULL,
    code_snippet TEXT NOT NULL,
    rendered_prompt TEXT NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES prompt_configs(id) ON DELETE CASCADE
  );
`);

// ============================================================================
// REUSABLE PROMPT BUILDING BLOCKS
// ============================================================================

/**
 * Persona block - sets the reviewer's "voice"
 * Uses selector function returning structure based on enum value
 */
const personaBlock = zt.z({
    persona: z.enum(['senior-dev', 'mentor', 'pedantic-reviewer']).default('mentor')
})`
${(ctx) => {
        switch (ctx.persona) {
            case 'senior-dev':
                return `Act as a senior software engineer with 15 years of experience. Flag architectural issues and subtle bugs.`;
            case 'mentor':
                return `Act as a supportive coding mentor who explains the *why* behind each suggestion. Prioritize teaching over criticizing.`;
            case 'pedantic-reviewer':
                return `Act as a strictly pedantic reviewer who flags every deviation from best practices, no matter how minor. Include references to style guides.`;
        }
    }}
`;

/**
 * Output format block - controls how the AI structures its response
 */
const outputFormatBlock = zt.z({
    format: z.enum(['diff', 'bullets', 'checklist']).default('bullets')
})`
${(ctx) => {
        const instructions: Record<string, string> = {
            diff: `Output your review as a unified diff patch with inline comments prefixed by "REVIEW:".`,
            bullets: `Output your review as a bulleted list grouped by severity (Critical, Warning, Suggestion).`,
            checklist: `Output your review as a markdown checklist that can be ticked off. Each item should start with "- [ ]".`,
        };
        return `\n[Output Format]: ${instructions[ctx.format]}\n`;
    }}
`;

/**
 * Severity block - influences how aggressive the feedback is
 */
const severityBlock = zt.z({
    severity: z.enum(['gentle', 'strict', 'nitpicky']).default('gentle')
})`
${(ctx) => {
        const modifiers: Record<string, string> = {
            gentle: `Focus only on impactful issues (bugs, security, major performance). Prefer positive reinforcement. Skip cosmetic feedback entirely.`,
            strict: `Flag all issues that could lead to bugs, performance problems, or maintainability concerns. Include explanations for each finding.`,
            nitpicky: `Flag every issue including stylistic inconsistencies, naming conventions, missing semicolons, and cosmetic concerns. Be exhaustive.`
        };
        return `[Severity Level]: ${ctx.severity.toUpperCase()}. ${modifiers[ctx.severity]}\n`;
    }}
`;

/**
 * Focus areas block - scopes the review to specific domains
 * Uses zt.join() to safely compose the focus areas list
 */
const focusAreasBlock = zt.z({
    focusAreas: z.array(
        z.enum(['security', 'performance', 'readability', 'testing', 'architecture', 'error-handling'])
    ).min(1).default(['readability', 'performance'])
})`
[Focus Areas]: ${(ctx) => zt.join(
    ctx.focusAreas.map(a => a as unknown) as unknown[],
    zt.t`, `
)}
Only comment on issues related to these domains unless a critical security vulnerability or bug is found outside them.
`;

// ============================================================================
// MAIN PROMPT TEMPLATE - COMPOSES ALL BLOCKS
// ============================================================================

/**
 * The full code review prompt.
 * 
 * Key design decisions visible in the template:
 * - personaBlock, outputFormatBlock, severityBlock, focusAreasBlock 
 *   are all RENDERABLES → they become STRUCTURE (merged into the prompt text)
 * - language and code are parameterized VALUES → go into the values array
 * - The selector `(ctx) => ctx.code` returns a primitive → it's a VALUE
 */
const codeReviewPrompt = zt.z({
    language: z.string().min(1).describe('The programming language of the code under review'),
    code: z.string().min(1).describe('The source code to review'),
})`
[System]
You are an automated code review assistant. Follow the instructions below exactly.

${personaBlock}
${outputFormatBlock}
${severityBlock}
${focusAreasBlock}

The following ${(ctx) => ctx.language} code was submitted for review.
Provide actionable, constructive feedback following the constraints above.

---
[Code to Review]
${(ctx) => ctx.code}
---
`;

// ============================================================================
// PROMPT CONFIGURATION STORAGE (SQL via zod-tag)
// ============================================================================

/**
 * Repository for storing and retrieving prompt configurations.
 * Demonstrates zod-tag for SQL while the prompt templates use zod-tag for text.
 */
class PromptConfigRepository {
    private readonly table = zt.unsafe(
        z.string().regex(/^\w+$/),
        'prompt_configs'
    );

    /**
     * SQL builder helper - same pattern as the other repo examples,
     * but used here to persist PROMPT configurations (not users/posts).
     */
    private sql = <S extends z.ZodRawShape>(shape: S) => {
        const schemaTag = zt.z(shape);
        type Params = z.input<z.ZodObject<S>>;

        return <
            L extends T,
            R extends T[],
            T extends TagTypes<z.output<z.ZodObject<S>>>
        >(strs: TemplateStringsArray, ...vals: [L, ...R]) => {
            const renderable = schemaTag(strs, ...vals as any);
            return (params: Params) => {
                const [queryStrings, ...queryArgs] = renderable.render(params as any);
                return {
                    sql: queryStrings.join('?'),
                    args: queryArgs,
                };
            };
        };
    };

    insert = this.sql({
        id: z.string().default(() => crypto.randomUUID()),
        name: z.string().min(1).max(100),
        persona: z.enum(['senior-dev', 'mentor', 'pedantic-reviewer']),
        format: z.enum(['diff', 'bullets', 'checklist']),
        severity: z.enum(['gentle', 'strict', 'nitpicky']),
        focusAreas: z.array(z.enum([
            'security', 'performance', 'readability',
            'testing', 'architecture', 'error-handling'
        ])).min(1),
    })`
    INSERT INTO ${this.table} (id, name, persona, format, severity, focus_areas)
    VALUES (
        ${e => e.id},
        ${e => e.name},
        ${e => e.persona},
        ${e => e.format},
        ${e => e.severity},
        ${e => e.focusAreas.join(',')}
    )
    RETURNING *
    `;

    findAll = this.sql({})`
    SELECT * FROM ${this.table}
    ORDER BY created_at DESC
    `;

    findByName = this.sql({
        name: z.string(),
    })`
    SELECT * FROM ${this.table}
    WHERE name = ${e => e.name}
    `;

    delete = this.sql({
        name: z.string(),
    })`
    DELETE FROM ${this.table}
    WHERE name = ${e => e.name}
    `;
}

// ============================================================================
// PROMPT EXECUTION LOGGING
// ============================================================================

class PromptExecutionRepository {
    private readonly table = zt.unsafe(
        z.string().regex(/^\w+$/),
        'prompt_executions'
    );

    private sql = <S extends z.ZodRawShape>(shape: S) => {
        const schemaTag = zt.z(shape);
        type Params = z.input<z.ZodObject<S>>;
        return <
            L extends T,
            R extends T[],
            T extends TagTypes<z.output<z.ZodObject<S>>>
        >(
            strs: TemplateStringsArray, ...vals: [L, ...R]
        ) => {
            const renderable = schemaTag(strs, ...vals as any);
            return (params: Params) => {
                const [queryStrings, ...queryArgs] = renderable.render(params as any);
                return { sql: queryStrings.join('?'), args: queryArgs };
            };
        };
    };

    log = this.sql({
        id: z.uuid().optional().default(() => crypto.randomUUID()),
        configId: z.string(),
        language: z.string(),
        codeSnippet: z.string(),
        renderedPrompt: z.string(),
    })`
    INSERT INTO ${this.table} (id, config_id, language, code_snippet, rendered_prompt)
    VALUES (
        ${e => e.id},
        ${e => e.configId},
        ${e => e.language},
        ${e => e.codeSnippet},
        ${e => e.renderedPrompt}
    )
    `;

    getHistory = this.sql({
        configId: z.string(),
        limit: z.number().int().positive().default(10),
    })`
    SELECT * FROM ${this.table}
    WHERE config_id = ${e => e.configId}
    ORDER BY executed_at DESC
    LIMIT ${e => e.limit}
    `;
}

// ============================================================================
// DASHBOARD ORCHESTRATOR
// ============================================================================

class CodeReviewDashboard {
    private configRepo = new PromptConfigRepository();
    private execRepo = new PromptExecutionRepository();

    /**
     * Save a reusable prompt configuration to the database.
     */
    saveConfig(params: {
        name: string;
        persona: 'senior-dev' | 'mentor' | 'pedantic-reviewer';
        format: 'diff' | 'bullets' | 'checklist';
        severity: 'gentle' | 'strict' | 'nitpicky';
        focusAreas: Array<'security' | 'performance' | 'readability' | 'testing' | 'architecture' | 'error-handling'>;
    }) {
        const query = this.configRepo.insert(params);
        const stmt = db.prepare(query.sql);
        const row = stmt.get(...query.args);
        console.log(`✓ Config "${params.name}" saved:`, row);
        return row;
    }

    /**
     * Execute a code review: load config, render prompt, log execution.
     * 
     * This is where both domains converge:
     * - SQL (zod-tag) retrieves the stored configuration
     * - Prompt template (zod-tag) renders the final LLM prompt
     * - SQL (zod-tag) logs the execution
     */
    review(configName: string, language: string, code: string) {
        // 1. Load config from SQL
        const findQuery = this.configRepo.findByName({ name: configName });
        const stmt = db.prepare(findQuery.sql);
        const config = stmt.get(...findQuery.args) as any;

        if (!config) {
            console.error(`✗ Config "${configName}" not found.`);
            return null;
        }

        // 2. Render the prompt (zod-tag template composition)
        const rendered = codeReviewPrompt.render({
            language,
            code,
            persona: config.persona,
            format: config.format,
            severity: config.severity,
            focusAreas: config.focus_areas.split(',') as any[],
        });

        const [strings, ...values] = rendered;
        const finalPrompt = zt.debug(rendered);

        // 3. Log execution to SQL
        const logQuery = this.execRepo.log({
            configId: config.id,
            language,
            codeSnippet: code.substring(0, 200),
            renderedPrompt: finalPrompt,
        });
        console.log('preparing...', { sql: logQuery.sql, args: logQuery.args })
        db.prepare(logQuery.sql).run(...logQuery.args);

        return {
            config: config.name,
            prompt: finalPrompt,
            /** The parameterized values (language and code remain as values, not structure) */
            parameterizedValues: values,
            /** SQL-style placeholders for inspection */
            sqlPlaceholders: zt.$n(rendered),
        };
    }

    /**
     * Show execution history for a config.
     */
    getHistory(configName: string, limit = 5) {
        const findQuery = this.configRepo.findByName({ name: configName });
        const stmt = db.prepare(findQuery.sql);
        const config = stmt.get(...findQuery.args) as any;

        if (!config) {
            console.error(`✗ Config "${configName}" not found.`);
            return [];
        }

        const histQuery = this.execRepo.getHistory({
            configId: config.id,
            limit,
        });
        const histStmt = db.prepare(histQuery.sql);
        return histStmt.all(...histQuery.args);
    }
}

// ============================================================================
// DEMO
// ============================================================================

const dashboard = new CodeReviewDashboard();

console.log('\n═══════════════════════════════════════════');
console.log('  ZOD-TAG CLI DASHBOARD DEMO');
console.log('  Prompt Configs (SQL) + Prompt Rendering');
console.log('═══════════════════════════════════════════\n');

// 1. Save some configurations (SQL via zod-tag)
console.log('─── Saving Prompt Configurations ───\n');

dashboard.saveConfig({
    name: 'quick-security-scan',
    persona: 'pedantic-reviewer',
    format: 'checklist',
    severity: 'strict',
    focusAreas: ['security', 'error-handling'],
});

dashboard.saveConfig({
    name: 'mentor-code-review',
    persona: 'mentor',
    format: 'bullets',
    severity: 'gentle',
    focusAreas: ['readability', 'performance', 'architecture'],
});

dashboard.saveConfig({
    name: 'architecture-audit',
    persona: 'senior-dev',
    format: 'diff',
    severity: 'strict',
    focusAreas: ['architecture', 'performance', 'testing'],
});

// 2. Execute reviews (prompt rendering via zod-tag composition)
console.log('\n─── Executing Code Reviews ───\n');

const review1 = dashboard.review(
    'quick-security-scan',
    'Python',
    `
def process_payment(user_input):
    query = "SELECT * FROM users WHERE id = " + user_input
    db.execute(query)
    process_order()
    `.trim()
);

console.log('Review 1 (quick-security-scan):');
console.log('  Config:', review1?.config);
console.log('  Parameterized values:', review1?.parameterizedValues);
console.log('  SQL placeholders preview:',
    review1?.sqlPlaceholders?.substring(0, 150) + '...');
console.log();

const review2 = dashboard.review(
    'mentor-code-review',
    'TypeScript',
    `
function add(a, b) {
    return a + b;
}
    `.trim()
);

console.log('Review 2 (mentor-code-review):');
console.log('  Config:', review2?.config);
console.log('  Full rendered prompt:');
console.log(review2?.prompt);
console.log();

// 3. Show that language and code remain as VALUES (not structure)
console.log('─── Structure vs Values Demonstration ───\n');

const rawRender = codeReviewPrompt.render({
    language: 'Rust',
    code: 'fn main() { println!("hello"); }',
    persona: 'mentor',
    format: 'bullets',
    severity: 'gentle',
    focusAreas: ['readability'],
});

const [strs, ...vals] = rawRender;
console.log('Strings (STRUCTURE - never contains user input):');
strs.forEach((s, i) => {
    const preview = s.length > 80 ? s.substring(0, 80) + '...' : s;
    console.log(`  [${i}]: ${JSON.stringify(preview)}`);
});
console.log('\nValues (PARAMETERIZED - user input is here):');
vals.forEach((v, i) => console.log(`  [${i}]: ${JSON.stringify(v)}`));

// 4. Show execution history
console.log('\n─── Execution History ───\n');

const history = dashboard.getHistory('quick-security-scan', 3);
console.log(`History for "quick-security-scan" (${history.length} entries):`);
(history as any[]).forEach((h: any, i: number) => {
    console.log(`  ${i + 1}. [${h.executed_at}] ${h.language} - ${h.code_snippet?.substring(0, 60)}...`);
});

console.log('\n═══════════════════════════════════════════');
console.log('  Key Takeaways:');
console.log('  1. Prompt blocks are RENDERABLES → merged as STRUCTURE');
console.log('  2. language/code are VALUES → always parameterized');
console.log('  3. SQL schema and prompt schema share zod-tag patterns');
console.log('  4. Config persistence + rendering = two domains, one library');
console.log('═══════════════════════════════════════════\n');

// ============================================================================
// TYPE SAFETY DEMONSTRATION
// ============================================================================

// The full prompt's inferred kargs include ALL nested block parameters
type FullPromptParams = IRenderableKargs<typeof codeReviewPrompt>;

// TypeScript enforces all these fields at compile time:
const validParams: FullPromptParams = {
    language: 'Go',
    code: 'func main() {}',
    persona: 'senior-dev',
    format: 'diff',
    severity: 'strict',
    focusAreas: ['architecture', 'performance', 'error-handling'],
};

console.log('✓ TypeScript validates FullPromptParams at compile time');
console.log('  Required fields:', Object.keys(validParams).join(', '));

export { CodeReviewDashboard, codeReviewPrompt, PromptConfigRepository };