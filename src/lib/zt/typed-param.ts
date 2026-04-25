import z from "zod";
import {
    type IRenderable,
    type IRenderableKargs,
    type IRenderableOutput,
    createRenderable
} from '../core/renderable'

export function typedParam<
    P extends string,
    T extends IRenderable<any, any>
>(
    argName: P,
    renderable: T
): IRenderable<{ [K in P]: IRenderableKargs<T> }, IRenderableOutput<T>>

export function typedParam<
    P extends string,
    T extends z.ZodType,
    R = z.output<T>
>(
    argName: P,
    schema: T,
    decode?: (v: z.output<T>) => R,
): z.ZodPipe<z.ZodCodec<z.ZodObject<{ [K in P]: T }>, T>, z.ZodTransform<R, z.output<T>>>;


export function typedParam(
    argName: any,
    schemaOrTemplate: any,
    decode: any = ((e: any) => e) as any,
) {
    if (schemaOrTemplate?._zod) {
        const schema = schemaOrTemplate;
        return z.codec(
            z.object({ [argName]: schema }),
            schema,
            {
                encode: v => ({ [argName]: v } as any),
                decode: v => (v as any)[argName],
            }).transform(decode)
    }

    const template = schemaOrTemplate;
    return createRenderable(function renderScopedTemplate(karg) {
        return template.render(karg[argName])
    })
}