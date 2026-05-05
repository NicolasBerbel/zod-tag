import { type KargsType } from "../types/tag.types";
import {
    type IZodTagRenderable,
    isZTRenderable,
} from "./renderable"
import { extractScopedKargs, scopedSchemaKargs } from "./scope";
import {
    type InterpolationOperation,
    InterpolationError,
} from "./interpolation-error"
import { isSchemaType } from "./schema";
import { staticChildChunks, ZtChunk } from "./chunks";

/**
 * Resolves dynamic schemas and selectors
 * 
 * Either return a IRenderable or a TagPrimitive 
 */
export const resolveSlot = (value: any, k: KargsType) => {
    while (true) {
        if (isSchemaType(value)) {
            value = value.decode(scopedSchemaKargs(value, k));
            continue;
        }

        if (typeof value === 'function') {
            value = value(k);
            continue;
        }

        return value;
    }
}

/**
 * Generator that interpolates a renderable given its input kargs
 * 
 * yields tuples with finished values: [string, value: unknown]
 * 
 * ends with tuple with single string, the closing structure: [string]
 */
export function* interpolateChunks<
    R extends IZodTagRenderable<K, any>,
    K extends KargsType
>(renderable: R, input: K): Generator<ZtChunk, void> {
    const {
        strs,
        vals,
        schema,
        scope,
        __compiled,
        __dynamic,
    } = renderable as any as IZodTagRenderable;

    // Ensure compiled
    if (!__compiled)
        throw InterpolationError.for('interpolation on uncompiled renderable', {
            value: renderable,
            index: -1,
            strings: strs,
            renderer: renderable,
            op: "renderable"
        });

    // Bypass processing for static renderables
    if (!__dynamic) {
        const last = yield* staticChildChunks(renderable)
        yield Object.freeze([last])
        return;
    }

    // Validate kargs compiled
    let kargs: K = extractScopedKargs(input, scope);
    if (schema) {
        const parsed = schema.safeDecode(input)
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

    let i = 0;
    let value;
    let op: InterpolationOperation = null!;
    // current first structural string
    let buffer = strs[0];
    try {
        for (; i < vals.length; i++) {
            /** Resolve schemas and selectors until they return either a renderable or a primitive */
            value = resolveSlot(vals[i], kargs)

            /* This means we have a dynamic nested template */
            if (isZTRenderable(value)) {
                // Bypass processing static children
                if (!value.__dynamic) {
                    buffer = yield* staticChildChunks(value, buffer, strs[i + 1])
                    continue;
                }

                const scopedKargs = extractScopedKargs(kargs, value.scope)
                // track child head structure
                let head = true;
                for (const chunk of interpolateChunks(value, scopedKargs)) {
                    if (head) {
                        /** Head concatenation */
                        buffer += chunk[0];
                        head = false;
                    } else {
                        // sets buffer with current children's finished structure
                        buffer = chunk[0];
                    }

                    if (chunk.length === 2) {
                        /** yields child renderable pair */
                        yield Object.freeze([buffer, chunk[1]])
                        // reset for next structure
                        buffer = '';
                    } else {
                        // concat buffer/struct with last parent structure
                        /** Tail concatenation */
                        buffer += strs[i + 1]
                    }
                }
            } else {
                /** yields current renderable pair */
                yield Object.freeze([buffer, value]);
                // reset the buffer with current struct
                buffer = strs[i + 1]
            }
        }
    } catch (e) {
        throw InterpolationError.for(e, { index: i, op, renderer: renderable, strings: strs, value })
    }

    /**
     * Last string of the structure of this renderable
     * 
     * If this is a static renderable this is also the first and only yield of this generator
     */
    yield Object.freeze([buffer])
}
