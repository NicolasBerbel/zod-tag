import z from "zod";
import { type IRenderable } from "../core/renderable";

/**
 * A keyword argument type may be a record obj or void if no named arguments exists
 */
export type KargsType = Record<string, unknown> | void

/**
 * Values that needs a arg with record shape
 */
export type ExtractValueKargs<T> =
    // Inner renderable templates kargs
    T extends IRenderable<infer A, any> ? (
        A extends void ? {} : A
    ) :
    // Recursively collects kargs inside selectors 
    T extends (...args: any[]) => infer R ? (
        ExtractValueKargs<R>
    ) :
    // Extract shape from object inputs
    T extends z.ZodType ? (
        z.input<T> extends object ? (
            z.input<T> extends unknown[] ? {} : z.input<T>
        ) : {}
    ) : {}


/**
 * Produces a intersection of kwargs found in the template input values
 */
export type MergeKargs<
    T,
    A extends Record<string, any> = {}
> =
    T extends [infer L, ...infer R] ? (
        A & (
            ExtractValueKargs<L> extends void
            ? {}
            : ExtractValueKargs<L>
        ) & MergeKargs<R, A>
    ) : A

/**
 * Produces a intersection of kwargs found in the template input values
 */
export type ExtractKargs<T> = (
    keyof MergeKargs<T> extends never
    ? void
    : MergeKargs<T>
)

/**
 * Produces a tuple of output values found in the template input values
 */
export type MergeOutput<T> =
    T extends readonly [infer L, ...infer R] ? (
        // Merge renderables
        L extends IRenderable<any, infer O> ? (
            [...O, ...MergeOutput<R>]
        ) : (
            L extends TagSelector<any, infer V> ? (
                // One depth call for selectors
                V extends TagBehavior ? (
                    MergeOutput<[V, ...R]>
                ) : [V, ...MergeOutput<R>]
            ) : (
                // Schemas may output other tag types or the validated
                L extends z.ZodType ? (
                    z.output<L> extends IRenderable<infer K, any> ? (
                        // Recursive call for schema selectors
                        MergeOutput<[z.output<L>, ...R]>
                        // Schema output is primitive
                    ) : [z.output<L>, ...MergeOutput<R>]
                    // Output is primitive
                ) : [L, ...MergeOutput<R>]
            )
        )
    ) : []

/**
 * Produces a tuple of output values found in the template input values
 */
export type ExtractOutput<T> = MergeOutput<T>

/** Tag primitive type */
export type TagPrimitive = string | number | boolean | null;

/** Kargs or Output values */
export type TagChildren = IRenderable<any, any> | z.ZodType

/** A function that transforms the keyword arguments into a interpolation value */
export type TagSelector<Kargs, Value> = ((args: Kargs) => Value) | (() => Value)

/** Input types for the interpolation */
export type TagValue = TagChildren | TagPrimitive

/** Tag values processed by zod-tag */
export type TagBehavior = TagChildren | TagSelector<any, any>

/** Available types given a Karg type */
export type TagTypes<K extends KargsType> = TagValue | TagSelector<K, TagValue>

