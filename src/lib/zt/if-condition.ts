import { type IRenderable } from "../core/renderable";
import { typedTag } from "../typed-tag";

export const ifCondition = <T extends IRenderable<any, any>>(condition: unknown, template: T) => {
    return !!condition ? template : typedTag``
}