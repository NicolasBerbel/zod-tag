import { type IRenderable } from "../core/renderable";
import { tagIdentity } from "./identity";

export const ifCondition = <T extends IRenderable<any, any>>(condition: unknown, template: T) => {
    return !!condition ? template : tagIdentity
}