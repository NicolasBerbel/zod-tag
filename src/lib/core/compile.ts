import { type IRenderable, isZTRenderable, IZodTagRenderable } from "./renderable"
import { type InterpolationOperation, InterpolationError } from "./interpolation-error"
import { spliceInterpolation } from "./splice"
import {
    createSchemaStrategies,
    isSchemaType,
    mergeSchemas,
    mergeStrategies,
} from "./schema"

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

                spliceInterpolation(i, _strings, _values, _s, _v)
                i--;
            } else if (isSchemaType(value)) {
                // No schema premerge, at least yet.
                break;
                /**
                 * // We could already merge some schema here, right?                 
                 * const [mergedSchema] = mergeSchemas(_schema, value, { mergeStrategy, schemaStrategy })
                 * _schema = mergedSchema;
                 * 
                 * // would need some 'hack' like below?
                 * _values[i] = (kargs: any) => kargs[scope]; <- needed?
                 * 
                 * // this breaks test on z.codec/z.object().transform
                 * 
                 * // i think when merging z.object({ a: 123 }).transform(someTransform)
                 * // How would the merged schema know how to apply: someTransform({ a: 123 }), ok thats zod internals, but
                 * // Where would be the output of this?
                 * 
                 * // e.g., precompiled parent/merged schema { a: 123, ...rest } -> output validated kargs, with the { a: 123 } being what after transform?
                 * 
                 * // We can only merge schemas without transforms, they should be converted to selectors so the values are interpolated as selection later
                 * // extract the transform and treat as selector could be fragile, gotta dive into zod pipes, maybe poc that.
                 * // in fact selectors are just effects of the similar type of zod's .transform()
                 * // zt.z({ preselected: z.object({ a: 123 }).transform((karg) => zt.t`a is ${karg.a}` ) })`${e => e.preselected}`
                 * 
                 * // Can we at least only premerge direct object schemas without transform/effects?
                 * if (value._zod.def.type === 'object') {
                 *     // this doesn't broke anything, but it's very specific for: ${z.object({ a: 123 })}
                 *     // |->  when your output values tuple outputs an literal object
                 *     const [mergedSchema] = mergeSchemas(_schema, value, { mergeStrategy, schemaStrategy })
                 *     _schema = mergedSchema;
                 *     // probably need to convert to selector
                 *     _values[i] = (kargs: any) => kargs
                 * } else {
                 *     break;
                 * }
                 */
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
