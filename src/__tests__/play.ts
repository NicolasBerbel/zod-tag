import z from 'zod'
import { zt } from '../../dist/main.js'
import { deepEqual } from 'node:assert'

const r1 = zt.t`Hello ${1} World`
const r2 = zt.t`Good ${'val'} bye!`

const parent = zt`
    ---- R1:
    ${r1}

    ---- R2:
    ${r2}
`

console.log(parent, parent.render(), zt.debug(parent.render()))