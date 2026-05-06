import z from "zod";
import {
    type IRenderable,
    type IZodTagRenderable,
} from "./renderable"
import { compileChunks } from "./compile-chunks";
import { isAsyncSchema } from "./async";

type CompileResult = [strs: string[], vals: unknown[], schema: z.ZodType | undefined, dynamic: boolean, async: boolean]

/**
 * The compile step iterates through each slot preflattening the renderable with each nested renderable found
 * 
 * What is precompilable?
 * - Only direct nested renderables structures
 * 
 * What can we skip in the interpolation step?
 * - Already known static primitives can be saved and skipped later?
 */
export function compile<T extends IRenderable<any, any>>(_renderable: T): CompileResult {
    const renderable = _renderable as any as IZodTagRenderable
    const { vals: _vals, schema } = renderable

    let _schema = schema;
    let _dynamic = !!schema;
    let _async = isAsyncSchema(schema);

    // compile and collect
    const strs: string[] = [];
    const vals = [] as unknown[];
    for (const chunk of compileChunks(renderable)) {
        // Always have structure at index 0
        strs.push(chunk[0]);

        // Every chunk but the last one contains a value at index 1
        if (chunk.length === 2) vals.push(chunk[1]);

        // Parsed result with schema + flags
        if (chunk.length === 5) {
            _schema = chunk[2];
            _dynamic = chunk[3];
            _async = chunk[4];
        }
    }

    return [strs, vals, _schema, _dynamic, _async]
}
