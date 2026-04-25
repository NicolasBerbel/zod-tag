/**
 * Not exactly a proper type testing file yet more of a playground
 */

import z from 'zod'
import { zt } from '../../dist/main.js'

const hello = zt`Hello ${1} World`
console.log(zt.debug(hello.render()), hello.render().slice(1))

const userCard = zt.z({
    first: z.string(),
    last: z.string(),
    birtdate: z.date().optional(),
})`
    Hello: ${e => `${e.first} ${e.last}`}
    Age: ${e => e.birtdate ? new Date().getFullYear() - new Date(e.birtdate).getFullYear() : 'unknown age'}
    val: ${zt.p('val', z.string().default('aaa'))}
    val2: ${zt.p('val2', z.string().default('aaa'))}
`

const renderedUserCard = userCard.render({
    first: 'User',
    last: 'Name',
    birtdate: new Date('01/01/1995')
})

const userTitle = zt.t`
    A new user in the application
    ${zt.p('user_message', z.string().meta({ title: 'User message' }))}
`

const userHeading = zt.z({
    date: z.date().optional().default(() => new Date())
})`
    Date: ${e => e.date.toLocaleDateString()}
    Timestamp: ${d => d.date.getTime()}
    Date: ${d => d.date.getDate()}

    ----- USER CARD -----
    ${userCard}
    ---- TITLE ----
    ${userTitle}
`

const renderedUserHeading = userHeading.render({
    birtdate: new Date('05/06/2007'),
    first: 'John',
    last: 'Doe',
    user_message: 'Say hello!',
    val2: 'Content of val2'
})

console.log(renderedUserHeading, zt.raw(e => e)(renderedUserHeading))
// console.log(renderRaw(renderedUserTitle))


// const schemaTpl = zt.$n(zt`Hi!`.render())
