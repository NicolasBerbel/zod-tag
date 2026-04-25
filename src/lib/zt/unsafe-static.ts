import z, { ZodType } from "zod";
import { createRenderable } from "../core/renderable";

const primitives = z.union([
  z.null(),
  z.string(),
  z.boolean(),
  z.number(),
  z.bigint(),
]);

export const unsafeStatic = <T extends z.input<S>, S extends ZodType>(schema: S, value: T) =>
  createRenderable<void, []>(() => [[String(primitives.decode(schema.decode(value) as any))]])
