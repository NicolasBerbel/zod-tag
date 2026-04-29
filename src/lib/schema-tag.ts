import z, { core } from "zod";
import { createRenderable } from "./core/renderable";
import { TypedTag } from "./typed-tag";
import { createSchema } from "./core/schema";

export const schemaTag = <
    S extends core.$ZodShape,
>(shape: S) => {
    const schema = createSchema(shape, "loose")
    type Schema = z.ZodObject<S>;
    type Input = z.input<Schema>
    type Output = z.output<Schema>

    function schemaTag(
        strs: TemplateStringsArray,
        ...vals: any[]
    ) {
        return createRenderable(strs, vals, schema)
    }

    return schemaTag as TypedTag<
        Input,
        Output
    >;
}
