/**
 * Zod-tag's internal decoupling of Zod 
 * 
 * This is a basic example of how higher order kinded types could enable attachment of different validation/schema libraries, not only zod.
 * 
 * Though TS do not have HKT, the SchemaHKT is a base utility abstract class that allow the primitives we need:
 * - A user land (adapter) code being able to define a interface for a set of type operations over a schema.
 * 
 * A SchemaSystem<SchemaType> interface would provide zod-tag the means of:
 * - infering input and output for a schema at the type level
 * - implementation of a set of operations needed by zod-tag to perform schema manipulation.
 * 
 * Then the `zt` namespace could be wrapped over a factory that receives a concrete implementation of a SchemaSystem.
 * 
 * In this file we have a base example of how would be implemented a ZodSchemaSystem (the current coupled sys of zod-tag)
 * 
 * A future api could be:
 * import { zt } from `zod-tag/zod`
 * import { zt } from `zod-tag/valibot`
 * 
 * It may be even possible to mix schemas depending on where a SchemaSystem is attached to, at zt namespace or IRenderable
 * 
 * This need further research but seems promising
 */
import z from 'zod'
import { type IRenderableKargs, zt } from '../../../dist/main.js'

// const sleep = (d = 300) => new Promise(r => setTimeout(r, d));
// const loadData = (data: any, d = 300) => sleep(d).then(() => data);


type Assume<T, U> = T extends U ? T : U;
type GenericFunction = (...x: never[]) => unknown;

/** Base abstraction for input/output schema inference HKT */
abstract class SchemaHKT {
    readonly Schema: unknown;
    output: GenericFunction = null!;
    input: GenericFunction = null!;
}

export type Schema<This extends SchemaHKT> = This['Schema']
export type SchemaType<This extends SchemaHKT, SchemaType> = Assume<This['Schema'], SchemaType>


type InferInput<F extends SchemaHKT, Schema> = ReturnType<
    (F & { readonly Schema: Schema; })["input"]
>;

type InferOutput<F extends SchemaHKT, Schema> = ReturnType<
    (F & { readonly Schema: Schema; })["output"]
>;


/**
 * A type level only schema system is a generalization over inference capabilities zod tag needs to perform type and runtime operations
 */
abstract class KindedSchemaSystem<T> extends SchemaHKT {
    /** The generic schema type of this system */
    Schema: T = null!;
    /** An type level only HKT inference mechamism for schema input used to determine kargs */
    abstract input: (schema: Schema<this>) => unknown;
    /** An type level only HKT inference mechamism for schema outputs used to determine kargs */
    abstract output: (schema: Schema<this>) => unknown;

}
/**
 * A schema system is a generalization over the validation and inference capabilities zod tag needs to perform type and runtime operations
 */
abstract class SchemaSystem<T> extends KindedSchemaSystem<T> {
    /** Construction */
    /** Create a object schema given a record shape and a trait mode */
    abstract create(shape: Record<string, T>, mode: 'loose' | 'strict' | 'strip'): T;
    /** Creates literal schema */
    abstract literal<L extends string | number>(value: L): T;
    /** Creates a union schema */
    abstract union(schemas: T[]): T;

    /** Validation */
    /** Synchronous validation method for this schema system */
    abstract safeParse(schema: T, value: unknown): { success: boolean; data?: any; error?: any };
    /** Asynchronous validation method for this schema system */
    abstract safeParseAsync?(schema: T, value: unknown): Promise<{ success: boolean; data?: any; error?: any }>;

    /** Introspection */
    /** Utility that extracts the raw shape of a given schema  */
    abstract getShape(schema: T): Record<string, T> | undefined;
    /** Type guard for schema type of this system */
    abstract isSchema(v: unknown): v is T;
    /** Determines if a given schema is async */
    abstract isAsync(schema: T): boolean;

    /** Composition */
    /** Merge two schemas into one for "intersect" merge strategy */
    abstract intersect?(a: T, b: T): T;
}

type SchemaOp<T, K extends keyof SchemaSystem<T>> = SchemaSystem<T>[K]

type CreateSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'create'>
type LiteralSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'literal'>
type UnionSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'union'>
type SafeParseSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'safeParse'>
type SafeParseAsyncSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'safeParseAsync'>
type GetShapeSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'getShape'>
type IsSchemaSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'isSchema'>
type IntersectSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'intersect'>
type IsAsyncSchema<T extends SchemaSystem<any>> = SchemaOp<T['Schema'], 'isAsync'>

/**
 * The zod schema system provides zod tag the methods necessary for its operations:
 * 
 * At the type level zod tag neets a way to infer the values input and the output of a given schema
 * 
 * At the runtime, zod tag needs ways to parse, merge, identify async schemas, and other low level operations. 
 */
class ZodSchemaSystem extends SchemaSystem<z.ZodType> {
    /** Type adapter */
    input!: (schema: Schema<this>) => z.input<typeof schema>;
    output!: (schema: Schema<this>) => z.output<typeof schema>;

    create: CreateSchema<this> = (shape, mode) => {
        return z.object(shape)[mode]()
    }
    literal: LiteralSchema<this> = (literal) => {
        return z.literal(literal)
    }
    union: UnionSchema<this> = (union) => {
        return z.union(union)
    }
    safeParse: SafeParseSchema<this> = (schema, value) => {
        return schema.safeParse(value);
    }
    safeParseAsync: SafeParseAsyncSchema<this> = (schema, value) => {
        return schema.safeParseAsync(value);
    }
    getShape: GetShapeSchema<this> = (schema) => {
        return (schema as any)?.shape;
    }
    isSchema: IsSchemaSchema<this> = (schema): schema is z.ZodType => {
        return !!((schema as any)?._zod);
    }
    intersect: IntersectSchema<this> = (a, b) => {
        return z.intersection(a, b)
    }
    isAsync: IsAsyncSchema<this> = (schema): schema is z.ZodType => {
        return false; // current _isAsyncSchema
    };
}


// Tests
const nestSchema = z.object({
    level1: z.object({
        level2: z.string().transform(async (e) => parseInt(e))
    })
})

type TestSchemaInput = InferInput<ZodSchemaSystem, typeof nestSchema>
type TestSchemaOutput = InferOutput<ZodSchemaSystem, typeof nestSchema>

type TestSchema = Schema<ZodSchemaSystem>

// Input valid
const Input: TestSchemaInput = null! as {
    level1: {
        level2: string;
    };
}
// @ts-expect-error InputError invalid 
const InputError: TestSchemaInput = null! as {
    level1: {};
}

// Output valid
const Output: TestSchemaOutput = null! as {
    level1: {
        level2: number;
    };
}
// @ts-expect-error OutputError invalid 
const OutputError: TestSchemaOutput = null! as {
    level1: {};
}