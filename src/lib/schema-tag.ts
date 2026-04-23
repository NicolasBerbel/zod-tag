import z, { core } from "zod";
import { createRenderable } from "./core/renderable";
import { interpolate } from "./core/interpolate";
import { TypedTag } from "./typed-tag";
import { InterpolationError } from "../main";

export const schemaTag = <
    S extends core.$ZodShape,
>(shape: S) => {
    const schema = z.object(shape).loose();
    type Schema = z.ZodObject<S>;
    type Input = z.input<Schema>
    type Output = z.output<Schema>

    function schemaTag(
        strs: TemplateStringsArray,
        ...vals: any[]
    ) {
        return createRenderable(
            function renderRenderable(karg, varg) {
                const parsedkarg = schema.safeDecode(karg)
                if (parsedkarg.error) throw InterpolationError.for(parsedkarg.error, {
                    renderer: this,
                    index: -1,
                    varg: undefined,
                    op: 'root-schema',
                    strings: [...strs],
                    value: schema,
                    variadicIndex: -1,
                })
                return interpolate.call(this, parsedkarg.data, varg, strs, ...vals)
            }
        )
    }

    return schemaTag as TypedTag<
        Input,
        Output
    >;
}
