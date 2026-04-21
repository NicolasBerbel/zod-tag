import z from "zod";

export const typedParam = <
    P extends string,
    T extends z.ZodType,
    R = z.output<T>
>(
    argName: P,
    schema: T,
    decode: (v: z.output<T>) => R = ((e: any) => e) as any,
) => z.codec(
    z.object({ [argName]: schema } as { [K in P]: T }),
    schema,
    {
        encode: v => ({ [argName]: v } as any),
        decode: v => (v as any)[argName],
    }).transform(decode)