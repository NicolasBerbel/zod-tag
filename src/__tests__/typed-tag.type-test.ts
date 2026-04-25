/**
 * Not exactly a proper type testing file yet more of a playground
 */

import z from "zod"
import { zt } from "../../dist/main.js"


const schemaTpl = zt.z({ name: z.string() })`
    Hello 

    ${123}

    ${zt.p('inline_param', z.string())}

    ${e => zt.t`Name is: ${e.name}`}

    ${zt.p('test', z.number(), e => zt`Test number ${e}`)}

    ${e => e.name}


`

const reschemaTpl = schemaTpl.render({
    name: 'asd',
    inline_param: 'inline named param',
    test: 123
})


const t = zt.t`
    Hello ${'world' as const}

    ${1}

`
console.log(t)

/**
 * Tests
 */
const staticTpl = zt.t`
    [static]: novars
`
staticTpl.render()

const staticValuesTpl = zt.t`
    [static]: ${1} ${10}
`
staticValuesTpl.render()

const kwArrValuesTpl2 = zt.t`
    [static]: ${2} ${'string value'}

    ${zt.p('name', z.string())}

    ${[1, 2, (e: never) => `name=${e}` as const, 4] as const}


`
console.log(
    kwArrValuesTpl2.render({ name: 'asd' })
)


const staticValuesTpl3 = zt.t`
    [static]: ${3} ${'const value' as const}
`

staticValuesTpl3.render()

const kargsFnZod = zt.t`
    [kargsFnZod]: ${5} ${{ testObj: 123 }}

    Raw object(left as is): ${z.object({ a: z.number() })}
    Array(left as is): ${zt.p('items', z.array(z.number().or(z.string())))}
    other: ${zt.p('other', z.string().default('Some default value'))}
    name: ${zt.p('name', z.string().default('Some default value'))}
    email: ${zt.p('email', z.string().default('Some default value'))}

    ${(v: { name: string, email: string }) =>
        `${v.name} - ${v.email}` as const
    }
`

kargsFnZod.render({
    a: 123,
    email: 'asd',
    name: '213',
    items: [1, 2, 3, 'item-4', 5]
})

const kargsFnZod2 = zt.t`
    [kargsFnZod]: ${5} ${{ testObj: 123 }}

    ${z.object({ a: z.number() })}
    ${zt.p('number', z.number())}
    ${z.object({ asd: z.string() })}
`

kargsFnZod2.render({
    a: 123,
    asd: "",
    number: 321
})

const composedTpl = zt.t`
    [composedTpl]: ${5} ${{ testObj: 123 }}

    ${kargsFnZod}

`
composedTpl.render({
    a: 123,
    email: 'asd',
    name: '213',
    items: [1, 2, 3, 'item-4', 5]
})


const composedTpl2 = zt.t`
    codec: ${z.codec(z.object({ uuid: z.uuid() }), z.literal('literal'), {
    encode: (e) => ({ uuid: e }),
    decode: ({ uuid }) => 'literal' as const,
})}
    [composedTpl2]: ${5} ${{ testObj: 123 }}

    ${kargsFnZod}

    [inner composed] ${composedTpl}

    ${kargsFnZod2}
`

const rescomposedTpl2 = composedTpl2.render({
    a: 123,
    uuid: crypto.randomUUID(),
    email: 'email@email.com',
    name: 'name',
    asd: '213',
    number: 456,
    items: [1, 2, 3, 'item-4', 5]
})

// console.log({ r: rescomposedTpl2 })

// console.log(String.raw({ raw: rescomposedTpl2[0] }, ...rescomposedTpl2.slice(1).map(e => JSON.stringify(e))))
