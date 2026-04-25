import {
    type KargsType,
} from "../types/tag.types";
import { withSource } from "./source";

/** Type guard for renderable instances */
export const isRenderable = (v: unknown): v is IRenderable<any, any> => (
    typeof v === 'function' && (v as unknown as IRenderable<any, any>)[RENDERABLE_SYMBOL]
);

/** Symbol for renderable instances created with `createRenderable` */
export const RENDERABLE_SYMBOL = Symbol.for("IRenderable");

/**
 * @param fn a function to be executed on rendering
 */
export function createRenderable<
    A extends KargsType = any,
    B extends unknown[] = any,
>(fn: (this: IRenderable<A, B>, args: A, vals: B) => any) {
    const _fn = withSource(fn) as any as IRenderable<A, B>
    _fn[RENDERABLE_SYMBOL] = true;
    _fn.render = fn.bind(_fn) as any
    return _fn
}

/**
 * Renderable interface represents a fn value that processes a interpolation.
 * 
 * It receives a 'karg' (keyword argument) object as first argument
 * 
 * It's expected to return a interpolation structure renderer as below
 */
export interface IRenderable<
    /** Named arguments record */
    Kargs extends KargsType,
    /** Resulting interpolation output values */
    Output extends unknown[],
> {
    [RENDERABLE_SYMBOL]: true;

    /**
     * Process input kwargs
     */
    render: (
        this: IRenderable<Kargs, Output>,
        kargs: Kargs,
    ) => [
            strs: TemplateStringsArray,
            ...vals: Output
        ];
}

/** Infers the keyword arguments of a renderable */
export type IRenderableKargs<T> =
    T extends IRenderable<infer A, any> ? A : never

/** Infers the output values of a renderable */
export type IRenderableOutput<T> =
    T extends IRenderable<any, infer A> ? A : never