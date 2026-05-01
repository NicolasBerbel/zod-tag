import {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput
} from "../core/renderable";
import { SliceFirst } from "../types/util.types";
import { bindKargs } from "./bind-kargs";
import { tagIdentity } from "./identity";
import { joinParams } from "./join-params";

/**
 * Maps any tuple into output of target IRenderable argument
 */
type MapOutputImpl<
    List extends any[],
    Target extends IRenderable<any, any>,
    Sep extends IRenderable<any, any> = IRenderable<void, []>,
    Acc extends any[] = []
> = List extends [infer _L, ...infer R]
    ? MapOutputImpl<R, Target, Sep, [...Acc, ...IRenderableOutput<Sep>, ...IRenderableOutput<Target>]>
    : Acc;

/**
 * Maps any tuple into output of target IRenderable argument
 */
type MapOutput<
    List extends any[],
    Target extends IRenderable<any, any>,
    Sep extends IRenderable<any, any> = IRenderable<void, []>,
> = List extends [infer _L, ...infer _R]
    ? IRenderableOutput<Sep> extends []
    ? MapOutputImpl<List, Target, Sep>
    : SliceFirst<MapOutputImpl<List, Target, Sep>>
    : IRenderableOutput<Target>

/**
 * 
 * @param list 
 * @param renderable 
 * @param mapFn 
 * @param separator 
 * @returns a renderable
 */
export function mapKargs<
    L extends any, R extends any[],
    Tuple extends [L, ...R],
    List extends Tuple | any[],
    Target extends IRenderable<any, any>,
    MapFn extends (item: List[number], index: number, list: List) => IRenderableKargs<Target>,
    Sep extends IRenderable<any, any> = IRenderable<void, []>
>(
    list: List,
    renderable: Target,
    mapFn: MapFn,
    separator: Sep = tagIdentity as Sep,
) {
    const items = list.map(
        (item, index, _list) => bindKargs(renderable, mapFn(item, index, _list as any))
    );
    return joinParams(
        items,
        separator
    ) as any as IRenderable<
        IRenderableKargs<Sep>,
        MapOutput<List, Target, Sep>
    >
}