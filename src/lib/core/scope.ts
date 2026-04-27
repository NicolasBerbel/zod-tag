import {
    type IRenderable,
    type IZodTagRenderable,
    createRenderable,
    isRenderable
} from "./renderable";

/** Extracts kargs from scope for zod schemas */
export const scopedKargs = (value: any, kargs: any) => (value?._zod && value.__ztScope) ? kargs[value.__ztScope] : kargs;

/**
 * Scopes values under keyword namespace
 *
 * @param vals Values tuple
 * @param scope scoped namespace key
 */
export const withScope = (vals: any[], scope?: string) => {
    if (!scope) return vals;
    return vals.map(v => {
        let _v = v as any;
        if (isRenderable(v)) {
            // create scoped renderable
            _v = scopedRenderable(v, scope);
        } else if (v?._zod) {
            // create scoped schema
            _v = v.clone();
            Object.defineProperty(_v, '__ztScope', {
                value: scope,
                configurable: false,
                enumerable: false,
                writable: false,
            });
        } else if (typeof v === 'function') {
            // create scoped selector
            _v = (kargs: any) => v(kargs?.[scope]);
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
    scope?: string,
) => {
    const v = renderable as any as IZodTagRenderable;
    return createRenderable(v.strs, v.vals, v.schema, scope)
}