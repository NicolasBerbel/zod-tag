import {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput
} from "../core/renderable";
import { bindKargs } from "./bind-kargs";
import { tagIdentity } from "./identity";
import { joinParams } from "./join-params";

export function mapKargs<T, R extends IRenderable<any, any>>(
    list: T[],
    renderable: R,
    mapFn: (item: T, index: number, list: T[]) => IRenderableKargs<R>,
    separator: IRenderable<void, []> = tagIdentity
) {
    const items = list.map(
        (item, index, _list) => bindKargs(renderable as any, mapFn(item, index, _list))
    );
    return joinParams(
        items, separator
    ) as any as IRenderable<void, IRenderableOutput<R>>
}