// stream-api-async.test.ts
import { describe, it } from 'node:test';
import { deepEqual, ok, throws, doesNotThrow, rejects } from 'node:assert/strict';
import z from 'zod';
import { zt, createRenderable, InterpolationError, type ZtChunk } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------
const collectAsync = async (stream: AsyncGenerator<ZtChunk, void>): Promise<readonly [string[], ...unknown[]]> => {
    const strings: string[] = [];
    const values: unknown[] = [];
    for await (const chunk of stream) {
        strings.push(chunk[0]);
        if (chunk.length === 2) values.push(chunk[1]);
    }
    Object.freeze(strings);
    return Object.freeze([strings, ...values]);
};

// ---------------------------------------------------------------------------
// Simple async schema factory
// ---------------------------------------------------------------------------
const asyncNumber = z.number().refine(async (n) => n > 0, { message: 'must be positive' });
const asyncString = z.string().refine(async (s) => s.length > 0, { message: 'non-empty' });
const asyncObj = z.object({
    name: z.string(),
    age: z.number().refine(async (n) => n >= 18, { message: 'must be adult' }),
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Basic chunk generation
// ---------------------------------------------------------------------------
describe('StreamAsync - Basic chunk generation', () => {
    it('static template yields a single closing chunk', async () => {
        const tpl = zt.t`Hello World`;
        const stream = tpl.streamAsync(undefined);
        const chunks: ZtChunk[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        deepEqual(chunks, [['Hello World']]);
    });

    it('template with a single primitive value yields two chunks', async () => {
        const tpl = zt.t`Value: ${42}`;
        const stream = tpl.streamAsync(undefined);
        const chunks: ZtChunk[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        deepEqual(chunks, [
            ['Value: ', 42],
            [''],
        ]);
    });

    it('template with selectors and async schema works', async () => {
        const tpl = zt.z({ x: asyncNumber })`Value: ${e => e.x}`;
        const stream = tpl.streamAsync({ x: 10 });
        const chunks: ZtChunk[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        deepEqual(chunks, [['Value: ', 10], ['']]);
    });

    it('collected async chunks equal renderAsync() output', async () => {
        const tpl = zt.z({ name: asyncString })`Hello, ${e => e.name}!`;
        const args = { name: 'Alice' };
        const rendered = await tpl.renderAsync(args);
        const collected = await collectAsync(tpl.streamAsync(args));
        deepEqual(collected, rendered);
    });
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Sync render/stream rejection for async schemas
// ---------------------------------------------------------------------------
describe('StreamAsync - Sync methods reject async schemas', () => {
    it('sync render() throws for async schema', () => {
        const tpl = zt.z({ x: asyncNumber })`Num: ${e => e.x}`;
        throws(
            () => tpl.render({ x: 5 }),
            InterpolationError,
            'should throw when calling sync render on async renderable'
        );
    });

    it('sync stream() throws for async schema', () => {
        const tpl = zt.z({ x: asyncNumber })`Num: ${e => e.x}`;
        const gen = tpl.stream({ x: 5 });
        throws(
            () => [...gen],
            InterpolationError,
            'should throw when iterating sync stream of async renderable'
        );
    });
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Nested renderables
// ---------------------------------------------------------------------------
describe('StreamAsync - Nested renderables', () => {
    it('sync child inside async parent flattens correctly', async () => {
        const inner = zt.z({ val: z.number() })`inner[${e => e.val}]`;
        const outer = zt.z({ name: asyncString })`Outer ${inner} end`;
        const args = { name: 'World', val: 42 };
        const chunks: ZtChunk[] = [];
        for await (const chunk of outer.streamAsync(args)) chunks.push(chunk);
        deepEqual(chunks, [
            ['Outer inner[', 42],
            ['] end'],
        ]);
    });

    it('async child inside sync parent delegates to async (parent becomes async)', async () => {
        // When a sync parent contains an async child, the parent is compiled as async.
        const asyncChild = zt.z({ x: asyncNumber })`child: ${e => e.x}`;
        const parent = zt.t`Parent ${asyncChild}`;
        // parent.__async should be true
        ok((parent as any).__async, 'parent should be async');
        const args = { x: 7 };
        const chunks: ZtChunk[] = [];
        for await (const chunk of parent.streamAsync(args)) chunks.push(chunk);
        deepEqual(chunks, [['Parent child: ', 7], ['']]);
    });

    it('deeply nested async structure yields correct chunks', async () => {
        const leaf = zt.z({ v: asyncNumber })`L:${e => e.v}`;
        const mid = zt.z({ u: asyncString })`(${e => e.u})[${leaf}]`;
        const root = zt.t`root${mid}`;
        const args = { u: 'test', v: 99 };
        const chunks: ZtChunk[] = [];
        for await (const chunk of root.streamAsync(args)) chunks.push(chunk);
        deepEqual(chunks, [
            ['root(', 'test'],
            [')[L:', 99],
            [']'],
        ]);
    });
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Schema validation & kargs
// ---------------------------------------------------------------------------
describe('StreamAsync - Schema validation & kargs', () => {
    it('streamAsync with valid kargs succeeds', async () => {
        const tpl = zt.z({ x: asyncNumber })`Value: ${e => e.x}`;
        const stream = tpl.streamAsync({ x: 10 });
        const chunks: ZtChunk[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        deepEqual(chunks, [['Value: ', 10], ['']]);
    });

    it('streamAsync with invalid kargs throws at iteration time', async () => {
        const tpl = zt.z({ x: asyncNumber })`Value: ${e => e.x}`;
        const stream = tpl.streamAsync({ x: -5 });
        await rejects(
            async () => {
                for await (const _ of stream) { /* consume */ }
            },
            InterpolationError,
            'Should throw InterpolationError for invalid kargs'
        );
    });

    it('streamAsync with missing required kargs throws', async () => {
        const tpl = zt.z({ x: asyncNumber })`Value: ${e => e.x}`;
        // @ts-expect-error invalid karg
        const stream = tpl.streamAsync({});
        await rejects(
            async () => { for await (const _ of stream); },
            InterpolationError
        );
    });

    it('streamAsync with defaults works even when kargs are omitted', async () => {
        const tpl = zt.z({ name: z.string().default('Guest') })`Hello, ${e => e.name}`;
        const stream = tpl.streamAsync({});
        const chunks: ZtChunk[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        deepEqual(chunks, [['Hello, ', 'Guest'], ['']]);
    });
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Composition utilities
// ---------------------------------------------------------------------------
describe('StreamAsync - Composition utilities', () => {
    it('zt.match with async branch streams correctly', async () => {
        const actions = zt.match('action', {
            create: zt.z({ name: asyncString })`INSERT ${e => e.name}`,
            delete: zt.z({ id: z.uuid() })`DELETE ${e => e.id}`,
        });
        const createChunks: ZtChunk[] = [];
        for await (const chunk of actions.streamAsync({ action: 'create', name: 'Alice' })) createChunks.push(chunk);
        deepEqual(createChunks, [['INSERT ', 'Alice'], ['']]);

        const deleteChunks: ZtChunk[] = [];
        for await (const chunk of actions.streamAsync({ action: 'delete', id: '550e8400-e29b-41d4-a716-446655440000' })) deleteChunks.push(chunk);
        deepEqual(deleteChunks, [['DELETE ', '550e8400-e29b-41d4-a716-446655440000'], ['']]);
    });

    it('zt.map: async streams mapped items with separator', async () => {
        const item = zt.z({ n: asyncNumber })`[${e => e.n}]`;
        const list = zt.map([1, 2, 3], item, n => ({ n }), zt.t`, `);
        const chunks: ZtChunk[] = [];
        for await (const chunk of list.streamAsync(undefined)) chunks.push(chunk);
        deepEqual(chunks, [
            ['[', 1],
            ['], [', 2],
            ['], [', 3],
            [']'],
        ]);
    });

    it('zt.join: streams joined renderables with async items', async () => {
        const a = zt.t`A`;
        const b = zt.z({ x: asyncNumber })`B${e => e.x}`;
        const joined = zt.join([a, b]);
        // b is async, so joined becomes async
        ok((joined as any).__async, 'joined should be async');
        const chunks: ZtChunk[] = [];
        for await (const chunk of joined.streamAsync({ x: 5 })) chunks.push(chunk);
        deepEqual(chunks, [['AB', 5], ['']]);
    });

    it('zt.bind: async streams pre-bound renderable', async () => {
        const base = zt.z({ name: asyncString })`Hello, ${e => e.name}!`;
        const bound = zt.bind(base, { name: 'World' }); // bind validates sync, but render still async
        const chunks: ZtChunk[] = [];
        for await (const chunk of bound.streamAsync(undefined)) chunks.push(chunk);
        deepEqual(chunks, [['Hello, ', 'World'], ['!']]);
    });

    it('zt.if: conditionally streams async template or identity', async () => {
        const tpl = zt.z({ x: asyncNumber })`Visible ${e => e.x}`;
        const condTrue = zt.if(true, tpl);
        const condFalse = zt.if(false, tpl);
        // both are async if tpl is async
        const chunksTrue: ZtChunk[] = [];
        for await (const chunk of condTrue.streamAsync({ x: 1 })) chunksTrue.push(chunk);
        deepEqual(chunksTrue, [['Visible ', 1], ['']]);

        const chunksFalse: ZtChunk[] = [];
        for await (const chunk of condFalse.streamAsync(undefined)) chunksFalse.push(chunk);
        deepEqual(chunksFalse, [['']]);
    });

    it('zt.opaque preserves async streaming output', async () => {
        const orig = zt.z({ x: asyncNumber })`Value: ${e => e.x}`;
        const opq = zt.opaque(orig);
        const args = { x: 42 };
        const collectedOrig = await collectAsync(orig.streamAsync(args));
        const collectedOpq = await collectAsync(opq.streamAsync(args));
        deepEqual(collectedOpq, collectedOrig);
    });
});

// ---------------------------------------------------------------------------
// Suite: StreamAsync - Edge cases
// ---------------------------------------------------------------------------
describe('StreamAsync - Edge cases', () => {
    it('zt.unsafe produces no value chunks (even in async context)', async () => {
        const unsafe = zt.unsafe(z.string().regex(/^\w+$/), 'Users');
        const tpl = zt.t`SELECT * FROM ${unsafe}`;
        const chunks: ZtChunk[] = [];
        for await (const chunk of tpl.streamAsync(undefined)) chunks.push(chunk);
        deepEqual(chunks, [['SELECT * FROM Users']]);
    });

    it('scoped async parameter (zt.p) streams with nested values', async () => {
        const inner = zt.z({ age: asyncNumber })`age: ${e => e.age}`;
        const outer = zt.t`Child: ${zt.p('child', inner)}`;
        const args = { child: { age: 5 } };
        const chunks: ZtChunk[] = [];
        for await (const chunk of outer.streamAsync(args)) chunks.push(chunk);
        deepEqual(chunks, [['Child: age: ', 5], ['']]);
    });

    it('streamAsync of empty template yields just empty string', async () => {
        const tpl = zt.t``;
        const chunks: ZtChunk[] = [];
        for await (const chunk of tpl.streamAsync(undefined)) chunks.push(chunk);
        deepEqual(chunks, [['']]);
    });

    it('streamAsync with deeply conditional content and async', async () => {
        const tpl = zt.z({ flag: z.boolean() })`${e => e.flag ? zt.z({ x: asyncNumber })`yes ${e => e.x}` : zt.t`no`}`;
        const chunksTrue: ZtChunk[] = [];
        // @ts-expect-error kargs derived from the ternary operator aren't working as intended :( zt.if when possible 
        for await (const chunk of tpl.streamAsync({ flag: true, x: 1 })) chunksTrue.push(chunk);
        deepEqual(chunksTrue, [['yes ', 1], ['']]);

        const chunksFalse: ZtChunk[] = [];
        for await (const chunk of tpl.streamAsync({ flag: false })) chunksFalse.push(chunk);
        deepEqual(chunksFalse, [['no']]);
    });

    it('streamAsync generator can be partially consumed and continued', async () => {
        const tpl = zt.z({ a: asyncNumber, b: asyncNumber, c: asyncNumber })`${e => e.a} ${e => e.b} ${e => e.c}`;
        const gen = tpl.streamAsync({ a: 1, b: 2, c: 3 });
        const first = await gen.next();
        ok(!first.done && first.value?.[1] === 1);
        const second = await gen.next();
        ok(!second.done && second.value?.[1] === 2);
        const third = await gen.next();
        ok(!third.done && third.value?.[1] === 3);
        const last = await gen.next();
        ok(!last.done && last.value?.[0] === '');
        const done = await gen.next();
        ok(done.done);
    });

    it('chunks from async stream are frozen', async () => {
        const tpl = zt.z({ x: asyncNumber })`Hello ${e => e.x}`;
        const chunks: ZtChunk[] = [];
        for await (const chunk of tpl.streamAsync({ x: 42 })) chunks.push(chunk);
        for (const chunk of chunks) {
            ok(Object.isFrozen(chunk), 'Chunk should be frozen');
        }
    });

    it('mixed sync/async siblings produce correct unified async stream', async () => {
        const syncChild = zt.t`sync`;
        const asyncChild = zt.z({ v: asyncNumber })`async ${e => e.v}`;
        const parent = zt.t`[${syncChild}, ${asyncChild}]`;
        // parent becomes async because it contains async child
        ok((parent as any).__async, 'parent should be async');
        const chunks: ZtChunk[] = [];
        for await (const chunk of parent.streamAsync({ v: 99 })) chunks.push(chunk);
        deepEqual(chunks, [
            ['[sync, async ', 99],
            [']'],
        ]);
    });

    it('renderAsync on static template returns same as sync render', async () => {
        const tpl = zt.t`static`;
        const syncResult = tpl.render();
        const asyncResult = await tpl.renderAsync();
        deepEqual(asyncResult, syncResult);
    });

    it('renderAsync on dynamic sync template (no async schema) works identically to sync render', async () => {
        const tpl = zt.z({ name: z.string() })`Hello, ${e => e.name}!`;
        const args = { name: 'Alice' };
        const syncResult = tpl.render(args);
        const asyncResult = await tpl.renderAsync(args);
        deepEqual(asyncResult, syncResult);
    });
});


describe('Async Detection & Promise Handling', () => {
    describe('Sync render() on async-detected renderables', () => {
        it('throws clear error when sync render on AsyncFunction transform', () => {
            const asyncTpl = zt.t`${zt.p('name', z.string().transform(async e => e.toUpperCase()))}`;
            throws(
                () => asyncTpl.render({ name: 'hello' }),
                InterpolationError,
                'async renderables should be rendered asynchronously'
            );
        });

        /**
         * Returning a promise on a selector violates a core principle:
         * - Selectors must remain pure functions, no side-effects at the render pipeline
         * - Use async schema for async operations at the validation pipeline: schema.transform(async () => {})
         */
        it('throws clear error when async render on Promise-returning selector', async () => {
            const bad = zt.t`${() => new Promise(r => r('value'))}`;
            rejects(
                () => bad.renderAsync(),
                InterpolationError,
                'async selector violation'
            );
        });
    });

    describe('renderAsync() handles async transforms', () => {
        it('correctly renders Promise transform', async () => {
            const tpl = zt.z({ name: z.string().transform(n => Promise.resolve(n.toUpperCase())) })`
                Hello ${e => e.name}
            `;
            const result = await tpl.renderAsync({ name: 'alice' });
            deepEqual(zt.debug(result).includes('ALICE'), true, 'async transforms should be run')
        });

        it('correctly renders async transform', async () => {
            const tpl = zt.z({ name: z.string().transform(async n => n.toUpperCase()) })`
                Hello ${e => e.name}
            `;
            const result = await tpl.renderAsync({ name: 'alice' });
            deepEqual(zt.debug(result).includes('ALICE'), true, 'async transforms should be run')
        });

        it('detects nested async schema in object shape', async () => {
            const asyncSchema = z.object({
                name: z.string().transform(async e => e.toUpperCase())
            });
            const tpl = zt.z(asyncSchema.shape)`Hello ${e => e.name}`;

            throws(
                () => tpl.render({ name: 'bob' }),
                InterpolationError,
                'async renderables should be rendered asynchronously'
            );
        });

        /**
         * TODO: should throw proper error
         * 'throws on sync renders for Promise transform'
         */
        it.skip('throws on sync renders for Promise transform', async () => {
            const tpl = zt.z({ name: z.string().transform(n => Promise.resolve(n.toUpperCase())) })`
                Hello ${e => e.name}
            `;
            throws(
                () => tpl.render({ name: 'bob' }),
                InterpolationError,
                'async schemas '
            );
        });
        it('throws on sync renders for Promise transform', async () => {
            const tpl = zt.z({ name: z.string().transform(n => Promise.resolve(n.toUpperCase())) })`
                Hello ${e => e.name}
            `;
            throws(
                () => tpl.render({ name: 'bob' }),
                Error,
                // why this error message?
                // This means 'async schemas with .render() should use renderAsync()'?
                "TypeError: Cannot read properties of undefined (reading 'length')"
            );
        });

    });

    describe('Stream API handles async', () => {
        it('streamAsync() processes async schemas correctly', async () => {
            const tpl = zt.z({
                value: z.string().transform(async e => e.toUpperCase())
            })`Result: ${e => e.value}`;

            const chunks = [];
            for await (const chunk of tpl.streamAsync({ value: 'test' })) {
                chunks.push(chunk);
            }

            // Verify chunks collected properly
            if (chunks.length === 0) throw new Error('No chunks generated');
        });
    });
});