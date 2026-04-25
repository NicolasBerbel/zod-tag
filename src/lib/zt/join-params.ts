import { type IRenderable } from "../core/renderable"
import { typedTag } from "../typed-tag"

export function joinParams<T extends unknown[]>(list: T, separator: IRenderable<void, []>) {
    return list.reduce((acc, id) => {
        return (acc ? typedTag`${acc}${separator}${id}` : typedTag`${id}`) as any
    }, null as any) as IRenderable<void, T>
}