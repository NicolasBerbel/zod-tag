import z from 'zod'
import { type IRenderableKargs, zt } from '../../../dist/main.js'

const sleep = (d = 300) => new Promise(r => setTimeout(r, d));
const loadData = (data: any, d = 300) => sleep(d).then(() => data);

const r1 = zt.t`Hello ${1} World`
const r2 = zt.t`Good ${'val'} bye!`
const r3 = zt.z({ syncName: z.string() })`Sync ${e => e.syncName}!`

const isAsyncConstructor = (fn: any) => fn?.constructor.name.includes('AsyncFunction')

export const isAsyncSchema = (schema?: z.ZodType) : boolean => {
    let _schema = schema as any;
    if (!_schema?.def) return false;
    // unwrap optionals/defaults
    while (_schema.def.innerType) {
        _schema = _schema.def.innerType ? _schema.def.innerType : _schema;
    }
    // transforms/refines/pipes
    if (_schema.def.in || _schema.def.out) return isAsyncSchema(_schema.def.in) || isAsyncSchema(_schema.def.out)
    // intersection
    if (_schema.def.left || _schema.def.right) return isAsyncSchema(_schema.def.left) || isAsyncSchema(_schema.def.right)
    // union shapes
    if (_schema.options) return _schema.options.some(isAsyncSchema)
    // object shapes
    if (_schema.shape) return Object.keys(_schema.shape).some(k => isAsyncSchema(_schema.shape[k]))
    // arrays
    if (_schema.element) return isAsyncSchema(_schema.element)
    // tuples
    if (_schema.def.items) return _schema.def.items.some(isAsyncSchema)
    // records/sets
    if (_schema.def.keyType || _schema.def.valueType) return isAsyncSchema(_schema.def.keyType) || isAsyncSchema(_schema.def.valueType)
    // transform fns
    if (_schema.def.transform && isAsyncConstructor(_schema.def.transform)) return true;
    // refine fns
    if (_schema.def.fn && isAsyncConstructor(_schema.def.fn)) return true;
    if (_schema.def.checks?.length) return _schema.def.checks.some(isAsyncSchema);

    return false;
}


// ── Test schemas ────────────────────────────────────────────────────

// ── Async leaf schemas ───────────────────────────────────────────────
const asyncStrTransform = z.string().transform(async (v) => v);
const asyncStrRefine = z.string().refine(async (v) => true);
const asyncPreprocess = z.preprocess(async (v) => v, z.string());

// ── Test schemas ─────────────────────────────────────────────────────
const tests: [string, z.ZodType, boolean][] = [
    // Pure sync primitives
    ["syncString", z.string(), false],
    ["syncNumber", z.number(), false],
    ["syncBoolean", z.boolean(), false],
    ["syncDate", z.date(), false],

    // Sync containers
    ["syncObject", z.object({ a: z.string() }), false],
    ["syncArray", z.array(z.string()), false],
    ["syncTuple", z.tuple([z.string(), z.number()]), false],
    ["syncRecord", z.record(z.string(), z.number()), false],
    ["syncMap", z.map(z.string(), z.number()), false],
    ["syncSet", z.set(z.string()), false],

    // Sync composites
    ["syncUnion", z.union([z.string(), z.number()]), false],
    ["syncIntersection", z.intersection(
        z.object({ a: z.string() }),
        z.object({ b: z.number() })
    ), false],
    ["syncDiscriminated", z.discriminatedUnion("type", [
        z.object({ type: z.literal("x"), val: z.string() }),
        z.object({ type: z.literal("y"), val: z.number() }),
    ]), false],

    // Async leaves
    ["asyncTransform", asyncStrTransform, true],
    ["asyncRefine", asyncStrRefine, true],
    ["asyncPreprocess", asyncPreprocess, true],

    // Containers with async inner
    ["asyncArray", z.array(asyncStrTransform), true],
    ["asyncTuple", z.tuple([asyncStrTransform, z.number()]), true],
    ["asyncRecord", z.record(z.string(), asyncStrTransform), true],
    ["asyncMapKey", z.map(asyncStrTransform, z.number()), true],
    ["asyncMapValue", z.map(z.string(), asyncStrTransform), true],
    ["asyncSet", z.set(asyncStrTransform), true],

    // Nested objects
    ["asyncObjectDeep", z.object({
        level1: z.object({
            level2: asyncStrTransform
        })
    }), true],
    ["syncTransformOnAsyncObject", z.object({
        a: z.string().transform(async v => v)
    }).transform(v => v), true],

    // Composites
    ["asyncUnion", z.union([z.number(), asyncStrTransform]), true],
    ["asyncIntersection", z.intersection(
        z.object({ a: asyncStrTransform }),
        z.object({ b: z.number() })
    ), true],
    ["asyncDiscriminated", z.discriminatedUnion("type", [
        z.object({ type: z.literal("x"), val: asyncStrTransform }),
        z.object({ type: z.literal("y"), val: z.number() }),
    ]), true],

    // Wrappers – toggling async status stays
    ["asyncOptional", asyncStrTransform.optional(), true],
    ["asyncOptionalDefault", asyncStrTransform.optional().default(''), true],
    ["asyncNullable", asyncStrTransform.nullable(), true],
    ["asyncDefault", asyncStrTransform.default("fallback"), true],
    ["asyncCatch", asyncStrTransform.catch("fallback"), true],
    ["asyncBranded", asyncStrTransform.brand("X"), true],
    ["asyncDoubleWrap", z.string().transform(async v => v).optional().default('x'), true],

    // Pipeline with async stage
    ["asyncPipeline", z.pipe(
        z.string(),
        z.string().transform(async (v) => v)
    ), true],

    // Sync wrappers should stay false
    ["syncOptional", z.string().optional(), false],
    ["syncNullable", z.string().nullable(), false],
    ["syncDefault", z.string().default("x"), false],
];

// ── Execute ──────────────────────────────────────────────────────────
console.log("Testing async schema detection (structural):\n");
let allPassed = true;
for (const [name, schema, expected] of tests) {
    const result = isAsyncSchema(schema);
    const status = result === expected ? "✅" : "❌";
    if (result !== expected) {
        allPassed = false;
        console.log(`${status} ${name.padEnd(25)} expected=${expected}  got=${result}`);
    } else {
        console.log(`${status} ${name.padEnd(25)} expected=${expected}  got=${result}`);
    }
}
console.log("\n" + (allPassed ? "All tests passed." : "Some tests FAILED."));

const asyncStringSchema = z.string().transform(async (v) => loadData(v.toUpperCase()))

const asyncTemplate = zt.z({
    name: asyncStringSchema,
})`Good ${'val'} bye!`

const parent = zt`
    ---- R1:
    ${r1}

    ---- R2:
    ${r2}

    ---- SYNC:
    ${r3}

    ---- ASYNC:
    ${asyncTemplate}
`

const kargs: IRenderableKargs<typeof parent> = {
    name: 'name is transformed with async op',
    syncName: '"sync name"'
};


console.log(parent, await parent.renderAsync(kargs), zt.debug(await parent.renderAsync(kargs)))