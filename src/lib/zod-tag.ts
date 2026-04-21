import { typedTag } from "./typed-tag";
import { schemaTag } from "./schema-tag";
import { stringRaw, type StringRawTransformer } from "./zt/string-raw";
import { typedParam } from "./zt/typed-param";
import { unsafeStatic } from "./zt/unsafe-static";

/**
 * Zod Tag
 */
export const zt = typedTag as (typeof typedTag) & {
    /**
     *  Schema Tag - assign a karg schema shape and it will be enhanced with the template interpolation values
     * 
     * @example
     * ```ts
     * const tpl = zt.z({ name: z.string() })`Hello, ${e => e.name}`
     * 
     * tpl.render() // type error and runtime error
     * tpl.render({ name: 'John Doe' }) // valid -> [['Hello', ''], 'John Doe']
     * ```
     **/
    z: typeof schemaTag,
    zod: typeof schemaTag,

    /**
     *  Typed Tag - assign a karg schema shape and it will be enhanced with the template interpolation values
     * 
     * @example
     * ```ts
     * // Static
     * const tpl = zt.t`Hello World!`
     * tpl.render() // ok -> [['Hello World!']]
     * 
     * // Keyword arguments
     * const tpl = zt.t`Hello, ${zt.p('name', z.string())}`
     * 
     * tpl.render() // type error and runtime error
     * tpl.render({ name: 'John Doe' }) // valid -> [['Hello', ''], 'John Doe']
     * 
     * 
     * // Variadic
     * const tpl = zt.t`Hello, ${z.string()}`
     * 
     * tpl.render() // type error and runtime error
     * tpl.render(void 0, ['John Doe']) // valid -> [['Hello', ''], 'John Doe']
     * ```
     **/
    t: typeof typedTag,
    template: typeof typedTag,

    /**
     * Defines a named keyword argument for a inline schema
     * 
     * Its actually just a zod codec
     * 
     * @param name The keyword argument name for this schema
     * @param schema the zod schema
     * @param decode a transform fn for the resulting interpolation value
     * 
     * @example
     * ```ts
     * // If the transform fn returns a transformed interpolation value:
     * const tpl = zt.t`
     *      ${zt.p('email', z.email(), e => `email=${e.email}`)}
     * `
     * tpl.render({ email: 'user@email.com' })
     * // -> [['', ''], 'email=user@email.com']
     * 
     * // If the transform fn returns another renderable template:
     * const tpl2 = zt.t`
     *      ${zt.p('email', z.email(), e => zt.t`email=${e.email}`)}
     * `
     * tpl2.render({ email: 'user@email.com' })
     * // -> [['email=', ''], 'user@email.com']
     * ```
     * 
     */
    p: typeof typedParam,
    param: typeof typedParam,

    /**
     * Escape hatch for unsafe concatenating strings.
     * 
     * This generates a static renderable template with that string as a single static and no interpolation values.
     * 
     * @danger RISK OF CONCATENATING USER INPUT! 
     * 
     * @param str The string that will be trusted and blindly concatenated by parent templates
     * @returns a renderable that treats this string as a trusted static value
     */
    unsafe: typeof unsafeStatic,

    /**
     * Creates a function that transforms the values with the map fn and reduces the interpolation to a string.
     * 
     * The returned function simply calls String.raw with the interpolation strings and the transformed values
     * 
     * @param map Map callback to transform each value before raw interpolation
     * 
     * @example
     * ```ts
     * const tpl = z.t`
     *      Hello, ${'John'}!
     * `
     * 
     * const tplInterpolaton = tpl.render();
     * // --> [['Hello', '!'], 'John']
     * 
     * const tplRaw = zt.raw(e => e)(tplInterpolaton); // identity transform
     * // 'Hello, John!'
     * 
     * const tplDollarSign = zt.raw((_, i) => `$${i}`)(tplInterpolaton); // sql like $n transform
     * // 'Hello, $0!'
     * 
     * const values = tplInterpolaton.slice(1)
     * // ['John']
     * 
     * ```
     */
    raw: typeof stringRaw,

    /** Render `$n` values placeholders */
    $n: StringRawTransformer,

    /** Render `@n` values placeholders */
    atIndex: StringRawTransformer,

    /**
     * Render to raw string
     * @warn only for debug purposes, this concatenates everything into a single string trating every value as safe input
     * @debug
     **/
    debug: StringRawTransformer,
};

zt.z = schemaTag
zt.zod = schemaTag

zt.t = typedTag
zt.template = typedTag

zt.p = typedParam
zt.param = typedParam

zt.unsafe = unsafeStatic;
zt.raw = stringRaw
zt.$n = zt.raw((_, i) => `$${i}`)
zt.atIndex = zt.raw((_, i) => `@${i}`)
zt.debug = zt.raw(e => e)
