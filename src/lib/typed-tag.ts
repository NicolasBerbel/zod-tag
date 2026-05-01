import {
    type ExtractKargs,
    type ExtractOutput,
    type KargsType,
    type TagTypes,
} from "./types/tag.types"
import {
    createRenderable,
    type IRenderable
} from "./core/renderable";
import { type IntersectNonVoid } from "./types/util.types";

/**
 * TypedTag utility type
 */
export interface TypedTag<
    KargsInput extends KargsType,
    KargsOutput extends KargsType,
    Types = TagTypes<KargsOutput>,
> {
    /** zt.z({})`static-content` <- no holes - this means throw if schema invalid, but show only structure if data match */
    (s: TemplateStringsArray): IRenderable<KargsInput, []>

    <
        /** Keyword args (obj arg) */
        Kargs extends ExtractKargs<V>,
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
        ): IRenderable<{
            [K in keyof IntersectNonVoid<KargsInput, Kargs>]: IntersectNonVoid<KargsInput, Kargs>[K]
        }, Output>
}

/**
 * Flexible tag - type is inferred from within the template input values
 */
export function typedTag<
    /** Keyword args (obj arg) */
    Kargs extends ExtractKargs<V>,
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
): IRenderable<{ [K in keyof Kargs]: Kargs[K] }, Output>

/** Static template */
export function typedTag(
    s: TemplateStringsArray,
    ...v: any[]
): IRenderable<void, []>

/** typedTag implementation  */
export function typedTag(strs: any, ...vals: any[]) {
    return createRenderable(strs, vals)
}
