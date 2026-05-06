// schema-strategies.test.ts
import { describe, it } from 'node:test';
import { deepEqual, throws, doesNotThrow } from 'node:assert/strict';
import z from 'zod';
import { zt, InterpolationError } from '../../../dist/main.js';

// Helper
const render = (tpl: any, kargs: any) => (tpl as any).render(kargs) as [string[], ...unknown[]];
const debug = (tpl: any, kargs?: any) => zt.debug(tpl.render(kargs));

describe('Schema Strategies (strict/strip/loose)', () => {
    // ------------------------------------------------------------------
    // Basic usage of zt.z.strict, zt.z.strip, zt.z (default loose)
    // ------------------------------------------------------------------
    describe('zt.z.strict', () => {
        const template = zt.z.strict({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;

        it('rejects extra top-level keys', () => {
            throws(
                // @ts-expect-error 'extra' does not exist in type
                () => template.render({ name: 'Alice', extra: 42 }),
                InterpolationError,
            );
        });

        it('allows required keys and produces correct output', () => {
            const [strs, ...vals] = template.render({ name: 'Bob' });
            deepEqual(strs, ['Hello ', '!']);
            deepEqual(vals, ['Bob']);
        });

        it('rejects missing required keys', () => {
            throws(
                // @ts-expect-error '{}' is not assignable to parameter of type
                () => template.render({}),
                InterpolationError,
            );
        });
    });

    describe('zt.z.strip', () => {
        const template = zt.z.strip({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;

        it('strips extra keys silently', () => {
            // @ts-expect-error 'extra' does not exist in type
            const [strs, ...vals] = template.render({ name: 'Bob', extra: 42 });
            deepEqual(strs, ['Hello ', '!']);
            deepEqual(vals, ['Bob']);
            // No error, but extra does not appear anywhere
        });

        it('required keys still work', () => {
            const result = template.render({ name: 'Alice' });
            deepEqual(result[0], ['Hello ', '!']);
            deepEqual(result[1], 'Alice');
        });
    });

    describe('zt.z (default loose)', () => {
        const template = zt.z({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;

        it('allows extra keys', () => {
            doesNotThrow(() => {
                // @ts-expect-error 'extra' does not exist in type
                const result = template.render({ name: 'Bob', extra: true });
                deepEqual(result[0], ['Hello ', '!']);
                deepEqual(result[1], 'Bob');
            });
        });
    });

    // ------------------------------------------------------------------
    // Interaction with zt.p (scoped composition)
    // ------------------------------------------------------------------
    describe('with zt.p (scoped)', () => {
        it('strict parent does not interfere with scoped child', () => {
            // scoped child has its own loose schema (by default)
            const view = zt.z({ title: z.string() })`Title: ${(e: { title: string }) => e.title}`;
            const strictParent = zt.z.strict({})`Content: ${zt.p('section', view)}`;

            // Should work: top-level has no extra keys, section is an object.
            const result = strictParent.render({
                // @ts-expect-error 'extra' does not exist in type
                section: { title: 'Hello', extra: true },
            });
            const [strs, ...vals] = result;
            deepEqual(strs, ['Content: Title: ', '']);
            deepEqual(vals, ['Hello']); // extra inside scoped child is allowed (loose child)
        });

        it('strict scoped child rejects extra keys within its scope', () => {
            const strictView = zt.z.strict({ title: z.string() })`Title: ${(e: { title: string }) => e.title}`;
            const looseParent = zt.z({})`Content: ${zt.p('section', strictView)}`;
            throws(
                () => looseParent.render({
                    // @ts-expect-error 'extra' does not exist in type
                    section: { title: 'Hello', extra: 42 },
                }),
                InterpolationError,
            );
        });

        it('strip scoped child removes extra keys silently', () => {
            const stripView = zt.z.strip({ title: z.string() })`Title: ${(e: { title: string }) => e.title}`;
            const parent = zt.z({})`Content: ${zt.p('section', stripView)}`;
            const [strs, ...vals] = parent.render({
                // @ts-expect-error 'unwanted' does not exist in type
                section: { title: 'World', unwanted: true },
            });
            deepEqual(strs, ['Content: Title: ', '']);
            deepEqual(vals, ['World']);
        });
    });

    // ------------------------------------------------------------------
    // Unscoped composition – parent strategy dominates
    // ------------------------------------------------------------------
    describe('unscoped composition', () => {
        it('strict parent rejects extra keys even if child is loose', () => {
            const looseChild = zt.z({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;
            // Unscoped: child's shape is merged into the parent's flat shape.
            const strictParent = zt.z.strict({})`Prefix ${looseChild}`;

            throws(
                // @ts-expect-error true is not assignable to never
                () => strictParent.render({ name: 'Bob', extra: true }),
                InterpolationError,
            );
        });

        it('strip parent strips extra keys from unscoped child', () => {
            const looseChild = zt.z({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;
            const stripParent = zt.z.strip({})`Prefix ${looseChild}`;
            // @ts-expect-error string is not assignable to never
            const result = stripParent.render({ name: 'Bob', extra: 'gone' });
            deepEqual(result[0], ['Prefix Hello ', '!']);
            deepEqual(result[1], 'Bob');
        });

        it('loose parent allows extra keys from unscoped child', () => {
            const looseChild = zt.z.strict({ name: z.string() })`Hello ${(e: { name: string }) => e.name}!`;
            const looseParent = zt.z({})`Prefix ${looseChild}`;
            // @ts-expect-error string is not assignable to never
            const result = looseParent.render({ name: 'Bob', extra: 'ok' });
            deepEqual(result[0], ['Prefix Hello ', '!']);
            deepEqual(result[1], 'Bob');
        });
    });
});

describe('Advanced Schema Strategies', () => {
    // =========================================================================
    // 1. Scoped composition - child retains its own strategy inside the scope
    // =========================================================================
    describe('scoped composition (zt.p)', () => {
        const looseChild = zt.z({ a: z.number() })`a=${(e: { a: number }) => e.a}`;
        const strictChild = zt.z.strict({ a: z.number() })`a=${(e: { a: number }) => e.a}`;
        const stripChild = zt.z.strip({ a: z.number() })`a=${(e: { a: number }) => e.a}`;

        it('strict parent - loose scoped child allows extra keys within scope', () => {
            const tpl = zt.z.strict({})`${zt.p('child', looseChild)}`;
            const [strs, ...vals] = render(tpl, { child: { a: 1, extra: 'ok' } });
            deepEqual(strs, ['a=', '']);
            deepEqual(vals, [1]);
        });

        it('strict parent - strict scoped child rejects extra keys within scope', () => {
            const tpl = zt.z.strict({})`${zt.p('child', strictChild)}`;
            throws(
                () => render(tpl, { child: { a: 1, extra: 'nope' } }),
                InterpolationError,
            );
        });

        it('loose parent - strict scoped child still rejects extra keys inside scope', () => {
            const tpl = zt.z({})`${zt.p('child', strictChild)}`;
            throws(
                () => render(tpl, { child: { a: 1, extra: 'nope' } }),
                InterpolationError,
            );
        });

        it('strip parent - scoped child with strip strategy removes extra keys inside scope', () => {
            const tpl = zt.z.strip({})`${zt.p('child', stripChild)}`;
            const [strs, ...vals] = render(tpl, { child: { a: 2, extra: 'strip-me' } });
            deepEqual(strs, ['a=', '']);
            deepEqual(vals, [2]);
        });
    });

    // =========================================================================
    // 2. Unscoped composition - parent strategy rules flattened shape
    // =========================================================================
    describe('unscoped composition (direct nesting)', () => {
        const baseChild = zt.z({ name: z.string() })`Hello ${(e: { name: string }) => e.name}`;

        it('strict parent rejects extra keys even if child is loose', () => {
            const tpl = zt.z.strict({})`${baseChild}`;
            throws(
                () => render(tpl, { name: 'Alice', extra: true }),
                InterpolationError,
            );
        });

        it('strip parent strips extra keys from unscoped child', () => {
            const tpl = zt.z.strip({})`${baseChild}`;
            const [strs, ...vals] = render(tpl, { name: 'Bob', extra: 'stripped' });
            deepEqual(strs, ['Hello ', '']);
            deepEqual(vals, ['Bob']);
        });

        it('loose parent allows extra keys from unscoped strict child', () => {
            const strictChild = zt.z.strict({ name: z.string() })`Hello ${(e: { name: string }) => e.name}`;
            const tpl = zt.z({})`${strictChild}`;
            const [strs, ...vals] = render(tpl, { name: 'Carol', extra: 'allowed' });
            deepEqual(strs, ['Hello ', '']);
            deepEqual(vals, ['Carol']);
        });

        it('strict parent with two merged children - merged shape must be satisfied without extras', () => {
            const childA = zt.z({ a: z.number() })`A=${(e: { a: number }) => e.a}`;
            const childB = zt.z({ b: z.string() })`B=${(e: { b: string }) => e.b}`;
            const tpl = zt.z.strict({})`${childA} ${childB}`;

            throws(() => render(tpl, { a: 1, b: 'x', extra: 'no' }), InterpolationError);
            const [strs, ...vals] = render(tpl, { a: 1, b: 'x' });
            deepEqual(strs, ['A=', ' B=', '']);
            deepEqual(vals, [1, 'x']);
        });
    });

    // =========================================================================
    // 3. Dynamic selectors / conditionals – strictness enforces closed, compile-time shape
    // =========================================================================
    describe('dynamic selectors', () => {
        it('strict parent rejects extra key from dynamic selector because shape is not known at compile time', () => {
            const tpl = zt.z.strict({ branch: z.enum(['a', 'b']) })`
                ${(e: { branch: 'a' | 'b' }) =>
                    e.branch === 'a'
                        ? zt.z({ extra: z.string() })`Extra: ${(e2: { extra: string }) => e2.extra}`
                        : zt.empty
                }
            `;
            // 'extra' is introduced by a dynamic selector → not merged at compile time.
            // Strict parent therefore rejects it.
            throws(
                () => render(tpl, { branch: 'a', extra: 'hello' }),
                InterpolationError,
            );
        });

        it('loose parent allows dynamic extra keys from selector', () => {
            const hiddenRenderable = zt.z({ dynamicKey: z.number() })`val=${(e: { dynamicKey: number }) => e.dynamicKey}`;
            const tpl = zt.z({ useDynamic: z.boolean() })`
                ${(e: { useDynamic: boolean }) => (e.useDynamic ? hiddenRenderable : zt.empty)}
            `;
            const [strs, ...vals] = render(tpl, { useDynamic: true, dynamicKey: 10, another: 'extra' });
            deepEqual(strs, ['\n                val=', '\n            ']);
            deepEqual(vals, [10]); // loose allows dynamicKey to be present
        });

        it('strip parent silently removes dynamic keys not in compile-time shape', () => {
            const hiddenRenderable = zt.z({ dynamicKey: z.number() })`val=${(e: { dynamicKey: number }) => e.dynamicKey}`;
            const tpl = zt.z.strip({ useDynamic: z.boolean() })`
                ${(e: { useDynamic: boolean }) => (e.useDynamic ? hiddenRenderable : zt.empty)}
            `;
            // 'dynamicKey' is not in the compile-time shape, so strip removes it.
            // The selector then receives kargs without 'dynamicKey', causing the child to fail validation.
            throws(
                () => render(tpl, { useDynamic: true, dynamicKey: 10 }),
                InterpolationError,
            );
        });

        it('dynamic keys work only when the parent is loose', () => {
            const hiddenRenderable = zt.z({ dynamicKey: z.number() })`val=${(e: { dynamicKey: number }) => e.dynamicKey}`;
            const tpl = zt.z({ useDynamic: z.boolean() })`
                ${(e: { useDynamic: boolean }) => (e.useDynamic ? hiddenRenderable : zt.empty)}
            `;
            // Only loose parent accepts dynamicKey.
            doesNotThrow(() => render(tpl, { useDynamic: true, dynamicKey: 10 }));
        });
    });

    // =========================================================================
    // 4. Default values and optional keys
    // =========================================================================
    describe('defaults and optionals', () => {
        it('strict parent applies default and does not consider missing key an extra', () => {
            const tpl = zt.z.strict({ name: z.string().default('unknown') })`Name: ${(e: { name: string }) => e.name}`;
            const [strs, ...vals] = render(tpl, {});
            deepEqual(strs, ['Name: ', '']);
            deepEqual(vals, ['unknown']);
        });

        it('strict parent allows optional key to be absent', () => {
            const tpl = zt.z.strict({ name: z.string(), age: z.number().optional() })`${(e: { name: string; age?: number }) => `${e.name} age ${e.age ?? 'unknown'}`}`;
            const [strs, ...vals] = render(tpl, { name: 'Dave' });
            deepEqual(strs, ['', '']);
            deepEqual(vals, ['Dave age unknown']);
            // no extra key error
        });

        it('strict parent rejects truly unknown extra key', () => {
            const tpl = zt.z.strict({ name: z.string() })`${(e: { name: string }) => e.name}`;
            throws(
                () => render(tpl, { name: 'Eve', extra: 'nope' }),
                InterpolationError,
            );
        });
    });

    // =========================================================================
    // 5. Composition of multiple strategies in a tree
    // =========================================================================
    describe('mixed strategy nesting', () => {
        it('strict root - scoped child loose - nested unscoped child loose inside scoped', () => {
            // root: strict, scoped: loose, inside scoped: another nested loose
            const inner = zt.z({ x: z.number() })`x=${(e: { x: number }) => e.x}`;
            const scoped = zt.z({})`[${inner}]`; // loose
            const root = zt.z.strict({})`R:${zt.p('block', scoped)}`;
            const [strs, ...vals] = render(root, { block: { x: 5, extra: 'ok' } });
            deepEqual(strs, ['R:[x=', ']']);
            deepEqual(vals, [5]);
        });

        it('strict root - scoped child strict - extra in scope rejected', () => {
            const inner = zt.z.strict({ x: z.number() })`x=${(e: { x: number }) => e.x}`;
            const scoped = zt.z.strict({})`[${inner}]`;
            const root = zt.z.strict({})`R:${zt.p('block', scoped)}`;
            throws(
                () => render(root, { block: { x: 1, extra: 'no' } }),
                InterpolationError,
            );
        });

        it('chain of strict scopes - all extra keys rejected cascade', () => {
            const leaf = zt.z.strict({ val: z.number() })`val=${(e: { val: number }) => e.val}`;
            const mid = zt.z.strict({})`(${zt.p('inner', leaf)})`;
            const top = zt.z.strict({})`TOP:${zt.p('mid', mid)}`;
            throws(
                () => render(top, { mid: { inner: { val: 1, extra: 'fail' } } }),
                InterpolationError,
            );
        });
    });
});
