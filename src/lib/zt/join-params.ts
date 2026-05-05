import {
    type ExtractKargs,
    type ExtractOutput
} from "../types/tag.types";
import {
    createRenderable,
    IRenderableKargs,
    type IRenderable,
    type IRenderableOutput,
} from "../core/renderable"
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
export function joinParams<T extends IRenderable<any, any>>(
    list: T[],
    separator?: IRenderable<void, []>
): IRenderable<
    IRenderableKargs<T> extends never ? void : IRenderableKargs<T>,
    IRenderableOutput<T> extends never ? [] : IRenderableOutput<T>
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
    const sep = separator ?? tagIdentity;
    const strs = [];
    const vals = [];
    for (let i = 0; i < list.length; i++) {
        const cur = list[i]
        if (cur === tagIdentity) continue;
        if (!vals.length) {
            strs.push('', '');
            vals.push(cur);
        } else if (sep !== tagIdentity) {
            strs.push('', '');
            vals.push(sep, cur);
        } else {
            strs.push('');
            vals.push(cur);
        }
    }
    if (!vals.length) return tagIdentity;
    return createRenderable(strs, vals)
}