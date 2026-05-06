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
import { isPromise } from "./async";


/**
 * Generator that interpolates a renderable given its input kargs
 * 
 * yields tuples with finished values: [string, value: unknown]
 * 
 * ends with tuple with single string, the closing structure: [string]
 */
export async function* interpolateChunksAsync<
    R extends IZodTagRenderable<K, any>,
    K extends KargsType
>(renderable: R, input: K): AsyncGenerator<ZtChunk, void> {
    const {
        strs,
        vals,
        schema,
        scope,
        __compiled,
        __dynamic,
        __async,
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
        const parsed = await schema.safeDecodeAsync(input)
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
            let value = vals[i]
            /** Resolve schemas and selectors until they return either a renderable or a primitive */
            while (true) {
                if (isSchemaType(value)) {
                    value = await value.decodeAsync(scopedSchemaKargs(value, kargs));
                    continue;
                }

                if (typeof value === 'function') {
                    value = value(kargs);
                    /**
                     * Returning a promise on a selector violates a core principle:
                     * - Selectors must remain pure functions, no side-effects at the render pipeline
                     * - Use async schema for async operations at the validation pipeline: schema.transform(async () => {})
                     * 
                     * Core concept for 'values':
                     * - selectors = (only validated values in)
                     * - schemas/renderables = (only validated values out)
                     * 
                     * Core concept for 'structure' classification:
                     * - selectors = (classify validated data into values or structure)
                     * - schemas/renderables = (classify input data into validated data or structure)
                     * 
                     * One design choice: Throw on async selectors
                     * Other option: as before async/the sync path, Promise's are like number, Date
                     * or anything else, primitive values.
                     */
                    if (isPromise(value)) {
                        throw InterpolationError.for(
                            'Async selector violation at the render pipeline! ' +
                            'for async operations at the validation pipeline ' +
                            'use Zod transforms with async arrows: schema.transform(async () => {})',
                            {
                                index: i,
                                op: 'selector',
                                renderer: renderable,
                                strings: strs,
                                value,
                            })
                    }
                    continue;
                }

                break;
            }

            /* This means we have a dynamic nested template */
            if (isZTRenderable(value)) {
                // Ensure compiled
                if (!__compiled)
                    throw InterpolationError.for('interpolation with nested uncompiled renderable', {
                        value: renderable,
                        index: -1,
                        strings: strs,
                        renderer: renderable,
                        op: "renderable"
                    });

                // Bypass processing static children
                if (!value.__dynamic) {
                    buffer = yield* staticChildChunks(value, buffer, strs[i + 1])
                    continue;
                }

                // track child head structure
                let head = true;
                const scopedKargs = extractScopedKargs(kargs, value.scope)
                for await (const chunk of interpolateChunksAsync(value, scopedKargs)) {
                    if (head) { buffer += chunk[0]; head = false; }
                    else buffer = chunk[0];
                    if (chunk.length === 2) {
                        yield Object.freeze([buffer, chunk[1]]);
                        buffer = "";
                    } else {
                        buffer += strs[i + 1];
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
