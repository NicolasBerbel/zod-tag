import z from "zod";
import {
    type IRenderableKargs,
    type IRenderableOutput,
    type IRenderable,
    type ZtTrait,
    type IZodTagRenderable,
    DEFAULT_TRAIT,
    createRenderable,
} from "../core/renderable";
import { getSlotShape } from "../core/slot";
import { createSchema } from "../core/schema";
import { bindKargs } from "./bind-kargs";

type MatchSchemas<
    C extends Record<string, IRenderable<any, any>>,
    Discriminator extends string
> = {
    [K in keyof C]: z.ZodObject<IRenderableKargs<C[K]> & { [D in Discriminator]: K }>
}[keyof C]

export function patternMatch<
    Discriminator extends string,
    Cases extends Record<string, IRenderable<any, any[]>>,
    Trait extends ZtTrait = DEFAULT_TRAIT,
>(
    discriminator: Discriminator,
    cases: Cases,
    trait: Trait = DEFAULT_TRAIT as any,
) {
    let _isAsync = false;
    const unionSchemas = [] as z.ZodType[];
    for (const key in cases) {
        const renderable = cases[key] as any as IZodTagRenderable;
        if (renderable.__async) _isAsync = true;
        const shape = getSlotShape(renderable) ?? {}
        unionSchemas.push(createSchema({ ...shape, [discriminator]: z.literal(key) }, trait))
    }

    const union = z.discriminatedUnion(
        discriminator,
        unionSchemas as [MatchSchemas<Cases, Discriminator>]
    ).transform((e: any) => bindKargs(cases[e[discriminator]], e))

    const child = _isAsync ? (e: any) => z.transform(async () => union.decodeAsync(e)) : (e: any) => union.decode(e);

    const r = createRenderable(['', ''], [child], undefined, undefined, undefined, undefined, _isAsync) as (
        IRenderable<
            {
                [K in keyof Cases]: {
                    [P in keyof IRenderableKargs<Cases[K]> | Discriminator]:
                    P extends Discriminator ? K
                    : P extends keyof IRenderableKargs<Cases[K]>
                    ? IRenderableKargs<Cases[K]>[P]
                    : never
                }
            }[keyof Cases],
            {
                [K in keyof Cases]: IRenderableOutput<Cases[K]>
            }[keyof Cases]
        >
    )

    return r;
}

