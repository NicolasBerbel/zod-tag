import {
    type IRenderable,
    createRenderable
} from "../core/renderable";

export type TagIdentity = IRenderable<void, []>
export const tagIdentity = createRenderable<void, []>([''], [])
