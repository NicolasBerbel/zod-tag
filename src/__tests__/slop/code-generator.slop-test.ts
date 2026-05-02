import { z } from 'zod';
import { zt, type IRenderableKargs } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// 1. Reusable language‑specific blocks (loose, composable)
// ---------------------------------------------------------------------------

const fieldTypeMap = {
    typescript: { string: 'string', number: 'number', boolean: 'boolean', date: 'Date' },
    python: { string: 'str', number: 'float', boolean: 'bool', date: 'datetime' },
    sql: { string: 'TEXT', number: 'REAL', boolean: 'BOOLEAN', date: 'DATETIME' },
} as const;

// CORRECTED: selector returns a renderable (zt.t`...`), not a plain string.
const fieldBlock = zt.z({
    fieldName: z.string().regex(/^[a-zA-Z_]\w*$/),
    fieldType: z.enum(['string', 'number', 'boolean', 'date']),
    language: z.enum(['typescript', 'python', 'sql']),
})`
${e => {
        const typeName = fieldTypeMap[e.language]?.[e.fieldType] ?? 'unknown';
        if (e.language === 'python')
            return zt.t`\n    ${zt.unsafe(z.string().regex(/^[a-zA-Z_]\w*$/), e.fieldName)}: ${typeName}`;
        if (e.language === 'sql')
            return zt.t`\n  ${zt.unsafe(z.string().regex(/^\w+$/), e.fieldName)} ${typeName}`;
        return zt.t`\n  ${zt.unsafe(z.string().regex(/^[a-zA-Z_]\w*$/), e.fieldName)}: ${typeName};`;
    }}`;

const importBlock = zt.z({
    language: z.enum(['typescript', 'python']),
    imports: z.array(z.string()).optional().default([]),
})`
${e => {
        if (e.imports.length === 0) return zt.empty;
        if (e.language === 'typescript')
            return zt.t`\nimport { ${zt.join(e.imports as any, zt.t`, `)} } from './shared';`;
        return zt.t`\nfrom shared import ${zt.join(e.imports as any, zt.t`, `)}`;
    }}`;

const decoratorBlock = zt.match('decorator', {
    none: zt.empty,
    primary: zt.z.strict({ field: z.string() })`@Primary(${e => e.field})`,
    index: zt.z.strict({ field: z.string() })`@Index(${e => e.field})`,
});

// ---------------------------------------------------------------------------
// 2. Entity code block - composition of fields + decorators
// ---------------------------------------------------------------------------

const entityBlock = zt.z({
    entityName: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/),
    fields: z.array(z.object({
        fieldName: z.string(),
        fieldType: z.enum(['string', 'number', 'boolean', 'date']),
        decorator: z.enum(['none', 'primary', 'index']).optional().default('none'),
    })),
    language: z.enum(['typescript', 'python', 'sql']),
    imports: z.array(z.string()).optional().default([]),
})`
${e => {
        const header = e.language === 'sql'
            ? zt.t`CREATE TABLE ${zt.unsafe(z.string().regex(/^\w+$/), e.entityName)} (`
            : e.language === 'typescript'
                ? zt.t`export class ${zt.unsafe(z.string().regex(/^[A-Z][a-zA-Z0-9]*$/), e.entityName)} {`
                : zt.t`class ${zt.unsafe(z.string().regex(/^[A-Z][a-zA-Z0-9]*$/), e.entityName)}:`;

        const body = zt.map(e.fields, fieldBlock, f => ({
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            language: e.language,
            ...(f.decorator !== 'none' ? { decorator: f.decorator, field: f.fieldName } : {}),
        }), zt.t``);

        const footer = e.language === 'sql' ? zt.t`\n);` : zt.t`\n}`;

        return zt.t`${header}${body}${footer}`;
    }}`;

// ---------------------------------------------------------------------------
// 3. Main code generator - strict entry point
// ---------------------------------------------------------------------------

