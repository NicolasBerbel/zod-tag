import {
    createRenderable,
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput
} from "../core/renderable";

export const bindKargs = <
    T extends IRenderable<any, any>,
>(renderable: T, kargs: IRenderableKargs<T>) => {
    const [strs, ...vals] = renderable.render(kargs);
    return createRenderable<void, IRenderableOutput<T>>(strs, vals)
}