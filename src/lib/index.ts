export { interpolate } from './core/interpolate'
export { InterpolationError } from './core/interpolation-error'

export {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableVargs,
    type IRenderableOutput,
    isRenderable,
    createRenderable
} from './core/renderable'

export * from './types/tag.types'

export {
    type TypedTag,
} from './typed-tag'

export { zt } from './zod-tag'