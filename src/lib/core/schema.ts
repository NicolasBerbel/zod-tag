import z from "zod"
import { type IZodTagRenderable } from "./renderable"
import { getSlotSchema, getSlotScope, getSlotShape } from "./slot"
import { buildScopedShape } from "./scope"

/** { ...a, ...b } */
export function shallowMerge(
    base: Record<string, any> | undefined,
    incoming: Record<string, any> | undefined
): Record<string, any> {
    return {
        ...base,
        ...incoming,
    }
}

/**
 * z.intersection(base[key], incoming[key])
 */
export function intersectShapes(
    base: Record<string, any> | undefined,
    incoming: Record<string, any> | undefined
): Record<string, any> {
    if (!base) return incoming ?? {}
    if (!incoming) return base

    const merged = { ...base }
    for (const [key, schema] of Object.entries(incoming)) {
        if (key in merged) {
            merged[key] = z.intersection(merged[key], schema)
        } else {
            merged[key] = schema
        }
    }
    return merged
}

/** Schema guard */
export const isSchemaType = (v: unknown): v is z.ZodType => !!(v as any)?._zod

export const mergeSchemaStrategies = {
    shallow: shallowMerge,
    intersect: intersectShapes,
}

/** Merge strategy identifier */
export type MergeSchemaStrategy = keyof typeof mergeSchemaStrategies

/** Merge two shapes with given strategy */
export const mergeShapes = <
    A extends z.ZodRawShape,
    B extends z.ZodRawShape,
    K extends MergeSchemaStrategy,
>(shapeA: A, shapeB: B, strategy: K) => mergeSchemaStrategies[strategy](shapeA, shapeB);



/**
 * Merges two schemas
 * @returns tuple with [resultSchema: ZodType | undefined, isMerged: boolean]
 */
export const mergeSchemas = (
    schema: z.ZodType | undefined,
    value: IZodTagRenderable<any, any> | z.ZodType | undefined,
    mergeStrategy: MergeSchemaStrategy,
    schemaStrategy: CreateSchemaStrategy,
) => {
    let _schema = schema;
    let merged = false;

    const slotShape = getSlotShape(value)
    if (slotShape) {
        const slotSchema = getSlotSchema(value)
        const nestedScope = getSlotScope(value)
        const scopedShape = nestedScope?.length ? buildScopedShape(slotSchema, nestedScope) : slotShape;
        const newShape = mergeShapes(getSlotShape(schema), scopedShape, mergeStrategy)

        if (Object.keys(newShape).length > 0) {
            _schema = createSchema(newShape, schemaStrategy)
            merged = true
        }
    }

    return [_schema, merged] as const
}

export const createSchemaStrategies = {
    loose: <T extends z.ZodRawShape>(s: T) => z.object(s).loose(),
    strict: <T extends z.ZodRawShape>(s: T) => z.object(s).strict(),
    strip: <T extends z.ZodRawShape>(s: T) => z.object(s).strip(),
}

/** Create schema strategy identifier */
export type CreateSchemaStrategy = keyof typeof createSchemaStrategies

/** Creates a schema with a given schema strategy */
export const createSchema = <
    T extends z.ZodRawShape,
    K extends CreateSchemaStrategy,
>(shape: T, strategy: K) => createSchemaStrategies[strategy](shape);

