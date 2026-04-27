import { type IRenderable, type IRenderableKargs } from "../core/renderable";

export const opaque = <
    T extends IRenderable<any, any>
>(renderable: T) => renderable as IRenderable<IRenderableKargs<T>, []>