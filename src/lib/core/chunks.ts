/**
 * A chunk represents a pair of finished tokens
 * [str, val] or last [str]
 */
export type ZtChunk = readonly [structure: string, value: unknown] | readonly [lastStructure: string]

/** Iterates a `ZtChunk` generator and returns a immutable interpolation tuple with [strings, ...values] */
export const collectChunks = (
    generator: Generator<ZtChunk>
) => {
    const strings: string[] = [];
    const values = [] as unknown[];

    for (const chunk of generator) {
        strings.push(chunk[0]);
        if (chunk.length === 2) values.push(chunk[1]);
    }

    Object.freeze(strings)
    return Object.freeze([strings, ...values] as const);
}