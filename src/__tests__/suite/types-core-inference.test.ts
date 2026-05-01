import { describe, it } from 'node:test';
import z from 'zod';
import {
    zt,
    type IRenderableKargs,
    type IRenderableOutput,
} from '../../../dist/main.js';
import { ok } from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Suite: Core type inference (zt.t)
// ---------------------------------------------------------------------------
describe('zt.t type inference', () => {
    it('static template infers void kargs and empty output', () => {
        const staticTpl = zt.t`Hello World`;
        // @ts-expect-error – void kargs should be callable with {} argument?
        staticTpl.render({});
        // Should accept void call
        () => staticTpl.render();

        // IRenderableKargs<typeof staticTpl> should be void
        type StaticKargs = IRenderableKargs<typeof staticTpl>;
        const _voidKargs: StaticKargs = undefined; // void allows undefined

        type StaticOutput = IRenderableOutput<typeof staticTpl>;
        const _emptyOutput: StaticOutput = []; // output []

        ok(true)
    });

    it('primitives infer void kargs with output tuple', () => {
        const tpl = zt.t`${1}, ${'a'}, ${true}`;
        // @ts-expect-error – void kargs
        () => tpl.render({});
        tpl.render();

        type Kargs = IRenderableKargs<typeof tpl>;
        const _v: Kargs = undefined;

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [1, 'a', true];
        // @ts-expect-error – wrong output order
        const _bad: Output = ['a', 1, true];
        ok(true)
    });

    it('selector returning primitive infers void kargs', () => {
        const tpl = zt.t`${() => 42}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _v: Kargs = undefined;
        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [42];
        ok(true)
    });

    it('zt.p with schema infers named karg and output', () => {
        const tpl = zt.t`Hello, ${zt.p('name', z.string())}!`;
        type Kargs = IRenderableKargs<typeof tpl>;
        // Should require { name: string }
        const _k: Kargs = { name: 'Alice' };
        // @ts-expect-error – missing 'name'
        () => tpl.render({});
        // @ts-expect-error – 'name' must be string
        () => tpl.render({ name: 123 });

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = ['Alice']; // output is [string]
        ok(true)
    });

    it('zt.p with schema + transform infers transformed output type', () => {
        const tpl = zt.t`${zt.p('num', z.number(), n => n.toFixed(1))}`;
        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = ['42.0'];
        // @ts-expect-error – output is string, not number
        const _bad: Output = [42];
        ok(true)
    });

    it('multiple zt.p merge kargs and output order', () => {
        const tpl = zt.t`A: ${zt.p('a', z.string())}, B: ${zt.p('b', z.number())}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = { a: 'x', b: 1 };
        // @ts-expect-error – missing 'b'
        () => tpl.render({ a: 'x' });

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = ['x', 1];
        // @ts-expect-error – wrong order
        const _bad: Output = [1, 'x'];
        ok(true)
    });

    it('inline zod object schema infers kargs from its input', () => {
        const tpl = zt.t`Count: ${z.object({ count: z.number() })}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = { count: 42 };
        // @ts-expect-error – 'count' must be number
        () => tpl.render({ count: '42' });

        // Output is the same as input (object schema output = input)
        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [{ count: 42 }];
        ok(true)
    });

    it('inline z.codec infers output from decode', () => {
        const codec = z.codec(z.object({ email: z.email() }), z.string(), {
            encode: v => ({ email: v }),
            decode: v => v.email,
        });
        const tpl = zt.t`Email: ${codec}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = { email: 'test@test.com' };

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = ['test@test.com'];
        // @ts-expect-error – output is string, not object
        const _bad: Output = [{ email: 'test@test.com' }];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.z (schema shape) type inference
// ---------------------------------------------------------------------------
describe('zt.z type inference', () => {
    it('shape kargs are intersected with inline values', () => {
        const tpl = zt.z({ id: z.uuid(), name: z.string() })`User: ${e => e.name} (${zt.p('age', z.number())})`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Alice',
            age: 30,
        };
        // @ts-expect-error – missing 'age'
        () => tpl.render({ id: '...', name: 'Alice' });
        () => tpl.render({ id: 'bad-but-string', name: 'Alice', age: 30 });

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = ['Alice', 30]; // selector output then zt.p output
        ok(true)
    });

    it('shape only, no holes → kargs is shape input', () => {
        const tpl = zt.z({ x: z.number() })`constant`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = { x: 1 };
        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = []; // no outputs
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.p with renderable (scoping)
// ---------------------------------------------------------------------------
describe('zt.p with renderable', () => {
    const child = zt.z({ a: z.number(), b: z.string() })`(${e => e.a}, ${e => e.b})`;

    it('scoped renderable infers parent kargs with nested shape', () => {
        const tpl = zt.t`Child: ${zt.p('child', child)}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = {
            child: { a: 1, b: 'hello' },
        };
        // @ts-expect-error – missing 'child'
        () => tpl.render({});
        // @ts-expect-error – nested key missing
        () => tpl.render({ child: { a: 1 } });

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [1, 'hello'];
        ok(true)
    });

    it('multiple scoped renderables merge kargs separately', () => {
        const tpl = zt.t`A: ${zt.p('a', child)}, B: ${zt.p('b', child)}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = {
            a: { a: 1, b: 'foo' },
            b: { a: 2, b: 'bar' },
        };
        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [1, 'foo', 2, 'bar'];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: nested renderable composition types
// ---------------------------------------------------------------------------
describe('nested renderable type inference', () => {
    const inner = zt.z({ n: z.number() })`[${e => e.n}]`;
    const outer = zt.t`out ${inner}`;

    it('outer infers merged kargs from nested', () => {
        type Kargs = IRenderableKargs<typeof outer>;
        const _k: Kargs = { n: 5 };
        type Output = IRenderableOutput<typeof outer>;
        const _o: Output = [5]; // output from inner selector
        ok(true)
    });

    it('two nested renderables merge shapes', () => {
        const a = zt.z({ x: z.number() })`X${e => e.x}`;
        const b = zt.z({ y: z.string() })`Y${e => e.y}`;
        const tpl = zt.t`${a} | ${b}`;
        type Kargs = IRenderableKargs<typeof tpl>;
        const _k: Kargs = { x: 1, y: 'two' };
        // @ts-expect-error – either karg missing
        () => tpl.render({ x: 1 });
        // @ts-expect-error – either karg missing
        () => tpl.render({ y: 'two' });

        type Output = IRenderableOutput<typeof tpl>;
        const _o: Output = [1, 'two'];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: bind type inference
// ---------------------------------------------------------------------------
describe('zt.bind types', () => {
    const base = zt.z({ name: z.string(), age: z.number() })`${e => e.name} is ${e => e.age}`;

    it('bind removes kargs', () => {
        const bound = zt.bind(base, { name: 'Alice', age: 30 });
        type Kargs = IRenderableKargs<typeof bound>;
        // Kargs should be void
        const _v: Kargs = undefined;
        // @ts-expect-error – bound render takes no arguments
        bound.render({});

        () => bound.render();

        type Output = IRenderableOutput<typeof bound>;
        const _o: Output = ['Alice', 30];
        ok(true)
    });

    it('partially bound is not directly possible, but bind then compose', () => {
        // If only partial kargs, zod validation fails at bind time.
        // @ts-expect-error – incomplete kargs for the schema
        () => zt.bind(base, { name: 'Alice' });
        ({ age }: { age: number }) => zt.bind(base, { name: 'Alice', age });
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: map type inference
// ---------------------------------------------------------------------------
describe('zt.map types', () => {
    const itemTpl = zt.z({ v: z.number() })`[${e => e.v}]`;

    it('list mapped with transform infers output tuple of renderable', () => {
        const list = zt.map(
            [1, 2, 3],
            itemTpl,
            (n) => ({ v: n }),
            zt.t`, `
        );
        type Kargs = IRenderableKargs<typeof list>;
        // All bound, so void
        const _v: Kargs = undefined;
        type Output = IRenderableOutput<typeof list>;

        const _o: Output = [1, 2, 3];
        // @ts-expect-error – output is [number, number, number]
        const _bad: Output = [1, 2, 3, 4];
        ok(true)
    });

    it('list mapped with transform and separator with kargs infers kargs and output tuple of renderable and separator', () => {
        const list = zt.map(
            [1, 2, 3],
            itemTpl,
            (n) => ({ v: n }),
            zt.z({ name: z.string() })`, ${e => e.name}`
        );
        type Kargs = IRenderableKargs<typeof list>;
        // All template is bound, so only separator arguments
        const _v: Kargs = { name: 'string' };
        type Output = IRenderableOutput<typeof list>;

        const _o: Output = [0, '', 0, '', 0];
        // @ts-expect-error – output is not with separator output
        const _bad: Output = [0, 0, 0];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: join type inference
// ---------------------------------------------------------------------------
describe('zt.join types', () => {
    it('join of renderables merges kargs and outputs', () => {
        const a = zt.z({ x: z.number() })`${e => e.x}`;
        const b = zt.z({ y: z.string() })`${e => e.y}`;
        const joined = zt.join([a, b], zt.t`, `);
        type Kargs = IRenderableKargs<typeof joined>;
        const _k: Kargs = { x: 1, y: 'hello' };
        // @ts-expect-error – missing y
        () => joined.render({ x: 1 });

        type Output = IRenderableOutput<typeof joined>;
        const _o: Output = [1, 'hello'];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: match discriminated union types
// ---------------------------------------------------------------------------
describe('zt.match types', () => {
    const math = zt.match('op', {
        add: zt.z({ a: z.number(), b: z.number() })`${e => e.a + e.b}`,
        neg: zt.z({ x: z.number() })`${e => -e.x}`,
    });

    it('inferred kargs is union of possible kargs + discriminator', () => {
        type Kargs = IRenderableKargs<typeof math>;
        // { op: 'add', a: number, b: number } | { op: 'neg', x: number }
        const _add: Kargs = { op: 'add', a: 1, b: 2 };
        const _neg: Kargs = { op: 'neg', x: 1 };

        // @ts-expect-error – missing required 'a' for 'add'
        () => math.render({ op: 'add', x: 1 });
        // @ts-expect-error – wrong discriminator value
        () => math.render({ op: 'mul' });

        type Output = IRenderableOutput<typeof math>;
        const _o: Output = [3];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: if conditional type inference
// ---------------------------------------------------------------------------
describe('zt.if types', () => {
    const condTpl = zt.z({ name: z.string() })`${e => e.name}`;

    it('if(false, t) returns void kargs, output (union with empty?)', () => {
        const result = zt.if(false, condTpl);
        type Kargs = IRenderableKargs<typeof result>;
        const _v: Kargs = undefined;
        () => result.render();

        type Output = IRenderableOutput<typeof result>;
        const _o: Output = [];

        // @ts-expect-error Output is [] – can't assign [string] directly.
        const bad: Output = ['string'];
        ok(true)
    });

    it('if(true, t) behaves like t', () => {
        const result = zt.if(true, zt.bind(condTpl, { name: 'Alice' }));
        type Kargs = IRenderableKargs<typeof result>;
        // bound? Actually we bound it, so void.
        const _v: Kargs = undefined;
        type Output = IRenderableOutput<typeof result>;
        const _o: Output = ['Alice'];

        // @ts-expect-error Output is [string] – can't assign [] directly.
        const bad: Output = [];
        ok(true)
    });
});