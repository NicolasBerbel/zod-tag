// algebraic-properties.type-test.ts
import { describe, it } from 'node:test';
import { ok } from 'node:assert/strict';
import z from 'zod';
import { zt, type IRenderable, type IRenderableKargs, type IRenderableOutput } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Helper types for readability
// ---------------------------------------------------------------------------
type KargsOf<T> = IRenderableKargs<T>;
type OutputOf<T> = IRenderableOutput<T>;

// ---------------------------------------------------------------------------
// Suite: Identity (zt.empty)
// ---------------------------------------------------------------------------
describe('zt.empty type identity', () => {
    const empty = zt.empty;

    it('is IRenderable<void, []>', () => {
        type EK = KargsOf<typeof empty>;
        type EO = OutputOf<typeof empty>;
        // Kargs must be void, output must be empty tuple
        const _k: EK = undefined;
        const _o: EO = [];
        // @ts-expect-error – output is not []
        const _bad: EO = ['a'];
        ok(true)
    });

    it('left identity: empty · T  ===  T  (preserves Kargs and Output)', () => {
        const tpl = zt.z({ a: z.number() })`${(e) => e.a}`;
        const left = zt.t`${zt.empty}${tpl}`;

        // Types must be assignable both ways
        const _sameKargs: KargsOf<typeof tpl> = null! as KargsOf<typeof left>;
        const _sameOutput: OutputOf<typeof tpl> = null! as OutputOf<typeof left>;
        const _backKargs: KargsOf<typeof left> = null! as KargsOf<typeof tpl>;
        const _backOutput: OutputOf<typeof left> = null! as OutputOf<typeof tpl>;
        ok(true)
    });

    it('right identity: T · empty  ===  T', () => {
        const tpl = zt.z({ b: z.string() })`${(e) => e.b}`;
        const right = zt.t`${tpl}${zt.empty}`;

        const _a1: KargsOf<typeof tpl> = null! as KargsOf<typeof right>;
        const _a2: OutputOf<typeof tpl> = null! as OutputOf<typeof right>;
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Bind removes kargs
// ---------------------------------------------------------------------------
describe('zt.bind types', () => {
    const base = zt.z({ name: z.string(), age: z.number() })`${e => e.name}, ${e => e.age}`;

    it('fully applied renderable is IRenderable<void, O>', () => {
        const bound = zt.bind(base, { name: 'X', age: 20 });
        type K = KargsOf<typeof bound>;
        type O = OutputOf<typeof bound>;
        const _kv: K = undefined;
        // @ts-expect-error – kargs should be void
        bound.render({});
        () => bound.render(); // OK

        const _o: O = ['X', 20];
        // @ts-expect-error – missing value
        const _bad: O = ['X'];
        ok(true)
    });

    it('bind of a bound renderable stays void', () => {
        const bound = zt.bind(base, { name: 'A', age: 1 });
        // @ts-expect-error bound expects void, but no schema no throw
        const boundAgain = zt.bind(bound, {});
        type K = KargsOf<typeof boundAgain>;
        const _vk: K = undefined;
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Map functorial types
// ---------------------------------------------------------------------------
describe('zt.map types', () => {
    const item = zt.z({ v: z.number() })`[${e => e.v}]`;

    it('map over empty list yields identity type', () => {
        const emptyMap = zt.map([], item, (x: number) => ({ v: x }));
        type K = KargsOf<typeof emptyMap>;
        type O = OutputOf<typeof emptyMap>;
        const _vk: K = undefined;
        const _vo: O = [];
        // @ts-expect-error – output is empty
        const _bad: O = [1];
        ok(true)
    });

    it('map with separator and 3 items merges outputs', () => {
        const list = zt.map(
            [1, 2, 3],
            item,
            (n) => ({ v: n }),
            zt.t`, `
        );
        type K = KargsOf<typeof list>;
        type O = OutputOf<typeof list>;
        const _vk: K = undefined; // bound, void
        const _o: O = [0, 0, 0];
        // @ts-expect-error – wrong amount
        const _bad: O = [0, 0, 0, 0];
        ok(true)
    });

    it('map with separator output and 3 items merges outputs with separator', () => {
        const list = zt.map(
            [1, 2, 3],
            item,
            (n) => ({ v: n }),
            zt.t`, ${'string'}`
        );
        type K = KargsOf<typeof list>;
        type O = OutputOf<typeof list>;
        const _vk: K = undefined; // bound, void
        const _o: O = [0, '', 0, '', 0];
        // @ts-expect-error – wrong amount
        const _bad: O = [0, 0, 0, 0];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Join monoid types
// ---------------------------------------------------------------------------
describe('zt.join types', () => {
    const a = zt.z({ x: z.number() })`X: ${e => e.x}`;
    const b = zt.z({ y: z.string() })`Y: ${e => e.y}`;

    it('join of two renderables merges kargs and concatenates outputs', () => {
        const joined = zt.join([a, b], zt.t`|`);
        type K = KargsOf<typeof joined>;
        const _k: K = { x: 1, y: 'yes' };
        // @ts-expect-error – missing 'y'
        () => joined.render({ x: 1 });
        // @ts-expect-error – missing 'x'
        () => joined.render({ y: 'yes' });

        type O = OutputOf<typeof joined>;
        const _o: O = [1, 'yes'];
        // @ts-expect-error – reversed order
        const _bad: O = ['yes', 1];
        ok(true)
    });

    it('join of empty list is identity type', () => {
        const joined = zt.join([], zt.t`,`);
        type K = KargsOf<typeof joined>;
        const _vk: K = undefined;
        const _vo: OutputOf<typeof joined> = [];
        ok(true)
    });

    it('join of single element preserves its types', () => {
        const single = zt.join([a], zt.t`,`);
        const _k: KargsOf<typeof single> = { x: 5 };
        const _o: OutputOf<typeof single> = [5];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Associativity type preservation
// ---------------------------------------------------------------------------
describe('Associativity of composition', () => {
    const a = zt.bind(zt.z({ a: z.string() })`${e => e.a}`, { a: 'A' });
    const b = zt.bind(zt.z({ b: z.string() })`${e => e.b}`, { b: 'B' });
    const c = zt.bind(zt.z({ c: z.string() })`${e => e.c}`, { c: 'C' });

    it('(a · b) · c  types equal  a · (b · c)', () => {
        const left = zt.t`${zt.t`${a}${b}`}${c}`;
        const right = zt.t`${a}${zt.t`${b}${c}`}`;
        // Type-level: both should be IRenderable<void, [string, string, string]>
        type L = KargsOf<typeof left>;
        type R = KargsOf<typeof right>;
        // Both void
        const _vl: L = undefined;
        const _vr: R = undefined;
        // Outputs assignable both ways
        const _o1: OutputOf<typeof left> = null! as OutputOf<typeof right>;
        const _o2: OutputOf<typeof right> = null! as OutputOf<typeof left>;
        // Also verify expected output length
        const _output: OutputOf<typeof left> = ['A', 'B', 'C'];
        // @ts-expect-error – not 4 elements
        const _badLen: OutputOf<typeof left> = ['A', 'B', 'C', 'D'];
        ok(true)
    });

    it('(a join b) join c  types equal  a join (b join c)', () => {
        const sep = zt.t`-`;
        const leftJoin = zt.join([zt.join([a, b], sep), c], sep);
        const rightJoin = zt.join([a, zt.join([b, c], sep)], sep);
        type LK = KargsOf<typeof leftJoin>;
        type RK = KargsOf<typeof rightJoin>;
        const _vl: LK = undefined;
        const _vr: RK = undefined;
        const _o1: OutputOf<typeof leftJoin> = null! as OutputOf<typeof rightJoin>;
        const _expected: OutputOf<typeof leftJoin> = ['A', 'B', 'C'];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Conditional identity types
// ---------------------------------------------------------------------------
describe('zt.if types', () => {
    const tpl = zt.z({ n: z.number() })`num: ${e => e.n}`;

    it('if(false, t) has void kargs and unionized output', () => {
        const result = zt.if(false, tpl);
        type K = KargsOf<typeof result>;
        const _vk: K = undefined;
        const _vo: OutputOf<typeof result> = [];
        // @ts-expect-error no output
        const _maybeNum: OutputOf<typeof result> = [42]
        ok(true)
    });

    it('if(true, bind(t, k)) has void kargs and correct output', () => {
        const bound = zt.bind(tpl, { n: 42 });
        const result = zt.if(true, bound);
        type K = KargsOf<typeof result>;
        const _vk: K = undefined;
        const _o: OutputOf<typeof result> = [42];
        // @ts-expect-error – expect number
        const _bad: OutputOf<typeof result> = [];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Opaque hides output types
// ---------------------------------------------------------------------------
describe('zt.opaque type erasure', () => {
    const orig = zt.z({ x: z.number() })`result: ${e => e.x}`;

    it('opaque renders type as IRenderable<K, []>', () => {
        const opq = zt.opaque(orig);
        type K = KargsOf<typeof opq>;
        const _k: K = { x: 7 }; // kargs preserved
        type O = OutputOf<typeof opq>;
        // Output should be empty tuple []
        const _vo: O = [];
        // @ts-expect-error – output no longer holds [number]
        const _bad: O = [7];
        ok(true)
    });
});

// ---------------------------------------------------------------------------
// Suite: Kargs intersection and merging (commutative)
// ---------------------------------------------------------------------------
describe('Kargs merge commutativity', () => {
    const a = zt.z({ a: z.number() })`A: ${e => e.a}`;
    const b = zt.z({ b: z.string() })`B: ${e => e.b}`;

    it('(a then b) merges same as (b then a)', () => {
        const ab = zt.t`${a}${b}`;
        const ba = zt.t`${b}${a}`;
        // Kargs must have both a and b
        type K_AB = KargsOf<typeof ab>;
        type K_BA = KargsOf<typeof ba>;
        // They should be assignable both ways
        const _1: K_AB = null! as K_BA;
        const _2: K_BA = null! as K_AB;
        // Both require the same object
        const _k: KargsOf<typeof ab> = { a: 1, b: 'x' };
        // @ts-expect-error – missing b
        () => ab.render({ a: 1 });
        ok(true)
    });

    it('output order follows template order', () => {
        const ab = zt.t`${a}${b}`;
        const ba = zt.t`${b}${a}`;
        const O_AB: OutputOf<typeof ab> = [1, 'x'];
        const O_BA: OutputOf<typeof ba> = ['x', 1];
        // @ts-expect-error – swapped order
        const _bad: OutputOf<typeof ab> = ['x', 1];
        // @ts-expect-error – swapped order
        const _bad2: OutputOf<typeof ba> = [1, 'x'];
        ok(true)
    });
});