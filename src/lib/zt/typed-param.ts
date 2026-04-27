import z from "zod";
import {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput,
} from '../core/renderable'
import { scopedRenderable } from "../core/scope";

export function typedParam<
    P extends string,
    T extends IRenderable<any, any>
>(
    argName: P,
    renderable: T
): IRenderable<{ [K in P]: IRenderableKargs<T> }, IRenderableOutput<T>>

export function typedParam<
    P extends string,
    T extends z.ZodType,
    R = z.output<T>
>(
    argName: P,
    schema: T,
    decode?: (v: z.output<T>) => R,
): z.ZodPipe<z.ZodObject<{ [K in P]: T }>, z.ZodTransform<R, z.output<T>>>;


export function typedParam(
    scope: any,
    child: any,
    decode: any = ((e: any) => e) as any,
) {
    if (child?._zod) return z.object({ [scope]: child }).transform(v => decode(v[scope]))
    return scopedRenderable(child, scope);
}