import z from "zod";
import {
    type IRenderableKargs,
    type IRenderableOutput,
    type IRenderable,
    type ZtTrait,
    DEFAULT_TRAIT,
} from "../core/renderable";
import { typedTag } from "../typed-tag";
import { getSlotShape } from "../core/slot";
import { createSchema } from "../core/schema";

export function patternMatch<
    Discriminator extends string,
    Cases extends Record<string, IRenderable<any, any>>,
    Trait extends ZtTrait = DEFAULT_TRAIT,
>(
    discriminator: Discriminator,
    cases: Cases,
    trait: Trait = DEFAULT_TRAIT as any,
) {
    const unionSchemas = Object.entries(cases).map(([key, renderable]) => {
        const shape = getSlotShape(renderable) ?? {}
        return createSchema({ ...shape, [discriminator]: z.literal(key) }, trait)
    })

    const union = z.discriminatedUnion(discriminator, unionSchemas as any)
        .transform((e) => cases[e[discriminator]])

    return typedTag`${(e: any) => union.decode(e)}` as (
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
            IRenderableOutput<Cases[keyof Cases]>
        >
    )
}

