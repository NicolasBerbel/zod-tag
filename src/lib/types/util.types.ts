
/** Flattens a given tuple */
export type TupleFlatten<T> =
    T extends readonly [infer L, ...infer R] ? (
        L extends readonly unknown[] ? (
            [...TupleFlatten<L>, ...TupleFlatten<R>]
        ) : (
            [L, ...TupleFlatten<R>]
        )
    ) : []



/** Exclude types that matches U in the tuple */
export type TupleExclude<T extends any[], U> =
    T extends [infer L, ...infer R] ? (
        L extends U
        ? TupleExclude<R, U>
        : [L, ...TupleExclude<R, U>]
    ) : []

/**
 * Intersects two types excluding void:
 * - A and B are void -> `void`
 * - Only A is void -> `B`
 * - Only B is void -> `A`
 * - No void type -> `A & B`
 **/
export type IntersectNonVoid<A, B> =
    A extends void ? B extends void
    ? void : B
    : B extends void
    ? A : A & B
