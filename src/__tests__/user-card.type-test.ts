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
    val: ${z.string().default('aaa')}
    val2: ${z.string().default('aaa')}
`

const renderedUserCard = userCard.render({
    first: 'User',
    last: 'Name',
    birtdate: new Date('01/01/1995')
})

const userTitle = zt.t`
    A new user in the application
    ${z.string().meta({ title: 'User message' })}
    ${z.string().meta({ title: 'Variadic argument' }).default('Ok default works if variadic arguments are the last ones')}
`

// const renderedUserTitle = userTitle.render(void 0, ['Say welcome!'])

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
}, ['Developer', 'Something', 'Lorem ipsum dolor'])

console.log(renderedUserHeading, zt.raw(e => e)(renderedUserHeading))
// console.log(renderRaw(renderedUserTitle))


// const schemaTpl = zt.$n(zt`Hi!`.render())
