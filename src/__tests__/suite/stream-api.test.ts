// stream-api.test.ts
import { describe, it } from 'node:test';
import { deepEqual, ok, throws, doesNotThrow } from 'node:assert/strict';
import z from 'zod';
import { zt, createRenderable, InterpolationError, type ZtChunk } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Helper: collect chunks into the same shape as render() returns
// ---------------------------------------------------------------------------
const collect = (stream: Generator<ZtChunk, void>): readonly [string[], ...unknown[]] => {
    const strings: string[] = [];
    const values: unknown[] = [];
    for (const chunk of stream) {
        strings.push(chunk[0]);
        if (chunk.length === 2) values.push(chunk[1]);
    }
    Object.freeze(strings);
    return Object.freeze([strings, ...values]) as any;
};

// ---------------------------------------------------------------------------
// Suite: Stream API - basic chunk generation
// ---------------------------------------------------------------------------
describe('Stream API - Basic chunk generation', () => {
    it('static template yields a single closing chunk', () => {
        const tpl = zt.t`Hello World`;
        const stream = tpl.stream(undefined);
        const chunks = [...stream];
        deepEqual(chunks, [['Hello World']]);
    });

    it('template with a single primitive value yields two chunks', () => {
        const tpl = zt.t`Value: ${42}`;
        const stream = tpl.stream(undefined);
        const chunks = [...stream];
        deepEqual(chunks, [
            ['Value: ', 42],
            ['']
        ]);
    });

    it('template with multiple values produces correct chunk sequence', () => {
        const tpl = zt.t`A ${1} B ${'x'} C`;
        const stream = tpl.stream(undefined);
        const chunks = [...stream];
        deepEqual(chunks, [
            ['A ', 1],
            [' B ', 'x'],
            [' C']
        ]);
    });

    it('adjacent values create empty string boundaries', () => {
        const tpl = zt.t`${1}${2}`;
        const stream = tpl.stream(undefined);
        const chunks = [...stream];
        deepEqual(chunks, [
            ['', 1],
            ['', 2],
            ['']
        ]);
    });

    it('identity (zt.empty) yields a single empty string chunk', () => {
        const stream = zt.empty.stream(undefined);
        const chunks = [...stream];
        deepEqual(chunks, [['']]);
    });

    it('collected chunks equal render() output', () => {
        const tpl = zt.z({ name: z.string() })`Hello, ${(e) => e.name}!`;
        const args = { name: 'Alice' };
        deepEqual(
            collect(tpl.stream(args)),
            tpl.render(args)
        );
    });
});

// ---------------------------------------------------------------------------
// Suite: Stream API - nested renderables
// ---------------------------------------------------------------------------
describe('Stream API - Nested renderables', () => {
    it('flattens nested renderable correctly', () => {
        const inner = zt.z({ val: z.number() })`inner[${e => e.val}]`;
        const outer = zt.t`Outer ${inner} end`;
        const args = { val: 42 };
        const chunks = [...outer.stream(args)];
        deepEqual(chunks, [
            ['Outer inner[', 42],
            ['] end']
        ]);
    });

    it('deeply nested structure yields correct chunks', () => {
        const leaf = zt.z({ v: z.number() })`L:${e => e.v}`;
        const mid = zt.z({ u: z.string() })`(${e => e.u})[${leaf}]`;
        const root = zt.t`root${mid}`;
        const args = { u: 'test', v: 99 };
        const chunks = [...root.stream(args)];
        deepEqual(chunks, [
            ['root(', 'test'],
            [')[L:', 99],
            [']']
        ]);
    });

    it('collected nested chunks equal render() output', () => {
        const inner = zt.z({ age: z.number() })`age: ${e => e.age}`;
        const outer = zt.t`User ${inner}`;
        const args = { age: 30 };
        deepEqual(
            collect(outer.stream(args)),
            outer.render(args)
        );
    });
});

// ---------------------------------------------------------------------------
// Suite: Stream API - Schema validation & kargs
// ---------------------------------------------------------------------------
describe('Stream API - Schema validation & kargs', () => {
    it('stream with valid kargs succeeds', () => {
        const tpl = zt.z({ x: z.number() })`Value: ${e => e.x}`;
        const stream = tpl.stream({ x: 10 });
        const chunks = [...stream];
        deepEqual(chunks, [['Value: ', 10], ['']]);
    });

    it('stream with invalid kargs throws at iteration time', () => {
        const tpl = zt.z({ x: z.number() })`Value: ${e => e.x}`;
        const stream = tpl.stream({ x: 'wrong' } as any);
        throws(
            () => [...stream],
            InterpolationError,
            'Should throw InterpolationError for invalid kargs'
        );
    });

    it('stream with missing required kargs throws', () => {
        const tpl = zt.z({ x: z.number() })`Value: ${e => e.x}`;
        const stream = tpl.stream({} as any);
        throws(
            () => [...stream],
            InterpolationError
        );
    });

    it('stream with defaults works even when kargs are omitted', () => {
        const tpl = zt.z({ name: z.string().default('Guest') })`Hello, ${e => e.name}`;
        const stream = tpl.stream({});
        const chunks = [...stream];
        deepEqual(chunks, [['Hello, ', 'Guest'], ['']]);
    });
});

