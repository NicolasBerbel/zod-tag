/**
 * Not exactly a proper type testing file yet more of a playground
 */

import z from "zod"
import { zt } from "../lib"


const schemaTpl = zt.z({ name: z.string() })`
    Hello 

    ${z.string()}

    ${zt.t`Name is: ${z.string()}-${z.number()}`}

    ${zt.p('test', z.number(), e => zt`Teste ${e}`)}

    ${e => e.name}


`

const reschemaTpl = schemaTpl.render({
    name: 'asd',
    // uuidv4: crypto.randomUUID(),
    test: 123
}, ['asd', '5', 21])


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

    ${(e: { name: string }) => e.name}

    ${[1, 2, (e: { name: string }) => `name=${e.name}` as const, 4] as const}


`
kwArrValuesTpl2.render({ name: 'asd' })


const staticValuesTpl3 = zt.t`
    [static]: ${3} ${'const value' as const}
`

staticValuesTpl3.render()

const variadicZod = zt.t`
    [static]: ${4} ${'const value' as const}

    ${z.number()}

    ${() => z.string()}

`.render(void 0, [12354123, '12'])

const kargsFnZod = zt.t`
    [kargsFnZod]: ${5} ${{ testObj: 123 }}

    ${z.object({ a: z.number() })}
    ${z.string()}

    ${(v: { name: string, email: string }) =>
        `${v.name} - ${v.email}` as const
    }
`

kargsFnZod.render({
    a: 123,
    email: 'asd',
    name: '213'
}, ['string'])

const kargsFnZod2 = zt.t`
    [kargsFnZod]: ${5} ${{ testObj: 123 }}

    ${z.object({ a: z.number() })}
    ${z.number()}
    ${z.object({ asd: z.string() })}
`

kargsFnZod2.render({
    a: 123,
    asd: ""
}, [123])

const composedTpl = zt.t`
    [composedTpl]: ${5} ${{ testObj: 123 }}

    ${kargsFnZod}

`
composedTpl.render({
    a: 123,
    email: 'asd',
    name: '213'
}, ['String'])


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
    asd: '213'
}, ['varg1', 'varg2', 1254])

// console.log({ r: rescomposedTpl2 })

// console.log(String.raw({ raw: rescomposedTpl2[0] }, ...rescomposedTpl2.slice(1).map(e => JSON.stringify(e))))
