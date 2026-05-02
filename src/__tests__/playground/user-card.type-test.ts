/**
 * Not exactly a proper type testing file yet more of a playground
 */

import z from 'zod'
import { zt, type IRenderableKargs } from '../../../dist/main.js'

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


// ============================================================================
// zt.match — discriminated union pattern matching
// ============================================================================

const createUser = zt.z({ name: z.string(), email: z.email() })`
INSERT INTO users (name, email) VALUES (${e => e.name}, ${e => e.email})
`
// const createUserStrict = createUser

const updateUser = zt.z({ id: z.uuid(), name: z.string() })`
UPDATE users SET name = ${e => e.name} WHERE id = ${e => e.id}
`
const deleteUser = zt.z({ id: z.uuid() })`
DELETE FROM users WHERE id = ${e => e.id}
`

// zt.match solves the discriminated union pattern:

// Discriminated union: the discriminator value determines which kargs are needed
// const commandSchema = z.discriminatedUnion('action', [
//     z.object({ action: z.literal('create'), name: z.string(), email: z.email() }),
//     z.object({ action: z.literal('update'), id: z.uuid(), name: z.string() }),
//     z.object({ action: z.literal('delete'), id: z.uuid() }),
// ])

/**
 *  this pattern is solved with zt.match, you can optin to 'command' scope wrapping `zt.match` with `zt.p`
 */
// const commandTemplate = zt.z({
//     command: z.discriminatedUnion('action', [
//         z.object({ action: z.literal('create'), name: z.string(), email: z.email() }),
//         z.object({ action: z.literal('update'), id: z.uuid(), name: z.string() }),
//         z.object({ action: z.literal('delete'), id: z.uuid() }),
//     ])
// })`
// ${e => zt.bind({
//     create: createUser,
//     update: updateUser,
//     delete: deleteUser,
// }[e.command.action], e.command)}
// `

const commandTemplate = zt.match('action', {
    create: createUser,
    update: updateUser,
    delete: deleteUser,
})
try {
    // TypeScript narrows: e.action is 'create' → only name + email needed
    console.log('CREATE:', zt.$n(commandTemplate.render({
        action: 'create',
        name: 'Alice',
        email: 'alice@test.com',
        // @ts-expect-error
        id: ''
        // id is NOT required here — discriminated union narrowed it away
    })))
} catch {
    // expected
}
try {
    console.log('UPDATE:', zt.$n(commandTemplate.render({
        action: 'update',
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Bob',

        // @ts-expect-error
        email: '',
        // email is NOT required here
    })))
} catch (e) {
    // expected
}

try {
    console.log('DELETE:', zt.$n(commandTemplate.render({
        action: 'delete',
        id: '550e8400-e29b-41d4-a716-446655440000',
    })))
} catch {
    // expected
}


// const result = zt.join([
//     zt.bind(zt.z({ title: z.string() })`Header is: ${e => e.title}`), // Closed
// ], zt.empty).render({ content: "Dynamic Content" });

const header = zt.bind(zt.z({ title: z.string() })`Header is: ${e => e.title}`, { title: 'Header' });
const body = zt.z({ content: z.string() })`Body is: ${e => e.content}`

const renderedJoin = zt.join([
    header,
    body,
    zt.p('header2', header),
], zt.z({ separator: z.number() })`a ${1 as const} `)