import { z } from 'zod';

/**
 * Determines if a Zod schema expects an object as input
 * @param schema - The Zod schema to check
 */
export function expectsObject(schema: z.ZodType): boolean {
    const def = schema._zod.def;
    const _def = def as any;

    switch (def.type) {
        case 'nullable':
            return expectsObject(_def.innerType);

        case 'lazy':
            return expectsObject(_def.getter());

        case 'intersection':
            return expectsObject(_def.left) || expectsObject(_def.right);

        case 'union':
            return _def.options.some(expectsObject);

        case 'pipe':
            return expectsObject((schema as z.ZodCodec<any>).in);

        case 'object':
            return true;

        default:
            return false;
    }
}