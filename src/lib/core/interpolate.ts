import z from "zod"
import { isRenderable } from "./renderable"
import { expectsObject } from "../utils/schema-expects-object"

/**
 * Transforms the interpolation strings and values:
 * - zod schemas that expects a object as input values are encoded against the full karg object
 * - zod schemas that expects anything else are encoded against the nth variadic argument
 * - nested renderables are merged into the parent interpolation
 * - selector functions are called with karg as argument and the return value is interpolated again 
 * 
 * @param kargs Keyword arguments object
 * @param vargs Variadic arguments tuple
 * @param strs Interpolation strings array
 * @param vals Interpolation values tuple
 */
export const interpolate = <K, V, T>(kargs: K, vargs: V[], strs: TemplateStringsArray, ...vals: T[]) => {
    const _values = vals.slice()
    const _strings = strs.slice()

    for (let i = 0; i < _values.length; i++) {
        let _v = _values[i]
        while (_v = _values[i], typeof _v === 'function' || isRenderable(_v) || (_v as any)?._zod) {
            let value = _v

            // Zod Schema
            if ((value as any)?._zod) {
                const schema = value as z.ZodType;
                if (expectsObject(schema)) {
                    // Object types decodes kargs
                    _values[i] = schema.decode(kargs) as any
                } else {
                    // Other types decodes vargs[0]
                    const varg = vargs.shift()
                    _values[i] = schema.decode(varg) as any
                }
            } else if (isRenderable(value)) {
                /** Transform nested renderables: recursively merges inner renderables */
                const [_s, ..._v] = value.render(kargs, vargs)

                _strings[i] += _s[0]
                _values.splice(i, 1)
                if (_s.length > 1) {
                    _strings[i + 1] = _s.at(-1) + _strings[i + 1]
                    _values.splice(i, 0, ..._v)
                    _strings.splice(i + 1, 0, ..._s.slice(1, -1))
                } else if (_s.length === 1) {
                    _strings[i] += _strings[i + 1]
                    _strings.splice(i + 1, 1)
                }
            } else if (typeof value === 'function') {
                /** Transform function values: if value is a function its called with karg object to determine the actual interpolation value */
                _values[i] = value(kargs)
            }
        }
    }

    // console.assert(_strings.length === _values.length + 1, 'invalid interpolation length', {
    //     s: _strings.length, v: _values.length
    // })

    return [_strings, ..._values] as const

}
