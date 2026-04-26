import { describe, it } from 'node:test';
import { throws, deepEqual } from 'node:assert/strict';
import z from 'zod';
import { zt, InterpolationError } from '../../dist/main.js'

describe('zt - Zod Tag', () => {

    describe('static template', () => {
        it('should render a template without interpolation values', () => {
            const tpl = zt.t`static templates`
            const result = tpl.render()
            const [strings, ...values] = result;

            deepEqual(strings, ['static templates'], 'Static templates without values have only one string')
            deepEqual(values, [], 'Static templates without values returns only strings tuple')
        })

        it('should render a template with static interpolation values', () => {
            const tpl = zt.t`static templates value=${'content'}!`
            const result = tpl.render()
            const [strings, ...values] = result;

            deepEqual(strings, ['static templates value=', '!'], 'Interpolation splits strings correctly')
            deepEqual(values, ['content'], 'Interpolations values resolves to primitive values inside the template')
        })

        it('should render a template with transformed interpolation values', () => {
            const tpl = zt.t`static templates value=${() => 'transformed content'}!`
            const result = tpl.render()
            const [strings, ...values] = result;

            deepEqual(strings, ['static templates value=', '!'], 'Interpolation splits strings correctly')
            deepEqual(values, ['transformed content'], 'Interpolations values resolves to transformation values declared inside the template')
        })
    })

    describe('keyword argument templates', () => {
        it('should allow inline object/codec schemas as karg params', () => {
            const tpl1 = zt.t`
                Hello: ${z.codec(z.object({ name: z.string() }), z.string(), { encode: v => ({ name: v }), decode: v => v.name })}
            `
            const tpl2 = zt.t`
                Hello: ${z.object({ name: z.string() }).transform(v => v.name)}
            `
            const result1 = tpl1.render({
                name: 'John'
            })
            const result2 = tpl2.render({
                name: 'John'
            })
            const [strings1, ...values1] = result1;
            const [strings2, ...values2] = result2;

            deepEqual(strings1, ['\n                Hello: ', '\n            '], 'namespaced z.codec should not concat anything on static strings')
            deepEqual(values1, ['John'], 'namespaced z.codec decodes inline object input schemas with kargs and returns encoded value')

            deepEqual(strings2, ['\n                Hello: ', '\n            '], 'namespaced z.object should not concat anything on static strings')
            deepEqual(values2, ['John'], 'namespaced z.object decodes inline object input schemas with kargs and returns encoded value')

            deepEqual(strings1, strings2, 'namespaced z.codec / z.object().transform')
            deepEqual(values1, values2, 'namespaced z.codec / z.object().transform')

            throws(() => tpl1.render(null!), InterpolationError, 'should throw validation error')
            throws(() => tpl2.render(null!), InterpolationError, 'should throw validation error')
        })

        it('should validate against zod shape definition', () => {
            const userCard = zt.z({
                first: z.string(),
                last: z.string(),
                birtdate: z.date().optional(),
            })`
            Hello: ${e => `${e.first} ${e.last}`}
            Age: ${e => e.birtdate ? e.birtdate.getFullYear() : 'unknown birthdate'}
        `

            const result = userCard.render({
                first: 'John',
                last: 'Doe',
            })
            const [strings, ...values] = result;

            deepEqual(strings, ['\n            Hello: ', '\n            Age: ', '\n        '], 'should not concat anything on static strings')
            deepEqual(values, ['John Doe', 'unknown birthdate'], 'calls selector functions with given kargs and returns transformed values')

            const result2 = userCard.render({
                first: 'John',
                last: 'Doe',
                birtdate: new Date('01/01/2000'),
            })
            const [strings2, ...values2] = result2;

            deepEqual(strings, strings2, 'Different parameters should not change interpolation strings')
            deepEqual(values2, ['John Doe', 2000], 'should calls selector functions with given kargs and returns transformed values')

            // @ts-expect-error
            throws(() => userCard.render(null), InterpolationError, 'should throw validation error')
        })


        it('should merge keyword arguments when karg are present both at shape definition and inline arg', () => {
            const userCard = zt.z({
                first: z.string(),
                last: z.string(),
            })`
            Hello: ${e => `${e.first} ${e.last}`}

            ${zt.p('message', z.string(), msg => `You have a message: ${msg}`)}
        `

            const result = userCard.render({
                first: 'John',
                last: 'Doe',
                message: 'Message content'
            })
            const [strings, ...values] = result;

            deepEqual(strings, ['\n            Hello: ', '\n\n            ', '\n        '], 'should not concat anything on static strings')
            deepEqual(values, ['John Doe', 'You have a message: Message content'], 'calls selector functions with given kargs and returns transformed values')

            throws(() => userCard.render(
                // @ts-expect-error
                {
                    first: 'John',
                    last: 'Doe',
                }), InterpolationError, 'should throw validation error for inline karg')

            throws(() => userCard.render({
                // @ts-expect-error
                meessage: 'Message content'
            }), InterpolationError, 'should throw validation error for shape karg')
        })

    })
    describe('nested templates', () => {
        it('should merge nested templates', () => {
            const staticTpl = zt.t`Static text`
            const button = zt.t`<button>${zt.p('title', z.string())}</button>`
            const panel = zt.z({
                title: z.string(),
            })`
                <div>
                    <h3>${e => e.title}</h3>
                    <div>Button1: ${zt.p('button1', button)}</div>
                    <div>Button2: ${zt.p('button2', button)}</div>
                </div>
            `

            const nested1 = zt.t`
                ${staticTpl}
                Nested panel: ${panel}
                Nested button ${zt.p('nestedButton', button)}
            `

            const parentTemplate = zt.z({
                name: z.string(),
                id: z.uuid(),
            })`
                The parent template:
                name=${e => e.name}
                uuid=${e => e.id}

                ------
                ${nested1}
            `

            const result = parentTemplate.render({
                id: '30a1a449-4041-4c2b-89cf-8d386c4467b5',
                name: 'Name value',
                title: 'Panel title',
                button1: {
                    title: 'panel button1',
                },
                button2: {
                    title: 'panel button2',
                },
                nestedButton: {
                    title: 'nested button',
                },
            })
            const [strings, ...values] = result;


            deepEqual(strings, [
                '\n                The parent template:\n                name=',
                '\n                uuid=',
                '\n\n                ------\n                \n                Static text\n                Nested panel: \n                <div>\n                    <h3>',
                '</h3>\n                    <div>Button1: <button>',
                '</button></div>\n                    <div>Button2: <button>',
                '</button></div>\n                </div>\n            \n                Nested button <button>',
                '</button>\n            \n            '
            ], 'Interpolation splits strings correctly')

            deepEqual(values, [
                'Name value',
                '30a1a449-4041-4c2b-89cf-8d386c4467b5',
                'Panel title',
                'panel button1',
                'panel button2',
                'nested button'
            ], 'Interpolations values resolves to transformation values declared inside the template and nested templates')
        })
    })

    describe('utilities', () => {
        const tpl = zt.t`
            SELECT * FROM ${zt.unsafe(z.string().regex(/^\w+$/), 'TableName')}

            ${zt.p('orderBy', z.string().optional(), (orderBy => orderBy ? zt.t`ORDER BY ${orderBy} ASC` : zt.t``))}
            
            LIMIT ${10}
        `
        const result = tpl.render({})
        const [strings, ...values] = result;


        it('zt.unsafe utility dangerously sets a static string content inside the template', () => {
            deepEqual(strings, [
                '\n            SELECT * FROM TableName\n\n            \n            \n            LIMIT ',
                '\n        '
            ], 'Interpolation splits strings correctly')
            deepEqual(values, [10], 'Interpolations values resolves to transformation values declared inside the template')
        })

        it('zt.p utility creates a named param and allows conditional rendering', () => {
            const result2 = tpl.render({ orderBy: 'created_at' })
            const [strings2, ...values2] = result2;

            deepEqual(strings2, [
                '\n            SELECT * FROM TableName\n\n            ORDER BY ',
                ' ASC\n            \n            LIMIT ',
                '\n        '
            ], 'Interpolation splits strings correctly')

            deepEqual(values2, ['created_at', 10], 'Interpolations values resolves to transformation values declared inside the template')
        })

        describe('format utilities', () => {
            it('zt.$n utility formats interpolation as dolar index placeholders', () => {
                const result2 = tpl.render({ orderBy: 'created_at' })
                const placeholder = zt.$n(result2)

                deepEqual(
                    placeholder,
                    '\n            SELECT * FROM TableName\n\n            ORDER BY $0 ASC\n            \n            LIMIT $1\n        ',
                    'should join the interpolation with $n marked placeholders'
                )
            })

            it('zt.atIndex utility formats interpolation as @ index placeholders', () => {
                const result2 = tpl.render({ orderBy: 'created_at' })
                const placeholder = zt.atIndex(result2)

                deepEqual(
                    placeholder,
                    '\n            SELECT * FROM TableName\n\n            ORDER BY @0 ASC\n            \n            LIMIT @1\n        ',
                    'should join the interpolation with $n marked placeholders'
                )
            })

            it('zt.debug utility formats as String.raw would', () => {
                const result2 = tpl.render({ orderBy: 'created_at' })
                const placeholder = zt.debug(result2)

                deepEqual(
                    placeholder,
                    '\n            SELECT * FROM TableName\n\n            ORDER BY created_at ASC\n            \n            LIMIT 10\n        ',
                    'should join the interpolation with $n marked placeholders'
                )
            })
        })
    })

});