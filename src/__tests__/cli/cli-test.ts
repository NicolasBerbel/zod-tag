import { z } from 'zod'
import { zt } from '../../../dist/main.js'

const date = zt.p('now', z.date().optional().default(() => new Date()), d => d.toLocaleString() + `${d.getMilliseconds()}`.padEnd(3, '0'))

const user = zt.t`@${zt.p('user', z.string(), d => d.toLowerCase().split(' ').join('.'))} <${zt.p('email', z.email())}>`

const nested1 = zt.z({ nested1: z.string().optional().default(() => crypto.randomUUID()) })`
    nested1 id = (${e => e.nested1})
    Nested1 template child: ${zt.p('optional', z.string().default('Nested default evaluation'))}
    ${() => 'hello from template 1'}
`
const nested2 = zt.z({ nested2: z.string().optional().default(() => crypto.randomUUID()) })`
    nested2 id = (${e => e.nested2})
    Nested2 template child: ${zt.p('nested1scope', zt.t`${nested1} Parent to child composition: ${'constant value'}`)}
`

const nested2_ = zt.z({ nested2: z.string().optional().default(() => crypto.randomUUID()) })`
    THIS IS INVALID ? for now?: ${(e) => zt.p('nested1scope', zt.t`${nested1} Parent to child composition: ${e.nested2}`)}
`
const nested3 = zt.z({ nested3: z.string().optional().default(() => crypto.randomUUID()) })`
    nested3 id = (${e => e.nested3})
    Nested3 value: ${zt.p('optional', z.string().default('Nested3 default evaluation'))}
    Nested3 template child: ${zt.p('nested2scope', nested2)}
`
const nested4 = zt.z({ nested4: z.string().optional().default(() => crypto.randomUUID()) })`
    nested4 id = (${e => e.nested4})
    Nested4 template child: ${zt.p('nested3scope', nested3)}`

const nested5 = zt.z({ nested5: z.string().optional().default(() => crypto.randomUUID()) })`
    nested5 id = (${e => e.nested5})
    Nested5 value: ${zt.p('optional', z.string().default('Nested5 default evaluation'))}
    Nested5 template child: ${zt.p('nested4scope', nested4)}`

const nested6 = zt.z({ nested6: z.string().optional().default(() => crypto.randomUUID()) })`
    nested6 id = (${e => e.nested6})
    Nested6 template child: ${zt.p('nested5scope', nested5)}`

const nested7 = zt.z({ nested7: z.string().optional().default(() => crypto.randomUUID()) })`
    nested7 id = (${e => e.nested7})
    Nested7 template child: ${zt.p('nested6scope', nested6)}`

const nested8 = zt.z({ nested8: z.string().optional().default(() => crypto.randomUUID()) })`
    nested8 id = (${e => e.nested8})
    Nested8 template child: ${zt.p('nested7scope', nested7)}`


const panel = zt.t`
------------------------- NESTING
------------------------ 
---- ${nested8} ----
-------------------------- PARENT
-------------------------------------------
----------- Title: ${zt.p('title', z.string())}
----------- Date: ${date}
----------- User: ${user}
----------- Dir: ${process.cwd()}
----------- File: ${process.argv[1].replace(process.cwd(), '')}
----------- Frame: ${zt.p('frame', z.function({ output: z.number() }), e => e().toFixed(4) + 'ms')}
----------- Delta: ${zt.p('delta', z.function({ output: z.number() }), e => e().toFixed(4) + 'ms')}
----------- Count: ${zt.p('count', z.number())}
-------------------------------------------
`


const initial = performance.now()
let count = 0;
const interval = setInterval(() => {
    if (count > 120) {
        const end = performance.now()
        const delta = end - initial;
        const media = delta / 120;
        if (media > 16) {
            clearInterval(interval);
            throw new Error('A cli test frame < 60fps ')
        }
        console.log("Media of", media, 'ms to render each frame of the cli test')
        return clearInterval(interval);
    }
    const start = performance.now()
    // console.clear()
    // console.time('panel.render()')
    // count++;
    const res = panel.render({
        title: 'Lorem ipsum dolor sit amet',
        user: 'username has dots',
        email: 'user@email.com',
        frame: () => performance.now() - start,
        delta: () => performance.now(),
        count: count++,
        nested8: '1213',
        nested7scope: {
            nested6scope: {
                nested5scope: {
                    nested4scope: {
                        nested4: 'nested4 id scoped',
                        nested3scope: {
                            nested2scope: {
                                nested1scope: {
                                    nested1: 'nested 1 title?'
                                }
                            }
                        }
                    }
                }
            }
            // nested7: 
        }
        // nested: {
        //     nested: { nested: { nested: { nested: { nested: { default: undefined } } } } }
        // }
    })
    const content = zt.debug(res)
    if (!content.length) {
        throw new Error('never happens')
    }
    // if (count === 1) clearInterval(interval)
    // console.clear()
    console.log(content)
    // console.log(content)
    // console.timeEnd('panel.render()')
    // console.log((performance.now() - start))
}, 0)