// ---------------------------------------------------------------------------
// Suite: Stream API - Composition utilities
// ---------------------------------------------------------------------------
describe('Stream API - Composition utilities', () => {
    it('zt.match: branches stream correctly', () => {
        const actions = zt.match('action', {
            create: zt.z({ name: z.string() })`INSERT ${e => e.name}`,
            delete: zt.z({ id: z.uuid() })`DELETE ${e => e.id}`
        });
        const createChunks = [...actions.stream({ action: 'create', name: 'Alice' })];
        deepEqual(createChunks, [['INSERT ', 'Alice'], ['']]);

        const deleteChunks = [...actions.stream({ action: 'delete', id: '550e8400-e29b-41d4-a716-446655440000' })];
        deepEqual(deleteChunks, [['DELETE ', '550e8400-e29b-41d4-a716-446655440000'], ['']]);
    });

    it('zt.map: streams mapped items with separator', () => {
        const item = zt.z({ n: z.number() })`[${e => e.n}]`;
        const list = zt.map([1, 2, 3], item, n => ({ n }), zt.t`, `);
        const chunks = [...list.stream(undefined)];
        deepEqual(chunks, [
            ['[', 1],
            ['], [', 2],
            ['], [', 3],
            [']']
        ]);
    });

    it('zt.join: streams joined renderables', () => {
        const a = zt.t`A`;
        const b = zt.t`B`;
        const joined = zt.join([a, b]);
        const chunks = [...joined.stream(undefined)];
        deepEqual(chunks, [['AB']]);
    });

    it('zt.bind: streams pre-bound renderable', () => {
        const base = zt.z({ name: z.string() })`Hello, ${e => e.name}!`;
        const bound = zt.bind(base, { name: 'World' });
        const chunks = [...bound.stream(undefined)];
        deepEqual(chunks, [['Hello, ', 'World'], ['!']]);
    });

    it('zt.if: conditionally streams template or identity', () => {
        const tpl = zt.t`Visible`;
        const condTrue = zt.if(true, tpl);
        const condFalse = zt.if(false, tpl);
        deepEqual([...condTrue.stream(undefined)], [['Visible']]);
        deepEqual([...condFalse.stream(undefined)], [['']]);
    });

    it('zt.opaque preserves streaming output', () => {
        const orig = zt.z({ x: z.number() })`Value: ${e => e.x}`;
        const opq = zt.opaque(orig);
        const args = { x: 42 };
        deepEqual(
            collect(opq.stream(args)),
            collect(orig.stream(args))
        );
    });
});

// ---------------------------------------------------------------------------
// Suite: Stream API - Edge cases
// ---------------------------------------------------------------------------
describe('Stream API - Edge cases', () => {
    it('zt.unsafe produces no value chunks', () => {
        const unsafe = zt.unsafe(z.string().regex(/^\w+$/), 'Users');
        const tpl = zt.t`SELECT * FROM ${unsafe}`;
        const chunks = [...tpl.stream(undefined)];
        deepEqual(chunks, [['SELECT * FROM Users']]);
    });

    it('scoped parameter (zt.p) streams with nested values', () => {
        const inner = zt.z({ age: z.number() })`age: ${e => e.age}`;
        const outer = zt.t`Child: ${zt.p('child', inner)}`;
        const args = { child: { age: 5 } };
        const chunks = [...outer.stream(args)];
        deepEqual(chunks, [['Child: age: ', 5], ['']]);
    });

    it('stream of empty template yields just empty string', () => {
        const tpl = zt.t``;
        const chunks = [...tpl.stream(undefined)];
        deepEqual(chunks, [['']]);
    });

    it('stream with deeply conditional content', () => {
        const tpl = zt.z({ flag: z.boolean() })`${e => e.flag ? zt.t`yes` : zt.t`no`}`;
        deepEqual([...tpl.stream({ flag: true })], [['yes']]);
        deepEqual([...tpl.stream({ flag: false })], [['no']]);
    });

    it('stream generator can be partially consumed and continued', () => {
        const tpl = zt.t`${1} ${2} ${3}`;
        const gen = tpl.stream(undefined);
        const first = gen.next();
        ok(!first.done && first.value?.[1] === 1);
        const second = gen.next();
        ok(!second.done && second.value?.[1] === 2);
        const third = gen.next();
        ok(!third.done && third.value?.[1] === 3);
        const last = gen.next();
        ok(!last.done && last.value?.[0] === '');
        const done = gen.next();
        ok(done.done);
    });

    it('chunks are frozen', () => {
        const tpl = zt.t`Hello ${42}`;
        const chunks = [...tpl.stream(undefined)];
        for (const chunk of chunks) {
            ok(Object.isFrozen(chunk), 'Chunk should be frozen');
        }
    });
});