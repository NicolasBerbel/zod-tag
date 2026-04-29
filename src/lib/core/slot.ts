import { isSchemaType } from "./schema";

/** Returns schema for given slot value  */
export const getSlotSchema = (source: any) => isSchemaType(source) ? source : source?.schema;

/** Returns shape for given slot value  */
export const getSlotShape = (source: any) => getSlotSchema(source)?.shape

/** Returns scope for given slot value  */
export const getSlotScope = (source: any) => source?._zod && source.__ztScope ? source.__ztScope : source?.scope

