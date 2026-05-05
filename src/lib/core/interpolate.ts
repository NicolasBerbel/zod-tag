import { type KargsType } from "../types/tag.types";
import {
    type IZodTagRenderable,
    type IRenderable,
    type IRenderableResult,
} from "./renderable"
import { collectChunks, } from "./chunks";
import { interpolateChunks } from "./interpolate-chunks";

/**
 * Collapses with renderable interpolation strings and values with given kargs:
 * @param renderable target renderable
 * @param karg Keyword arguments object
 */
export function interpolate<R extends IRenderable<K, O>, K extends KargsType, O extends any[]>(renderable: R, karg: K) {
    const r = renderable as any as IZodTagRenderable
    if (r.__static) return r.__static as IRenderableResult<R>
    return collectChunks(interpolateChunks(r, karg)) as IRenderableResult<R>
}
