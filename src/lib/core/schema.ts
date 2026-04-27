import z from "zod"
import { IRenderable } from "./renderable"

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
 * 
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

export const mergeKeyStrategies = {
    shallow: shallowMerge,
    intersect: intersectShapes,
}

export function extractShape(r: IRenderable<any, any>): Record<string, z.ZodType> | undefined {
    return ((r as any).schema as z.ZodObject<any> | undefined)?.shape
}