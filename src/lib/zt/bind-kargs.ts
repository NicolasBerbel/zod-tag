import z from "zod";
import {
    createRenderable,
    type IZodTagRenderable,
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
    if ((renderable as any as IZodTagRenderable).__async) {
        return createRenderable<void, IRenderableOutput<T>>(['', ''], [
            () => z.transform(async () => {
                const [strs, ...vals] = await renderable.renderAsync(kargs);
                return createRenderable(strs, vals)
            })
        ], undefined, undefined, undefined, undefined, true)
    }

    const [strs, ...vals] = renderable.render(kargs);
    return createRenderable<void, IRenderableOutput<T>>(strs, vals)
}
bindKargs.r = bindRenderKargs