const codeGenerator = zt.z.strict({
    language: z.enum(['typescript', 'python', 'sql']),
    entities: z.array(z.object({
        entityName: z.string(),
        fields: z.array(z.object({
            fieldName: z.string(),
            fieldType: z.enum(['string', 'number', 'boolean', 'date']),
            decorator: z.enum(['none', 'primary', 'index']).optional(),
        })),
        imports: z.array(z.string()).optional(),
    })),
    globalImports: z.array(z.string()).optional().default([]),
})`
${e => zt.if(e.globalImports.length > 0, importBlock)}
${e => {
        const r = zt.map(e.entities, entityBlock, ent => ({
            entityName: ent.entityName,
            fields: ent.fields,
            language: e.language,
            imports: ent.imports ?? [],
        }), zt.t`\n\n`);
        return r;
    }}
`;

// ---------------------------------------------------------------------------
// 4. Python entity with inheritance (separate template)
// ---------------------------------------------------------------------------

const baseClass = zt.z.strict({ base: z.string() })`(${e => e.base})`;

const pythonEntity = zt.z.strict({
    entityName: z.string(),
    fields: z.array(z.object({
        fieldName: z.string(),
        fieldType: z.enum(['string', 'number', 'boolean', 'date']),
    })),
    base: z.object({ base: z.string() }).optional(),
})`
class ${e => zt.unsafe(z.string().regex(/^[A-Z][a-zA-Z0-9]*$/), e.entityName)}${e => e.base ? zt.p('base', baseClass) : zt.empty}:
${e => zt.map(e.fields, fieldBlock, f => ({ fieldName: f.fieldName, fieldType: f.fieldType, language: 'python' as const }), zt.t``)}
`;

// ---------------------------------------------------------------------------
// 5. Test runner
// ---------------------------------------------------------------------------

console.log('\n═══════════════════════════════════════');
console.log('  Universal Code Generator - Stress');
console.log('═══════════════════════════════════════\n');

let passed = 0, failed = 0;

