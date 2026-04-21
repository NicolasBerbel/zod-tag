import z, { core } from "zod";
import { createRenderable } from "./core/renderable";
import { interpolate } from "./core/interpolate";
import { TypedTag } from "./typed-tag";

export const schemaTag = <
    S extends core.$ZodShape,
>(shape: S) => {
    const schema = z.object(shape).loose();
    type Schema = z.ZodObject<S>;
    type Input = z.input<Schema>
    type Output = z.output<Schema>

    function tag(
        strs: TemplateStringsArray,
        ...vals: any[]
    ) {
        return createRenderable(
            (karg, varg) => {
                const parsedkarg = schema.decode(karg)
                return interpolate(parsedkarg, varg, strs, ...vals)
            }
        )
    }

    return tag as TypedTag<
        Input,
        Output
    >;
}
