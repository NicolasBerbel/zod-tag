import z from 'zod'
import { type IRenderableKargs, zt } from '../../dist/main.js'

const sleep = (d = 300) => new Promise(r => setTimeout(r, d));
const loadData = (data: any, d = 300) => sleep(d).then(() => data);

const r1 = zt.t`Hello ${1} World`
const r2 = zt.t`Good ${'val'} bye!`
const r3 = zt.z({ syncName: z.string() })`Sync ${e => e.syncName}!`

const asyncStringSchema = z.string().transform(async (v) => loadData(v.toUpperCase()))

const asyncTemplate = zt.z({
    name: asyncStringSchema,
})`Good ${'val'} bye!`

const parent = zt`
    ---- R1:
    ${r1}

    ---- R2:
    ${r2}

    ---- SYNC:
    ${r3}

    ---- ASYNC:
    ${asyncTemplate}
`

const kargs: IRenderableKargs<typeof parent> = {
    name: 'name is transformed with async op',
    syncName: '"sync name"'
};


console.log(parent, await parent.renderAsync(kargs), zt.debug(await parent.renderAsync(kargs)))