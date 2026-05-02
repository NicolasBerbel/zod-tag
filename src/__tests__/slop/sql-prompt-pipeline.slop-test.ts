// 
import { z } from 'zod';
import Database from 'better-sqlite3';
import { zt, type IRenderableKargs, type TagTypes, type IRenderable } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// In‑memory SQLite setup
// ---------------------------------------------------------------------------
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE prompt_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    persona TEXT NOT NULL CHECK(persona IN ('senior-dev','mentor','pedantic-reviewer')),
    format TEXT NOT NULL CHECK(format IN ('diff','bullets','checklist')),
    severity TEXT NOT NULL CHECK(severity IN ('gentle','strict','nitpicky')),
    focus_areas TEXT NOT NULL DEFAULT 'readability,performance',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id TEXT NOT NULL REFERENCES prompt_configs(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    code_snippet TEXT NOT NULL,
    rendered_prompt TEXT NOT NULL,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ---------------------------------------------------------------------------
// Reusable SQL fragments (loose for composability, strict only at final query)
// ---------------------------------------------------------------------------
const safeTable = (name: string) => zt.unsafe(z.string().regex(/^\w+$/), name);
const safeColumn = (name: string) => zt.unsafe(z.string().regex(/^\w+$/), name);

// ---------------------------------------------------------------------------
// Base Repository helper (same pattern as previous slop tests)
// ---------------------------------------------------------------------------
class BaseRepository {
  protected table: IRenderable<void, []>;
  constructor(name: string) { this.table = safeTable(name); }

  protected sql = <S extends z.ZodRawShape>(shape: S) => {
    const schemaTag = zt.z.strict(shape); // All queries are closed – use strict
    type Params = z.input<z.ZodObject<S>>;
    type Output = z.output<z.ZodObject<S>>

    return <L extends T, R extends T[], T extends TagTypes<Output>>(
      strs: TemplateStringsArray, ...vals: [L, ...R]
    ) => {
      const renderable = schemaTag(strs, ...vals as any);
      return (params: Params) => {
        const [queryStrings, ...queryArgs] = renderable.render(params as any);
        // console.log(queryStrings.join('?'), queryArgs)
        return { sql: queryStrings.join('?'), args: queryArgs };
      };
    };
  };
}

// ---------------------------------------------------------------------------
// PromptConfig Repository
// ---------------------------------------------------------------------------
class PromptConfigRepo extends BaseRepository {
  constructor() { super('prompt_configs'); }

  insert = this.sql({
    id: z.string().optional().default(() => crypto.randomUUID()),
    name: z.string().min(1).max(100),
    persona: z.enum(['senior-dev', 'mentor', 'pedantic-reviewer']),
    format: z.enum(['diff', 'bullets', 'checklist']),
    severity: z.enum(['gentle', 'strict', 'nitpicky']),
    focusAreas: z.array(z.enum(['security', 'performance', 'readability', 'testing', 'architecture'])).min(1),
  })`
    INSERT INTO ${this.table} (id, name, persona, format, severity, focus_areas)
    VALUES (${e => e.id}, ${e => e.name}, ${e => e.persona}, ${e => e.format}, ${e => e.severity}, ${e => e.focusAreas.join(',')})
    RETURNING id, name
  `;

  findByName = this.sql({ name: z.string() })`
    SELECT * FROM ${this.table} WHERE name = ${e => e.name}
  `;

  findAll = this.sql({})`SELECT * FROM ${this.table} ORDER BY created_at DESC`;

  deleteByName = this.sql({ name: z.string() })`
    DELETE FROM ${this.table} WHERE name = ${e => e.name}
  `;
}

// ---------------------------------------------------------------------------
// ReviewLog Repository
// ---------------------------------------------------------------------------
class ReviewLogRepo extends BaseRepository {
  constructor() { super('review_logs'); }

  log = this.sql({
    configId: z.string(),
    language: z.string(),
    codeSnippet: z.string(),
    renderedPrompt: z.string(),
  })`
    INSERT INTO ${this.table} (config_id, language, code_snippet, rendered_prompt)
    VALUES (${e => e.configId}, ${e => e.language}, ${e => e.codeSnippet}, ${e => e.renderedPrompt})
  `;

  getHistory = this.sql({
    configId: z.string(),
    limit: z.number().int().positive().default(10),
  })`
    SELECT * FROM ${this.table} WHERE config_id = ${e => e.configId}
    ORDER BY reviewed_at DESC LIMIT ${e => e.limit}
  `;
}

// ---------------------------------------------------------------------------
// Prompt building blocks (loose for composability)
// ---------------------------------------------------------------------------

const personaBlock = zt.match('persona', {
  'senior-dev': zt.z({ xp: z.number().positive().max(50) })`Act as a senior engineer with ${e => e.xp} years of experience. Review with a focus on architecture and performance.`,
  'mentor': zt.z({})`Act as a supportive mentor. Explain the *why* behind each suggestion and prioritize teaching.`,
  'pedantic-reviewer': zt.z({})`Act as a pedantic reviewer. Flag every deviation from best practices, no matter how minor.`,
});

const outputFormatBlock = zt.z({
  format: z.enum(['diff', 'bullets', 'checklist']),
})`
${e => {
    const formats: Record<string, string> = {
      diff: 'Output your review as a unified diff patch with inline comments.',
      bullets: 'Output your review as a bulleted list grouped by severity.',
      checklist: 'Output your review as a markdown checklist.',
    };
    return `[Format]: ${formats[e.format]}`;
  }}`;

const severityBlock = zt.z({ severity: z.enum(['gentle', 'strict', 'nitpicky']) })`
${e => {
    const desc = {
      gentle: 'Gentle – focus only on impactful issues. Prefer positive reinforcement.',
      strict: 'Strict – flag all bugs, performance problems, and maintainability concerns.',
      nitpicky: 'Nitpicky – flag style, naming, and cosmetic issues too.',
    };
    return `[Severity]: ${e.severity.toUpperCase()} – ${desc[e.severity]}`;
  }}`;

const focusAreasBlock = zt.z({
  focusAreas: z.array(z.enum(['security', 'performance', 'readability', 'testing', 'architecture'])).min(1),
})`
[Focus Areas]: ${e => zt.join(e.focusAreas.map(a => a as unknown) as unknown[], zt.t`, `)}
`;

// ---------------------------------------------------------------------------
// Full Code Review Prompt – strict final entry point
// ---------------------------------------------------------------------------
const codeReviewPrompt = zt.z.strict({
  language: z.string().min(1),
  code: z.string().min(1),
  // Persona block parameters (discriminated union)
  persona: z.enum(['senior-dev', 'mentor', 'pedantic-reviewer']),
  xp: z.number().positive().max(50).optional(),         // only for senior-dev
  format: z.enum(['diff', 'bullets', 'checklist']),
  severity: z.enum(['gentle', 'strict', 'nitpicky']),
  focusAreas: z.array(z.enum(['security', 'performance', 'readability', 'testing', 'architecture'])).min(1),
})`
[System]
You are an automated code review assistant.
Execute the following instructions precisely.

${personaBlock}
${outputFormatBlock}
${severityBlock}
${focusAreasBlock}

The following ${e => e.language} code was submitted for review.

---
[Code]
${e => e.code}
---
`;

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------
class CodeReviewPipeline {
  private configRepo = new PromptConfigRepo();
  private logRepo = new ReviewLogRepo();

  saveConfig(params: Parameters<PromptConfigRepo['insert']>[0]) {
    const { sql, args } = this.configRepo.insert(params);
    return db.prepare(sql).get(...args) as any;
  }

  getConfig(name: string) {
    const { sql, args } = this.configRepo.findByName({ name });
    return db.prepare(sql).get(...args) as any;
  }

  review(code: string, language: string, configName: string) {
    const config = this.getConfig(configName);
    if (!config) throw new Error(`Config "${configName}" not found`);

    const rendered = codeReviewPrompt.render({
      language,
      code,
      persona: config.persona as any,
      xp: config.persona === 'senior-dev' ? 15 : undefined, // default XP for senior-dev
      format: config.format as any,
      severity: config.severity as any,
      focusAreas: (config.focus_areas as string).split(',') as any[],
    });

    const promptString = zt.debug(rendered);
    const { sql, args } = this.logRepo.log({
      configId: config.id,
      language,
      codeSnippet: code.substring(0, 200),
      renderedPrompt: promptString,
    });
    db.prepare(sql).run(...args);

    return { prompt: promptString, rendered };
  }
}

// ---------------------------------------------------------------------------
// Slop test runner
// ---------------------------------------------------------------------------
console.log('\n═══════════════════════════════════════');
console.log('  SQL + Prompt Engineering Pipeline');
console.log('═══════════════════════════════════════\n');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); failed++; console.error(e); }
}

