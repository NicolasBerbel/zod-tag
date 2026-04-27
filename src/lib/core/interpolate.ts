import z from "zod"
import { type KargsType } from "../types/tag.types";
import {
    type IZodTagRenderable,
    type IRenderable,
    isRenderable,
} from "./renderable"
import { scopedKargs } from "./scope";
import {
    type InterpolationOperation,
    InterpolationError,
} from "./interpolation-error"
import { spliceInterpolation } from "./splice";

/**
 * Collapses with renderable interpolation strings and values with given kargs:
 * @param renderable target renderable
 * @param karg Keyword arguments object
 */
export function interpolate<K extends KargsType>(renderable: IRenderable<K, any>, karg: K) {
    const { strs, vals, schema } = renderable as any as IZodTagRenderable;

    let kargs: K = karg;
    if (schema) {
        const parsed = schema.safeDecode(karg)
        if (parsed.error) {
            throw InterpolationError.for(parsed.error, {
                renderer: renderable,
                index: -1,
                op: 'root-schema',
                strings: strs,
                value: schema,
            });
        }
        kargs = parsed.data as K
    }

    const _values = vals.slice()
    const _strings = strs.slice()

    let i = -1;
    let value;
    let op: InterpolationOperation = null!;
    try {
        for (; i < _values.length; i++) {
            while (true) {
                value = _values[i]

                if (isRenderable(value)) {
                    /** Transform nested renderables: recursively merges inner renderables */
                    op = 'renderable'
                    if (!(value as any).__compiled) throw InterpolationError.for(new Error('uncompiled renderer violation!'), {
                        index: i,
                        op,
                        renderer: renderable,
                        strings: _strings,
                        value,
                    })

                    const [_s, ..._v] = value.render(kargs)
                    spliceInterpolation(i, _strings, _values, _s, _v)
                } else if ((value as any)?._zod) {
                    const schema = value as z.ZodType;
                    // Object types decodes kargs
                    op = 'karg-schema'
                    _values[i] = schema.decode(scopedKargs(value, kargs)) as any
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
            renderer: renderable,
            strings: _strings,
            value,
        });
    }

    return [_strings, ..._values] as const
}
