
import { type IRenderable } from "../core/renderable";
import { tagIdentity } from "./identity";

/**
 * Conditionaly return given renderable
 * 
 * `zt.if` returns `zt.empty` when condition is not met
 */
export function ifCondition<
    T extends IRenderable<any, any>
>(
    condition: false | 0 | "" | null | undefined,
    template: T,
): IRenderable<void, []>

/**
 * Conditionaly return given renderable
 * 
 * `zt.if` returns `zt.empty` when condition is not met
 */
export function ifCondition<
    T extends IRenderable<any, any>,
>(condition: any, template: T): T

/**
 * `zt.if` implementation
 */
export function ifCondition<
    T extends IRenderable<any, any>,
>(condition: any, template: T) {
    return (condition ? template : tagIdentity) as any
}