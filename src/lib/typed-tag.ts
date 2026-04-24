import {
    type ExtractVargs,
    type ExtractKargs,
    type ExtractOutput,
    type KargsType,
    type TagTypes,
    type TagSelector,
} from "./types/tag.types"
import {
    createRenderable,
    type IRenderable
} from "./core/renderable";
import { type IntersectNonVoid, type TupleExclude } from "./types/util.types";
import { interpolate } from "./core/interpolate";

/**
 * TypedTag utility type
 */
export interface TypedTag<
    KargsInput extends KargsType,
    KargsOutput extends KargsType,
    Types = TagTypes<KargsOutput>,
> {
    // Dynamic
    <
        /** Keyword args (obj arg) */
        Kargs extends ExtractKargs<TupleExclude<V, TagSelector<KargsOutput, any>>>,
        /** Variadic args (...rest args */
        Vargs extends ExtractVargs<V>,
        /** Output result */
        Output extends ExtractOutput<V>,
        /** Tuple of input values */
        V extends [L, ...R],
        L extends T,
        R extends T[],
        /** Union type of input values */
        T extends Types | TagTypes<KargsOutput>,
    >
        (
            s: TemplateStringsArray,
            ...v: V
        ): IRenderable<IntersectNonVoid<KargsInput, Kargs>, Vargs, Output>
}

/**
 * Flexible tag - type is inferred from within the template input values
 */
export function typedTag<
    /** Keyword args (obj arg) */
    Kargs extends ExtractKargs<V>,
    /** Variadic args (...rest args */
    Vargs extends ExtractVargs<V>,
    /** Output result */
    Output extends ExtractOutput<V>,
    /** Tuple of input values */
    V extends [L, ...R],
    L extends T,
    R extends T[],
    /** Union type of input values */
    T,
>(
    s: TemplateStringsArray,
    ...v: V
): IRenderable<Kargs, Vargs, Output>

/** Static template */
export function typedTag(
    s: TemplateStringsArray,
    ...v: any[]
): IRenderable<void, [], []>

/** typedTag implementation  */
export function typedTag(strs: any, ...vals: any[]) {
    return createRenderable(function renderRenderable(karg, varg) {
        return interpolate.call(this, karg, varg, strs, ...vals)
    })
}
