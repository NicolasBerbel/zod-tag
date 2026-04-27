import z from "zod"
import { type IRenderable, isRenderable, IZodTagRenderable } from "./renderable"
import { type InterpolationOperation, InterpolationError } from "./interpolation-error"
import { spliceInterpolation } from "./splice"
import { mergeKeyStrategies } from "./schema"

/**
 * What is precompilable?
 * - Only direct nested renderables structures
 * 
 * What can we skip in the interpolation step?
 * - Already known static primitives can be saved and skipped later?
 */
export function compile<T extends IRenderable<any, any>>(_renderable: T) {
    const renderable = _renderable as any as IZodTagRenderable
    const { vals, strs } = renderable
    const _values = vals.slice()
    const _strings = strs.slice()

    let i = 0;
    let value;
    let op: InterpolationOperation = null!;
    try {
        for (; i < _values.length; i++) {
            while (value = _values[i], true) {
                if (isRenderable(value)) {
                    /** Transform nested renderables: recursively merges inner renderables */
                    op = 'renderable'
                    const { strs: _s, vals: _v, } = value as any as IZodTagRenderable
                    if (!(value as any).__compiled)
                        throw InterpolationError.for(new Error('uncompiled nested pre-compile violation!'), {
                            index: i,
                            op,
                            renderer: renderable,
                            strings: _strings,
                            value,
                        })

                    if ((value as any)?.schema?.shape) {
                        const schema = (value as any)?.schema
                        const nestedScope = (value as any)?.scope;
                        const schemaShape = schema?.shape
                        const scopedShape = nestedScope ? { [nestedScope]: schema } : schemaShape;
                        const newShape = mergeKeyStrategies['intersect'](
                            (renderable.schema as z.ZodObject)?.shape,
                            scopedShape
                        )

                        if (Object.keys(newShape).length > 0) {
                            // TODO2:
                            // mutation bad! could improve by collecting shape before compile.
                            // collectSchema -> compile -> interpolate
                            renderable.schema = z.looseObject(newShape)
                        }
                    }

                    spliceInterpolation(i, _strings, _values, _s, _v)
                } else {
                    break;
                }
            }
        }
    } catch (e) {
        throw InterpolationError.for(e, {
            index: i,
            op: op as InterpolationOperation,
            renderer: renderable,
            strings: _strings,
            value,
        });
    }

    return [_strings, _values] as const

}
