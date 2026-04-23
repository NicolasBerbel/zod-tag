import { z } from 'zod'
import { zt } from '../../../dist/main.js'

const date = zt.p('now', z.date().default(() => new Date()).optional(), d => d.toLocaleString() + `${d.getMilliseconds()}`.padEnd(3, '0'))

const user = zt.t`@${zt.p('user', z.string(), d => d.toLowerCase().split(' ').join('.'))} <${zt.p('email', z.email())}>`

const panel = zt.t`
-------------------------------------------
----------- Title: ${zt.p('title', z.string())}
----------- Date: ${date}
----------- User: ${user}
----------- Dir: ${process.cwd()}
----------- File: ${process.argv[1].replace(process.cwd(), '')}
----------- Frame: ${zt.p('frame', z.function(), e => e().toFixed(4) + 'ms')}
----------- Delta: ${zt.p('delta', z.function(), e => e().toFixed(4) + 'ms')}
----------- Count: ${zt.p('count', z.number())}
-------------------------------------------
`


let count = 0;
setInterval(() => {
    const start = performance.now()
    console.clear()
    console.time('panel.render()')
    const res = panel.render({
        title: 'Lorem ipsum dolor sit amet',
        user: 'username has dots',
        email: 'user@email.com',
        frame: () => performance.now() - start,
        delta: () => performance.now(),
        count: count++,
    })
    const content = zt.debug(res)
    console.log(content)
    console.timeEnd('panel.render()')
    console.log((performance.now() - start))
}, 16)
