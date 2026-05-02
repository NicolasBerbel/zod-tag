import z from "zod";
import {
    createRenderable,
    DEFAULT_MERGE,
    DEFAULT_TRAIT,
    ZtMerge,
    ZtTrait
} from "./core/renderable";
import { TypedTag } from "./typed-tag";
import { createSchema } from "./core/schema";

export const createSchemaTag = <
    Shape extends z.core.$ZodShape,
    Trait extends ZtTrait = DEFAULT_TRAIT,
    Merge extends ZtMerge = DEFAULT_MERGE,
>(
    shape: Shape,
    trait: ZtTrait = DEFAULT_TRAIT,
    merge: ZtMerge = DEFAULT_MERGE,
) => {

    const schema = createSchema(shape, trait)
    type Schema = z.ZodObject<Shape>;
    type Input = z.input<Schema>
    type Output = z.output<Schema>

    const schemaTag = (
        strs: TemplateStringsArray,
        ...vals: any[]
    ) => createRenderable(strs, vals, schema, [], trait, merge);

    return schemaTag as any as TypedTag<Input, Output>;
}

/** Create a schema tag with "loose" object schema */
export const schemaTag = <
    Shape extends z.core.$ZodShape
>(shape: Shape) => createSchemaTag<Shape, 'loose'>(shape);

/** Create a schema tag with "strict" object schema */
schemaTag.strict = <
    Shape extends z.core.$ZodShape
>(shape: Shape) => createSchemaTag<Shape, 'strict'>(shape, 'strict');

/** Create a schema tag with "strip" object schema */
schemaTag.strip = <
    Shape extends z.core.$ZodShape
>(shape: Shape) => createSchemaTag<Shape, 'strip'>(shape, 'strip');

