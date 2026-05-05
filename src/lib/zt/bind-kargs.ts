import {
    createRenderable,
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput
} from "../core/renderable";

/**
 * Binds a renderable with given kargs returning a dynamic IRenderable<void, Output>
 * 
 * That in render time will effectively collapses with given kargs
 */
export const bindRenderKargs = <
    T extends IRenderable<any, any>,
>(renderable: T, kargs: IRenderableKargs<T>) => createRenderable<void, IRenderableOutput<T>>(['', ''], [
    () => bindKargs(renderable, kargs)
])

/** Collapse a renderable to IRenderable<void, Output> given kargs */
export const bindKargs = <
    T extends IRenderable<any, any>,
>(renderable: T, kargs: IRenderableKargs<T>) => {
    const [strs, ...vals] = renderable.render(kargs);
    return createRenderable<void, IRenderableOutput<T>>(strs, vals)
}
bindKargs.r = bindRenderKargs