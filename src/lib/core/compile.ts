import {
    type IRenderable,
    isZTRenderable,
    IZodTagRenderable
} from "./renderable"
import {
    type InterpolationOperation,
    InterpolationError
} from "./interpolation-error"
import { spliceInterpolation } from "./splice"
import {
    createSchemaStrategies,
    mergeSchemas,
    mergeStrategies,
} from "./schema"
import { withScope } from "./scope"

export type CompileOptions = {
    mergeStrategy: keyof typeof mergeStrategies,
    schemaStrategy: keyof typeof createSchemaStrategies,
}

/**
 * The compile step iterates through each slot preflattening the renderable with each nested renderable found
 * 
 * What is precompilable?
 * - Only direct nested renderables structures
 * 
 * What can we skip in the interpolation step?
 * - Already known static primitives can be saved and skipped later?
 */
export function compile<T extends IRenderable<any, any>>(_renderable: T, options?: CompileOptions) {
    const {
        mergeStrategy = 'intersect',
        schemaStrategy = 'loose',
    } = options ?? {}
    const renderable = _renderable as any as IZodTagRenderable
    const { vals, strs } = renderable
    const _values = vals.slice()
    const _strings = strs.slice()

    let _schema = renderable.schema;

    let i = 0;
    let value;
    let op: InterpolationOperation = null!;
    try {
        for (; i < _values.length; i++) {
            value = _values[i];
            if (isZTRenderable(value)) {
                /** Transform nested renderables: recursively merges inner renderables */
                op = 'renderable'
                const { strs: _s, vals: _v, } = value
                if (!(value as any).__compiled)
                    throw InterpolationError.for(new Error('uncompiled nested pre-compile violation!'), {
                        index: i,
                        op,
                        renderer: renderable,
                        strings: _strings,
                        value,
                    })

                // TODO: could improve by collecting shape before compile?
                // real parse for us is js native tagged template literals [str[], ...v] <- our AST?
                // collectSchema|"parse" -> compile -> interpolate
                const [mergedSchema] = mergeSchemas(_schema, value, { mergeStrategy, schemaStrategy })
                _schema = mergedSchema;

                const scopedValues = withScope(_v, value.scope, true)
                spliceInterpolation(i, _strings, _values, _s, scopedValues)
                i--;
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

    return [_strings, _values, _schema] as const

}
