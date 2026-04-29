import z from "zod"
import { type IZodTagRenderable } from "./renderable"
import { getSlotSchema, getSlotScope, getSlotShape } from "./slot"

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

export const mergeStrategies = {
    shallow: shallowMerge,
    intersect: intersectShapes,
}
export const mergeShapes = <
    A extends z.ZodRawShape,
    B extends z.ZodRawShape,
    K extends keyof typeof mergeStrategies,
>(shapeA: A, shapeB: B, strategy: K) => mergeStrategies[strategy](shapeA, shapeB);


type MergeOptions = {
    mergeStrategy: keyof typeof mergeStrategies,
    schemaStrategy: keyof typeof createSchemaStrategies,
}

export const mergeSchemas = (
    schema?: z.ZodType,
    value?: IZodTagRenderable<any, any> | z.ZodType,
    options?: MergeOptions,
) => {
    const {
        mergeStrategy = 'intersect',
        schemaStrategy = 'loose',
    } = options ?? {};
    let _schema = schema;
    let merged = false;

    const slotShape = getSlotShape(value)
    if (slotShape) {
        const slotSchema = getSlotSchema(value)
        const nestedScope = getSlotScope(value)
        const scopedShape = nestedScope ? { [nestedScope]: slotSchema } : slotShape
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

export const createSchema = <
    T extends z.ZodRawShape,
    K extends keyof typeof createSchemaStrategies,
>(shape: T, strategy: K) => createSchemaStrategies[strategy](shape);

