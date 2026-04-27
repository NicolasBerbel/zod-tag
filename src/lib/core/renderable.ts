import z from "zod";
import {
    type KargsType,
} from "../types/tag.types";
import { compile } from "./compile";
import { withSource } from "./source";
import { interpolate } from "./interpolate";
import { withScope } from "./scope";

/** Type guard for renderable instances */
export const isRenderable = (v: unknown): v is IRenderable<any, any> => (
    typeof v === 'object' && !!v && (v as unknown as IRenderable<any, any>)[RENDERABLE_SYMBOL]
);

/** Symbol for renderable instances created with `createRenderable` */
export const RENDERABLE_SYMBOL = Symbol.for("IRenderable");

/**
 * @param fn a function to be executed on rendering
 */
export function createRenderable<
    Kargs extends KargsType = any,
    Output extends unknown[] = any,
>(
    strs: string[] | TemplateStringsArray,
    vals: unknown[],
    schema?: z.ZodType,
    scope?: string
) {
    let _strs = strs.slice() as string[]
    let _vals = withScope(vals, scope);
    let __compiled = false;

    // construct with stack
    const renderable = withSource({
        get scope() { return scope },
        get schema() { return schema },
        set schema(v) { schema = v },
        get strs() { return _strs },
        get vals() { return _vals },
        get __compiled() { return __compiled }
    }) as any as IRenderable<Kargs, Output>;
    renderable[RENDERABLE_SYMBOL] = true;

    // precompile the renderable
    if (vals.length) [_strs, _vals] = compile(renderable);

    // assign interpolation
    __compiled = true;
    renderable.render = (kargs: Kargs) => interpolate(renderable, kargs) as any

    // assert immutability
    Object.freeze(_strs)
    Object.freeze(_vals)
    Object.freeze(renderable)
    return renderable
}


/**
 * Renderable interface represents a fn value that processes a interpolation.
 * 
 * It receives a 'karg' (keyword argument) object as first argument
 * 
 * It's expected to return a interpolation structure renderer as below
 */
export interface IRenderable<
    /** Named arguments record */
    Kargs extends KargsType,
    /** Resulting interpolation output values */
    Output extends unknown[],
> {
    [RENDERABLE_SYMBOL]: true;

    /**
     * Process input kwargs
     */
    render: (
        this: IRenderable<Kargs, Output>,
        kargs: Kargs,
    ) => [
            strs: string[],
            ...vals: Output
        ];
}

/**
 * Private zod tag renderable interface
 */
export interface IZodTagRenderable<
    Kargs extends KargsType = any,
    Output extends unknown[] = any
> extends IRenderable<Kargs, Output> {
    strs: string[];
    vals: unknown[]
    schema?: z.ZodType;
    scope?: string;
}

/** Infers the keyword arguments of a renderable */
export type IRenderableKargs<T> =
    T extends IRenderable<infer A, any> ? A : never

/** Infers the output values of a renderable */
export type IRenderableOutput<T> =
    T extends IRenderable<any, infer A> ? A : never