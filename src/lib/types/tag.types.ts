import z from "zod";
import { type IRenderable } from "../core/renderable";
import {
    type TupleExclude,
    type TupleFlatten,
} from "./util.types";

/**
 * A keyword argument type may be a record obj or void if no named arguments exists
 */
export type KargsType = Record<string, unknown> | void

/**
 * Values that needs a arg with record shape
 */
export type ExtractValueKargs<T> =
    // Inner renderable templates kargs
    T extends IRenderable<infer A, any, any> ? (
        A extends void ? {} : A
    ) :
    // Functions that has a typed argument or return a value that consumes kargs
    T extends (args: infer A) => infer R ? (
        R extends TagChildren | TagSelector<any, any> ? (
            ExtractKargs<[R, A]>
        ) : A extends object ? (
            A
        ) : {}
    ) :
    // Zod types that have objects as inputs
    T extends z.ZodType ? (
        z.input<T> extends object ? z.input<T> : {}
    ) :
    // No kwarg
    {}

/**
 * Values that need a arg to produce a final value but haven't names are positional
 */
export type ExtractValueVargs<T> =
    // Inner renderable templates vargs
    T extends IRenderable<any, infer A, any> ? (
        A extends [] ? void : A
    ) :
    // Functions that has a typed argument or return a value that consumes kargs
    T extends (args: infer A) => infer R ? (
        R extends TagChildren | TagSelector<any, any> ? (
            ExtractVargs<[R]>
        ) : void
    ) :
    // Zod types that does not have objects as inputs
    T extends z.ZodType ? (
        z.input<T> extends object ? void : z.input<T>
    ) :
    // No varg
    void

/**
 * Values returned after the parsing
 */
export type ExtractValueOutput<T> =
    // Inner renderable templates output
    T extends IRenderable<any, any, infer A> ? (
        A
    ) :
    // Functions that has a return type 
    T extends (args: any) => infer A ? ExtractValueOutput<A> :
    // The output of any zod type
    T extends z.ZodType ? ExtractValueOutput<z.output<T>> :
    // The output type
    T

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
 * Produces a tuple of vargs found in the template input values
 */
export type MergeVargs<T> = (
    T extends [infer L, ...infer R] ? (
        [ExtractValueVargs<L>, ...MergeVargs<R>]
    ) : []
)

/**
 * Produces a tuple of vargs found in the template input values
 */
export type ExtractVargs<T> = (
    TupleExclude<TupleFlatten<MergeVargs<T>>, void>
)

/**
 * Produces a tuple of output values found in the template input values
 */
export type MergeOutput<T> = (
    T extends [infer L, ...infer R] ? (
        [ExtractValueOutput<L>, ...MergeOutput<R>]
    ) : []
)

/**
 * Produces a tuple of output values found in the template input values
 */
export type ExtractOutput<T> = TupleFlatten<MergeOutput<T>>

/** Tag primitive type */
export type TagPrimitive = string | number | boolean | null;

/** Kargs, Vargs or Output values */
export type TagChildren = IRenderable<any, any, any> | z.ZodType

/** A function that transforms the keyword arguments into a interpolation value */
export type TagSelector<Kargs, Value> = ((args: Kargs) => Value)

/** Input types for the interpolation */
export type TagValue = TagChildren | TagPrimitive

/** Available types given a Karg type */
export type TagTypes<K extends KargsType> = TagValue | TagSelector<K, TagValue>

