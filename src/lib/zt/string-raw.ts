export type StringRawTransformFn = (v: any, i: number) => any

export type StringRawTransformer = ([str, ...val]: [any, ...any[]]) => string

export const stringRaw = (map: StringRawTransformFn): StringRawTransformer => ([str, ...val]) => String.raw({ raw: str }, ...val.map(map))