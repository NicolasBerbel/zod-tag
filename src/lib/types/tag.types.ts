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
 * Produces a intersection of kargs found in the template input values
 */
export type ExtractKargsImpl<List extends any[], Acc = {}> =
    List extends [infer L, ...infer R]
    ? ExtractKargsImpl<R, Acc & ExtractValueKargs<L>>
    : Acc

/**
 * Produces a intersection of kargs found in the template input values
 */
export type ExtractKargs<T extends any[]> = (
    keyof ExtractKargsImpl<T> extends never ? void : ExtractKargsImpl<T>
)

/**
 * Values that needs a arg with record shape
 * 
 * Primitives are returned wrapped in single tuple
 */
export type ExtractValueOutput<T> =
    // Inner renderable templates kargs
    T extends IRenderable<any, infer O> ? (
        [...O]
    ) :
    // Recursively collects kargs inside selectors 
    T extends TagSelector<any, infer V> ? (
        ExtractValueOutput<V>
    ) :
    // Extract shape from object inputs
    T extends z.ZodType ? (
        ExtractValueOutput<z.output<T>>
    ) : [T]

/**
 * Produces a tuple of output values found in the template input values tuple
 */
export type ExtractOutputImpl<T extends any[], Acc extends any[] = []> =
    T extends [infer L, ...infer R] ? (
        ExtractOutputImpl<R, [...Acc, ...ExtractValueOutput<L>]>
    ) : Acc

/**
 * Produces a tuple of output values found in the template input values tuple
 */
export type ExtractOutput<T extends any[]> = ExtractOutputImpl<T>

/** Tag primitive type */
export type TagPrimitive = string | number | boolean | null | undefined | any[] | Record<string, any>;

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

