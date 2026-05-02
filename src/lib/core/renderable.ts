import z from "zod";
import {
    type KargsType,
} from "../types/tag.types";
import { compile } from "./compile";
import { withSource } from "./source";
import { interpolate } from "./interpolate";
import { extractScopedKargs } from "./scope";
import {
    type CreateSchemaStrategy,
    type MergeSchemaStrategy
} from "./schema";

/** Type guard for renderable instances */
export const isRenderable = (v: unknown): v is IRenderable<any, any> => (
    typeof v === 'object' && !!v && (v as unknown as IRenderable<any, any>)[RENDERABLE_SYMBOL]
);

/** Type guard for internal renderable instances */
export const isZTRenderable = (v: unknown): v is IZodTagRenderable<any, any> => isRenderable(v)

/** Symbol for renderable instances created with `createRenderable` */
export const RENDERABLE_SYMBOL = Symbol.for("IRenderable");

/** Zod Tag trait / shape strategy (loose | strict | default) */
export type ZtTrait = CreateSchemaStrategy;
/** Zod Tag merge strategy */
export type ZtMerge = MergeSchemaStrategy;

export const DEFAULT_TRAIT = 'loose' as const satisfies CreateSchemaStrategy;
export type DEFAULT_TRAIT = typeof DEFAULT_TRAIT;

export const DEFAULT_MERGE = 'intersect' as const satisfies MergeSchemaStrategy;
export type DEFAULT_MERGE = typeof DEFAULT_MERGE;

/**
 * @param fn a function to be executed on rendering
 */
export function createRenderable<
    Kargs extends KargsType = any,
    Output extends unknown[] = any,
    Trait extends CreateSchemaStrategy = DEFAULT_TRAIT,
    Merge extends MergeSchemaStrategy = DEFAULT_MERGE
>(
    strs: string[] | TemplateStringsArray,
    vals: unknown[],
    schema?: z.ZodType,
    scope: string[] = [],
    trait: Trait = DEFAULT_TRAIT as any,
    merge: Merge = DEFAULT_MERGE as any,
) {
    let _strs = strs.slice() as string[]
    let _vals = vals.slice();
    let _schema = schema;
    let __compiled = false;

    // construct with stack
    const renderable = withSource({
        get trait() { return trait },
        get merge() { return merge },
        get scope() { return scope },
        get schema() { return _schema },
        get strs() { return _strs },
        get vals() { return _vals },
        get __compiled() { return __compiled }
    }) as any as IRenderable<Kargs, Output>;
    renderable[RENDERABLE_SYMBOL] = true;

    // precompile the renderable
    if (vals.length) {
        [_strs, _vals, _schema] = compile(renderable);
    }

    // assign interpolation
    __compiled = true;
    renderable.render = (kargs: Kargs) => {
        const scopedKargs = extractScopedKargs(kargs, scope)
        return interpolate(renderable, scopedKargs) as any
    }

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
    render: (kargs: Kargs) => [strs: string[], ...vals: Output];
}

/**
 * Private zod tag renderable interface
 */
export interface IZodTagRenderable<
    Kargs extends KargsType = any,
    Output extends unknown[] = any,
    Trait extends ZtTrait = any,
    Merge extends ZtMerge = any,
> extends IRenderable<Kargs, Output> {
    trait: Trait,
    merge: Merge,
    strs: string[];
    vals: unknown[]
    schema?: z.ZodType;
    scope?: string[];
}

/** Infers the keyword arguments of a renderable */
export type IRenderableKargs<T> =
    T extends IRenderable<infer A, any> ? A : never

/** Infers the output values of a renderable */
export type IRenderableOutput<T> =
    T extends IRenderable<any, infer A> ? A : never