export { interpolate } from './core/interpolate'
export { InterpolationError } from './core/interpolation-error'

export {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput,
    isRenderable,
    createRenderable
} from './core/renderable'

export {
    type ExtractKargs,
    type ExtractOutput,
    type KargsType,
    type TagBehavior,
    type TagChildren,
    type TagPrimitive,
    type TagSelector,
    type TagTypes,
    type TagValue
} from './types/tag.types'

export {
    type TypedTag,
} from './typed-tag'

export { zt } from './zod-tag'