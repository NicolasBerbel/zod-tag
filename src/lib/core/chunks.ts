import { IZodTagRenderable } from "./renderable";

/**
 * A chunk represents a pair of finished tokens
 * [str, val] or last [str]
 */
export type ZtChunk = readonly [structure: string, value: unknown] | readonly [lastStructure: string]

/** Iterates a `ZtChunk` generator and returns a immutable interpolation tuple with [strings, ...values] */
export const collectChunks = (
    generator: Generator<ZtChunk>
) => {
    const [strs, vals] = collectChunkTuple(generator);
    return Object.freeze([strs, ...vals] as const);
}

/** Iterates a `ZtChunk` generator and returns a immutable tuple with [strings: string[], values: unknown[]] */
export const collectChunkTuple = (
    generator: Generator<ZtChunk>
) => {
    const strings: string[] = [];
    const values = [] as unknown[];

    for (const chunk of generator) {
        strings.push(chunk[0]);
        if (chunk.length === 2) values.push(chunk[1]);
    }

    Object.freeze(strings)
    Object.freeze(values)
    return Object.freeze([strings, values] as const);
}

/**
 * stitch static child strs and values into lead str, yielding tuple pairs of finished [str, val]
 * and returning the remaining tail structure of the renderable
 * 
 * The caller is responsible to concat the returned end structure
 */
export function* staticChildChunks(
    renderable: IZodTagRenderable<any, any>,
    lead = '',
    tail = '',
): Generator<ZtChunk, any, undefined> {
    const { strs, vals } = renderable;

    for (let i = 0; i < vals.length; i++) {
        /* Head concat */
        yield Object.freeze([lead + strs[i], vals[i]])
        lead = '';
    }

    // Final single string struct is yielded / concatenated by parent
    /** Head+Tail concat for single str / Tail concat for multiple */
    return lead + strs[vals.length] + tail
}
