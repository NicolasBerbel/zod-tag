import { type IRenderable } from "../core/renderable"
import { typedTag } from "../typed-tag"
import { tagIdentity } from "./identity"

export function joinParams<T extends unknown[]>(list: T, separator: IRenderable<void, []>) {
    if (!list.length) return tagIdentity
    return list.reduce((acc, id) => {
        return (acc ? typedTag`${acc}${separator}${id}` : typedTag`${id}`) as any
    }, null as any) as IRenderable<void, T>
}