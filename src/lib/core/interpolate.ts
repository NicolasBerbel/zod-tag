import z from "zod"
import { isRenderable } from "./renderable"
import { InterpolationError, InterpolationOperation } from "./interpolation-error"

/**
 * Transforms the interpolation strings and values:
 * - zod schemas that expects a object as input values are encoded against the full karg object
 * - nested renderables are merged into the parent interpolation
 * - selector functions are called with karg as argument and the return value is interpolated again 
 * 
 * @param kargs Keyword arguments object
 * @param strs Interpolation strings array
 * @param vals Interpolation values tuple
 */
export function interpolate<K, V, T>(this: any, kargs: K, strs: TemplateStringsArray, ...vals: T[]) {
    const _values = vals.slice()
    const _strings = strs.slice()

    let i = 0;
    let value;
    let op: InterpolationOperation = null!;
    try {
        for (; i < _values.length; i++) {
            value = _values[i]
            while (value = _values[i], true) {
                // Zod Schema
                if ((value as any)?._zod) {
                    const schema = value as z.ZodType;
                    // Object types decodes kargs
                    op = 'karg-schema'
                    _values[i] = schema.decode(kargs) as any
                } else if (isRenderable(value)) {
                    /** Transform nested renderables: recursively merges inner renderables */
                    op = 'renderable'
                    const [_s, ..._v] = value.render(kargs)

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
                    op = 'selector'
                    _values[i] = value(kargs)
                } else {
                    break;
                }
            }
        }
    } catch (e) {
        throw InterpolationError.for(e, {
            index: i,
            op: op as InterpolationOperation,
            renderer: this,
            strings: _strings,
            value,
        });
    }

    // console.assert(_strings.length === _values.length + 1, 'invalid interpolation length', {
    //     s: _strings.length, v: _values.length
    // })

    return [_strings, ..._values] as const

}
