import z from "zod";
import {
    type KargsType,
} from "../types/tag.types";
import { compile } from "./compile";
import { withSource } from "./source";
import {
    type CreateSchemaStrategy,
    type MergeSchemaStrategy
} from "./schema";
import { type ZtChunk } from "./chunks";
import { interpolateChunks } from "./interpolate-chunks";
import { interpolate, interpolateAsync } from "./interpolate";
import { interpolateChunksAsync } from "./interpolate-chunks-async";

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

/** The schema creation strategy */
export const DEFAULT_TRAIT = 'loose' as const satisfies CreateSchemaStrategy;
export type DEFAULT_TRAIT = typeof DEFAULT_TRAIT;

/** Schema merge strategy */
export const DEFAULT_MERGE = 'intersect' as const satisfies MergeSchemaStrategy;
export type DEFAULT_MERGE = typeof DEFAULT_MERGE;

/** Identity singleton wrapper */
const Identity = [null!] as [IRenderable<void, []>]

/** Object.freeze util */
const freeze = Object.freeze


/**
 * creates a renderable that only have one single structure string
 */
const createStruct = (strs: [string]) => {
    const chunk = freeze(strs)
    const output = freeze([chunk])
    const r: IZodTagRenderable<void, []> = {
        [RENDERABLE_SYMBOL]: true,
        trait: DEFAULT_TRAIT,
        merge: DEFAULT_MERGE,
        scope: freeze([] as any),
        schema: undefined,
        strs: chunk as any,
        vals: freeze([]) as any,
        __static: output as any,
        __dynamic: false,
        __async: false,
        __compiled: true,
        render: () => output as any,
        renderAsync: async () => output as any,
        stream: function* () { yield chunk; },
        streamAsync: async function* () { yield chunk; },
    };

    freeze(r)

    // save identity singleton
    if (strs[0] === '' && !Identity[0]) {
        Identity[0] = r as any
        freeze(Identity);
    }

    return r as any as IRenderable<void, []>
}


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
    asyncConfig = false,
): IRenderable<Kargs, Output> {
    // static and identity check
    const isStruct = !schema && strs.length === 1;
    const isIdentity = isStruct && strs[0] === '';
    if (isIdentity && Identity[0]) return Identity[0] as any
    if (isStruct) return createStruct(strs as [string]) as any

    // getters
    let _strs = strs.slice() as string[]
    let _vals = vals.slice();
    let _schema = schema;
    let _scope = freeze(scope.slice());
    let __static = undefined as any;
    let __dynamic = !!schema;
    let __async = asyncConfig;
    let __compiled = false;

    // construct with stack
    const renderable = withSource({
        [RENDERABLE_SYMBOL]: true,
        trait,
        merge,
        get scope() { return _scope },
        get schema() { return _schema },
        get strs() { return _strs },
        get vals() { return _vals },
        get __static() { return __static },
        get __dynamic() { return __dynamic },
        get __async() { return asyncConfig || __async },
        get __compiled() { return __compiled }
    }) as IZodTagRenderable;

    // precompile the renderable
    if (vals.length) [_strs, _vals, _schema, __dynamic, __async] = compile(renderable);
    __compiled = true;

    // static
    if (!__dynamic) __static = freeze([_strs, ..._vals]);

    // assign interpolation
    (renderable as any).render = (kargs: Kargs) => interpolate(renderable, kargs);
    (renderable as any).renderAsync = async (kargs: Kargs) => interpolateAsync(renderable, kargs);
    (renderable as any).stream = (kargs: Kargs) => interpolateChunks(renderable, kargs);
    (renderable as any).streamAsync = (kargs: Kargs) => interpolateChunksAsync(renderable, kargs);

    // assert immutability
    freeze(_strs)
    freeze(_vals)
    freeze(renderable)
    return renderable as any
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
    readonly [RENDERABLE_SYMBOL]: true;

    /**
     * Synchronously process input kwargs into immutable interpolation tuple
     */
    readonly render: (kargs: Kargs) => [strs: string[], ...vals: Output];

    /**
     * Asynchronously process input kwargs into immutable interpolation tuple
     */
    readonly renderAsync: (kargs: Kargs) => Promise<[strs: string[], ...vals: Output]>;

    /**
     * Process input kwargs into immutable interpolation chunk tuples
    */
    readonly stream: (kargs: Kargs) => Generator<ZtChunk, void>

    /**
     * Process input kwargs into immutable interpolation tuple
     */
    readonly streamAsync: (kargs: Kargs) => AsyncGenerator<ZtChunk, void>
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
    __compiled: boolean,
    __async: boolean,
    __dynamic: boolean,
    __static?: [string[], ...Output];
    trait: Trait,
    merge: Merge,
    strs: string[];
    vals: unknown[]
    schema?: z.ZodType;
    scope: string[];
}

/** Infers the keyword arguments of a renderable */
export type IRenderableKargs<T> =
    T extends IRenderable<infer A, any> ? A : never

/** Infers the output values of a renderable */
export type IRenderableOutput<T> =
    T extends IRenderable<any, infer A> ? A : never

/** Infers the result tuple of a renderable */
export type IRenderableResult<T> = T extends IRenderable<any, any> ? [string[], ...IRenderableOutput<T>] : never
