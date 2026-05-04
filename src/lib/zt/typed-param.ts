import z from "zod";
import {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput,
} from '../core/renderable'
import { scopedRenderable } from "../core/scope";
import { schemaTag } from "../schema-tag";
import { isSchemaType } from "../core/schema";
import { getSlotShape } from "../core/slot";

/**
 * Scoped IRenderable from IRenderable
 */
export function typedParam<
    P extends string,
    T extends IRenderable<any, any>
>(
    argName: P,
    renderable: T
): IRenderable<{ [K in P]: IRenderableKargs<T> }, IRenderableOutput<T>>

/**
 * Scoped IRenderable from schema
 */
export function typedParam<
    P extends string,
    T extends z.ZodType,
    R = z.output<T>
>(
    argName: P,
    schema: T,
    decode?: (v: z.output<T>) => R,
): IRenderable<
    z.input<z.ZodObject<{ [K in P]: T }>>,
    R extends IRenderable<any, any> ? IRenderableOutput<R> : [R]
>

/**
 * Scoped IRenderable from schema or IRenderable
 */
export function typedParam(
    scope: any,
    child: any,
    select: any = ((e: any) => e) as any,
) {
    if (isSchemaType(child)) {
        const ztz = (schemaTag as any)
        return ztz({ [scope]: child })`${(e: any) => select(e[scope])}`
    }

    return scopedRenderable(child, [scope]);
}