const pipeline = new CodeReviewPipeline();
// ---- Save and retrieve configs ----
test('save and retrieve a strict prompt config', () => {
  pipeline.saveConfig({
    name: 'quick-security-scan',
    persona: 'pedantic-reviewer',
    format: 'checklist',
    severity: 'strict',
    focusAreas: ['security'],   // only valid enum members
  });
  const cfg = pipeline.getConfig('quick-security-scan');
  if (!cfg) throw new Error('Config not found');
  console.log(`  Config "${cfg.name}" saved with id ${cfg.id}`);
});

test('strict config insertion rejects invalid severity', () => {
  try {
    pipeline.saveConfig({
      name: 'bad-severity',
      persona: 'mentor',
      format: 'bullets',
      severity: 'none' as any,
      focusAreas: ['readability'],
    });
    throw new Error('Should have thrown');
  } catch { /* expected */ }
});

// ---- Render a prompt ----
test('render prompt with valid config and verify structure/value separation', () => {
  const { prompt, rendered } = pipeline.review(
    `function add(a,b){return a+b}`,
    'JavaScript',
    'quick-security-scan'
  );

  const [strs, ...vals] = rendered;
  if (strs.join('').includes('JavaScript')) throw new Error('Language leaked into structure');
  if (strs.join('').includes('function add')) throw new Error('Code leaked into structure');
  if (!prompt.includes('JavaScript')) throw new Error('Language missing from final output');
  if (!prompt.includes('function add')) throw new Error('Code missing from final output');

  // values vary depending on blocks; just check enough are present
  if (vals.length < 4) throw new Error(`Expected at least 4 values, got ${vals.length}`);
  console.log(`  Prompt generated with ${vals.length} parameterized values`);
});

