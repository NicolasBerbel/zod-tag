import {
    type IRenderable,
    type IZodTagRenderable,
    createRenderable,
    isRenderable,
    isZTRenderable
} from "./renderable";
import { isSchemaType } from "./schema";
import { getSlotScope } from "./slot";

/** Traverse the scope path and builds a shape for that schema */
export const buildScopedShape = (schema: any, scope: string[] = []): any => {
    if (!scope.length) return schema;
    const k = {} as any;
    for (const key of scope) k[key] = schema;
    return k;
}

/** Traverse the scope path and return selected kargs slice */
export const extractScopedKargs = (kargs: any, scope: string[] = []) => {
    if (!scope.length) return kargs;
    let k = kargs;
    for (const key of scope) {
        if (k == null) return undefined;
        k = k[key];
    }
    return k;
}

/** Extracts kargs within scope for zod schemas */
export const scopedSchemaKargs = (value: any, kargs: any) => {
    if (!value?._zod) return kargs;
    return extractScopedKargs(kargs, value.__ztScope)
}

/** Merges the scopable element current scope with given scope path and return a full scoped path */
export const mergeScope = (value: any, scope: string[] = []) => {
    const currentScope = getSlotScope(value)
    return [...scope, ...currentScope];
}

/**
 * Scopes values under keyword namespace
 *
 * @param vals Values tuple
 * @param scope scoped namespace key
 */
export const withScope = (vals: any[], scope: string[] = [], withSelectors = false) => {
    if (!scope?.length) return vals;

    return vals.map(v => {
        let _v = v as any;

        if (isZTRenderable(v)) {
            // create scoped renderable
            _v = scopedRenderable(v, scope);
        } else if (isSchemaType(v)) {
            // create scoped schema
            _v = v.clone();
            Object.defineProperty(_v, '__ztScope', {
                value: mergeScope(v, scope),
                configurable: false,
                enumerable: false,
                writable: false,
            });
        } else if (typeof v === 'function' && withSelectors) {
            // create scoped selector (only for selectors flattened at compilation phase)
            _v = (kargs: any) => {
                const scopedKargs = extractScopedKargs(kargs, scope);
                const r = v(scopedKargs)
                // When precompiled selectors dynamically return a IRenderable this child has to be rescoped.
                if (isRenderable(r)) return scopedRenderable(r, scope)
                return r;
            }
        }
        return _v;
    });
};

/**
 * Clones a renderable under a scoped namespace
 * @param renderable 
 * @param scope 
 */
export const scopedRenderable = <T extends IRenderable<any, any>>(
    renderable: T,
    scope: string[] = [],
) => {
    const v = renderable as any as IZodTagRenderable;
    const combinedScope = mergeScope(v, scope);
    const scopedValues = withScope(v.vals, scope);
    return createRenderable(v.strs, scopedValues, v.schema, combinedScope, v.trait, v.merge);
}
