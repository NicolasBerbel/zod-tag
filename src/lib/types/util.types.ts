
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