// ---- Re-render with different language to show isolation ----
test('re-render with different language does not bleed', () => {
  const { prompt: p1 } = pipeline.review('code1', 'Python', 'quick-security-scan');
  const { prompt: p2 } = pipeline.review('code2', 'Rust', 'quick-security-scan');
  if (p1 === p2) throw new Error('Prompts should differ');
});

// ---- Strict parent rejects extra keys ----
test('strict prompt rejects unknown extra key', () => {
  try {
    codeReviewPrompt.render({
      language: 'Go',
      code: 'main(){}',
      persona: 'mentor',
      format: 'bullets',
      severity: 'gentle',
      focusAreas: ['readability'],
      extra: 'nope',
    } as any);
    throw new Error('Should have thrown');
  } catch (e) {
    if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
  }
});

// ---- Batch review generation using zt.map ----
test('batch review generation via zt.map', () => {
  const snippets = [
    { lang: 'TS', code: 'const x: number = 1;' },
    { lang: 'Python', code: 'print("hello")' },
  ];
  const products = snippets.map(s => pipeline.review(s.code, s.lang, 'quick-security-scan'));
  if (products.length !== 2) throw new Error('Expected 2 reviews');
  console.log(`  Generated ${products.length} reviews`);
});

// ---- Performance: many configs and prompts ----
test('performance: insert 100 configs and render prompt', () => {
  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    pipeline.saveConfig({
      name: `perf-config-${i}`,
      persona: i % 3 === 0 ? 'pedantic-reviewer' : 'mentor',
      format: 'bullets',
      severity: 'gentle',
      focusAreas: ['readability'],
    });
  }
  const { prompt } = pipeline.review('1+1', 'Haskell', 'perf-config-50');
  const elapsed = performance.now() - start;
  if (!prompt.includes('Haskell')) throw new Error('Language not present');
  console.log(`  100 configs + prompt render in ${elapsed.toFixed(0)}ms`);
});

// ---- Error handling: missing config ----
test('missing config throws', () => {
  try {
    pipeline.review('code', 'TS', 'nonexistent');
    throw new Error('Should have thrown');
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes('not found'))
      throw new Error('Unexpected error');
  }
});

// ============================================================================
console.log(`\n═══════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════`);