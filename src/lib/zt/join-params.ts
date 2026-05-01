import { type ExtractKargs, type ExtractOutput } from "../types/tag.types";
import { IRenderableOutput, type IRenderable } from "../core/renderable"
import { typedTag } from "../typed-tag"
import { tagIdentity } from "./identity"
import { SliceFirst } from "../types/util.types";

/**
 * Joins any tuple into output of target IRenderable argument
 */
type JoinOutputImpl<
    List extends any[],
    Sep extends IRenderable<any, any> = IRenderable<void, []>,
    Acc extends any[] = []
> = List extends [infer L, ...infer R]
    ? JoinOutputImpl<R, Sep, [...Acc, ...IRenderableOutput<Sep>, ...IRenderableOutput<L>]>
    : Acc;

/**
 * Joins any tuple into output of target IRenderable argument
 */
type JoinOutput<
    List extends any[],
    Sep extends IRenderable<any, any> = IRenderable<void, []>,
> = IRenderableOutput<Sep> extends []
    ? JoinOutputImpl<List, Sep>
    : SliceFirst<JoinOutputImpl<List, Sep>>

/**
 * Combine multiple renderables with given separator
 * 
 * @param list List of renderables to be combined
 * @param separator renderable separator
 */
export function joinParams<
    T extends IRenderable<any, any>,
    L extends T,
    R extends T[],
    V extends [L, ...R],
    S extends IRenderable<any, any> = IRenderable<void, []>
>(
    list: V,
    separator?: S
): IRenderable<
    ExtractKargs<[S, ...V]>,
    ExtractOutput<JoinOutput<V, S>>
>

/**
 * Join a list of parameterized values with given separator
 * 
 * @param list List of renderables to be combined
 * @param separator renderable separator
 */
export function joinParams<T extends any[]>(
    list: T,
    separator?: IRenderable<void, []>
): IRenderable<void, T>

/**
 * zt.join implementation
 */
export function joinParams<T extends any[]>(list: T, separator = tagIdentity) {
    if (!list.length) return tagIdentity
    const t = typedTag as any;
    const sep = separator ?? tagIdentity;
    return list.reduce((acc, cur) => {
        return (acc ? t`${acc}${sep}${cur}` : t`${cur}`)
    }, null)
}