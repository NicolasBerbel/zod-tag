import { createRenderable } from "../core/renderable";

export const unsafeStatic = <T extends string>(str: T) => createRenderable<void, [], []>(() => [[str]])
