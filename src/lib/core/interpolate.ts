import { type KargsType } from "../types/tag.types";
import {
    type IRenderable,
} from "./renderable"
import { collectChunks } from "./chunks";
import { interpolateChunks } from "./interpolate-chunks";

/**
 * Collapses with renderable interpolation strings and values with given kargs:
 * @param renderable target renderable
 * @param karg Keyword arguments object
 */
export function interpolate<K extends KargsType>(renderable: IRenderable<K, any>, karg: K) {
    return collectChunks(interpolateChunks(renderable, karg))
}
