import z from "zod";
import { staticChildChunks, type ZtChunk } from "./chunks";
import { InterpolationError } from "./interpolation-error";
import {
    type IZodTagRenderable,
    isZTRenderable,
} from "./renderable";
import { isSchemaType, mergeSchemas } from "./schema";
import { applyScope } from "./scope";
import { isAsyncSchema } from "./async";

type CompiledResultChunk = [
    finalStructure: string,
    nothing: undefined,
    schema: z.ZodType | undefined,
    isDynamic: boolean,
    isAsync: boolean,
]

/**
 * Generator that compiles a renderable
 * 
 * yields tuples with compiled values: [string, value: unknown]
 * 
 * ends with tuple with single string, the closing structure, skips index 1, and follows with resolved parsed flags
 * (collected schema and isDynamic)
 */
export function* compileChunks(
    renderable: IZodTagRenderable<any, any>,
): Generator<ZtChunk | CompiledResultChunk> {
    const { strs, vals, schema, merge, trait } = renderable;

    let _schema = schema
    let _dynamic = !!schema;
    let _async = isAsyncSchema(schema);

    let i = 0
    let buffer = strs[0]
    try {
        for (; i < vals.length; i++) {
            const value = vals[i];

            if (isZTRenderable(value)) {
                if (!value.__compiled)
                    throw InterpolationError.for(new Error('uncompiled nested pre-compile violation!'), {
                        index: i,
                        op: 'renderable',
                        renderer: renderable,
                        strings: strs,
                        value,
                    })

                if (!value.__dynamic) {
                    buffer = yield* staticChildChunks(value, buffer, strs[i + 1])
                    continue
                }

                // dynamic flag
                _dynamic = true;
                // async flag
                if (value.__async) _async = true;

                // merge schemas
                const [mergedSchema] = mergeSchemas(_schema, value, merge, trait)
                _schema = mergedSchema;

                let inner = value.strs[0]
                // stitch dynamic child struct+values into parent
                for (let j = 0; j < value.vals.length; j++) {
                    const scopedValue = applyScope(value.vals[j], value.scope, true);
                    /* Head concat */
                    yield [buffer + inner, scopedValue];
                    buffer = '';
                    inner = value.strs[j + 1]
                }
                /* Tail concat */
                buffer += inner + strs[i + 1];
            } else {
                // dynamic flag
                const isSchema = isSchemaType(value)
                if (typeof value === 'function' || isSchema) {
                    _dynamic = true;
                }
                // async flag
                const isAsync = isSchema && isAsyncSchema(value)
                if (isAsync) _async = true;

                // dynamic or primitive = yield struct+val
                yield [buffer, value];
                buffer = strs[i + 1]
            }
        }
    } catch (e) {
        throw InterpolationError.for(e, {
            index: i,
            op: 'renderable',
            renderer: renderable,
            strings: strs,
            value: null,
        });
    }

    yield [buffer, , _schema, _dynamic, _async]
}