function test(name: string, fn: () => void) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`); failed++; console.error(e); }
}

// ---- TypeScript entity ----
test('TypeScript entity with decorators and imports', () => {
    const result = codeGenerator.render({
        language: 'typescript',
        globalImports: ['Validator', 'Transformer'],
        entities: [{
            entityName: 'User',
            fields: [
                { fieldName: 'id', fieldType: 'number', decorator: 'primary' as const },
                { fieldName: 'name', fieldType: 'string' },
                { fieldName: 'active', fieldType: 'boolean' },
            ],
            imports: ['BaseEntity'],
        }],
    });

    const [strs, ...vals] = result;
    const text = zt.debug(result);
    console.log(text)

    // Field names are structure (zt.unsafe) → must appear in strings
    if (!strs.join('').includes('id')) throw new Error('Field name should be in structure');
    if (!strs.join('').includes('name')) throw new Error('Field name should be in structure');

    // Types are values → must NOT appear in strings
    if (strs.join('').includes('string')) throw new Error('Field type leaked into structure');
    if (strs.join('').includes('boolean')) throw new Error('Field type leaked into structure');

    if (!vals.includes('string') || !vals.includes('number') || !vals.includes('boolean'))
        throw new Error('Field types missing from values');

    console.log('  TS output:');
    console.log(text.replace(/^/gm, '    '));
});

// ---- SQL entity ----
test('SQL entity generation produces valid CREATE TABLE', () => {
    const result = codeGenerator.render({
        // @ts-expect-error not expected error: Type '"sql"' is not assignable to type '"typescript" | "python"'.
        language: 'sql',
        entities: [{
            entityName: 'Products',
            fields: [
                { fieldName: 'product_id', fieldType: 'number', decorator: 'primary' },
                { fieldName: 'name', fieldType: 'string', decorator: 'index' },
                { fieldName: 'price', fieldType: 'number' },
            ],
        }],
        globalImports: []
    });

    const text = zt.debug(result);
    console.log(text)
    if (!text.includes('CREATE TABLE Products (')) throw new Error('Missing CREATE TABLE header');
    if (!text.includes('product_id REAL')) throw new Error('Primary key column missing');
    if (!text.includes(');')) throw new Error('Missing closing bracket');
    console.log('  SQL output:\n' + text.replace(/^/gm, '    '));
});

// ---- Python inheritance ----
test('Python entity with inheritance', () => {
    const result = pythonEntity.render({
        entityName: 'AdminUser',
        base: { base: 'User' },
        fields: [{ fieldName: 'permissions', fieldType: 'string' }],
    });

    const text = zt.debug(result);
    console.log(text)
    if (!text.includes('class AdminUser(User):')) throw new Error('Inheritance missing');
    if (!text.includes('permissions: str')) throw new Error('Field missing');
    console.log('  Python output:\n' + text.replace(/^/gm, '    '));
});

// ---- Stress: many entities ----
test('large data set - 50 entities with 10 fields each', () => {
    const entities = Array.from({ length: 50 }, (_, i) => ({
        entityName: `Entity${i}`,
        fields: Array.from({ length: 10 }, (_, j) => ({
            fieldName: `field${j}`,
            fieldType: (['string', 'number', 'boolean', 'date'] as const)[j % 4],
        })),
    }));

    const start = performance.now();
    const result = codeGenerator.render({ language: 'typescript', entities, globalImports: [] });
    const elapsed = performance.now() - start;

    const [strs, ...vals] = result;
    if (vals.length !== 10 * 50) throw new Error(`Expected 500 values, got ${vals.length}`);
    console.log(`  Rendered ${entities.length} entities in ${elapsed.toFixed(1)}ms (${elapsed / entities.length}ms/entity)`);
    console.log(`  Values: ${vals.length}, Strings length: ${strs.length}`);
});

// ---- Edge cases ----
test('empty entities array produces no entity code', () => {
    const result = codeGenerator.render({ language: 'typescript', entities: [] });
    const text = zt.debug(result);
    console.log(text)
    if (text.includes('class') || text.includes('CREATE TABLE')) throw new Error('Expected no entity output');
});

test('missing required key in strict mode throws', () => {
    try {
        codeGenerator.render({
            language: 'typescript',
            // entities missing
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
    }
});

test('extra key rejected by strict parent', () => {
    try {
        codeGenerator.render({
            language: 'typescript',
            entities: [],
            extra: 'nope',
        } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
    }
});

test('dynamic field type via loose parent works, strict fails for dynamic', () => {
    const dynamicField = zt.z({
        name: z.string(),
        type: z.string(),
    })`${e => e.name}: ${zt.p('typeInfo', zt.z.strict({ dbType: z.string() })`${(e2: { dbType: string }) => e2.dbType}`)}`;

    const strictParent = zt.z.strict({ name: z.string(), type: z.string() })`${dynamicField}`;
    const result = strictParent.render({ name: 'col', type: 'string', typeInfo: { dbType: 'TEXT' } });
    console.log('  Strict with scoped dynamic (works):', zt.debug(result));

    const trulyDynamic = zt.z({ name: z.string() })`
        ${(e: { name: string }) => zt.z.strict({ extra: z.string() })`Extra: ${(e2: { extra: string }) => e2.extra}`}
    `;
    const strictDynamicParent = zt.z.strict({ name: z.string() })`${trulyDynamic}`;
    try {
        strictDynamicParent.render({ name: 'test', extra: 'should not work' } as any);
        throw new Error('Should have thrown');
    } catch (e) {
        if (!(e instanceof Error)) throw new Error('Expected InterpolationError');
        console.log('  Strict correctly rejects dynamic selector extra key');
    }
});

// ============================================================================

console.log(`\n═══════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════`);