import z from "zod";
import { IRenderable, isZTRenderable } from "./renderable";

export const isPromise = (v: any): v is Promise<unknown> => !!v && v?.then && typeof v?.then === 'function';

const isAsyncConstructor = (fn: any) => fn?.constructor.name.includes('AsyncFunction')

/**
 * Check if a renderable or a schema is async
 */
export const isAsync = (value: IRenderable<any, any> | z.ZodType): boolean => isZTRenderable(value) ? value.__async : isAsync(value)

const AsyncSchemaCache = new WeakMap<z.ZodType, boolean>()

/**
 * Check if given schema is async
 * 
 * Zod's internal gotchas here but for basic usecases this working well
 * 
 * If you transform/refine etc, be sure to use async functions when possible:
 * - `schema.transform(async() {})` <- this is handled 'fine', renderables are tagged as async and it propagates to parents
 * - `schema.transform(() => new Promise())` <- no way to inspect, will fail at render time on zt internal call to .safeEncode instead of .safeEncodeAsync
 **/
export const isAsyncSchema = (schema?: z.ZodType): boolean => {
    if (!schema || typeof schema !== 'object') return false;
    const c = AsyncSchemaCache.get(schema);
    if (c) return c
    const v = _isAsyncSchema(schema);
    AsyncSchemaCache.set(schema, v)
    return v;
}

export const _isAsyncSchema = (schema?: z.ZodType): boolean => {
    let _schema = schema as any;
    if (!_schema?.def) return false;
    // unwrap optionals/defaults
    while (_schema.def.innerType) {
        _schema = _schema.def.innerType ? _schema.def.innerType : _schema;
    }

    const def = _schema.def;
    // transforms/refines/pipes
    if (def.in || def.out) return isAsyncSchema(def.in) || isAsyncSchema(def.out)
    // intersection
    if (def.left || def.right) return isAsyncSchema(def.left) || isAsyncSchema(def.right)
    // union shapes
    if (_schema.options) return _schema.options.some(isAsyncSchema)
    // object shapes
    if (_schema.shape) return Object.keys(_schema.shape).some(k => isAsyncSchema(_schema.shape[k]))
    // arrays
    if (_schema.element) return isAsyncSchema(_schema.element)
    // tuples
    if (def.items) return def.items.some(isAsyncSchema)
    // records/sets
    if (def.keyType || def.valueType) return isAsyncSchema(def.keyType) || isAsyncSchema(def.valueType)
    // transform fns
    if (def.transform && isAsyncConstructor(def.transform)) return true;
    // refine fns
    if (def.fn && isAsyncConstructor(def.fn)) return true;
    if (def.checks?.length) return def.checks.some(isAsyncSchema);

    return false;
}