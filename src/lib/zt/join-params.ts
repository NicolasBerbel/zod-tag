import { type IRenderable } from "../core/renderable"
import { typedTag } from "../typed-tag"
import { tagIdentity } from "./identity"

export function joinParams<T extends any[]>(list: T, separator: IRenderable<void, []>) {
    if (!list.length) return tagIdentity
    const t = typedTag as any;
    return list.reduce((acc, id) => {
        return (acc ? t`${acc}${separator}${id}` : t`${id}`)
    }, null) as IRenderable<void, T>
}