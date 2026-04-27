
import {
    type IRenderableKargs,
    type IRenderableOutput,
    type IRenderable
} from "../core/renderable";
import {
    type TagIdentity,
    tagIdentity
} from "./identity";

export const ifCondition = <
    T extends IRenderable<any, any>
>(condition: unknown, template: T) => {
    return (!!condition ? template : tagIdentity) as (
        IRenderable<
            IRenderableKargs<T> | IRenderableKargs<TagIdentity>,
            IRenderableOutput<T> | IRenderableOutput<TagIdentity>
        >
    )
}