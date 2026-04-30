// algebraic-properties.test.ts
import { describe, it } from 'node:test';
import { deepEqual, ok, throws } from 'node:assert/strict';
import z from 'zod';
import { zt, createRenderable } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const debug = (tpl: ReturnType<typeof zt.t>, kargs?: any) =>
    zt.debug(tpl.render(kargs ?? ({} as any)));

// ---------------------------------------------------------------------------
// Suite: Identity (zt.empty)
// ---------------------------------------------------------------------------
describe('Identity (zt.empty)', () => {
    const inner = zt.z({ name: z.string() })`Hello, ${(e) => e.name}!`;
    const bound = zt.bind(inner, { name: 'World' });

    it('empty · template == template (left identity)', () => {
        const left = zt.t`${zt.empty}${bound}`;
        deepEqual(left.render(), bound.render());
    });

    it('template · empty == template (right identity)', () => {
        const right = zt.t`${bound}${zt.empty}`;
        deepEqual(right.render(), bound.render());
    });

    it('empty renders to an empty string array', () => {
        deepEqual(zt.empty.render(), [['']]);
    });

    it('composing empty with a static template yields identical output', () => {
        const tpl = zt.t`static`;
        const composed = zt.t`${zt.empty}${tpl}${zt.empty}`;
        deepEqual(composed.render(), tpl.render());
    });
});

// ---------------------------------------------------------------------------
// Suite: Associativity
// ---------------------------------------------------------------------------
describe('Associativity', () => {
    const a = zt.bind(zt.z({ a: z.string() })`${(e) => e.a}`, { a: 'A' });
    const b = zt.bind(zt.z({ b: z.string() })`${(e) => e.b}`, { b: 'B' });
    const c = zt.bind(zt.z({ c: z.string() })`${(e) => e.c}`, { c: 'C' });

    it('(a · b) · c == a · (b · c) for concatenation via zt.t', () => {
        const left = zt.t`${zt.t`${a}${b}`}${c}`;
        const right = zt.t`${a}${zt.t`${b}${c}`}`;
        deepEqual(left.render(), right.render());
    });

    it('(a join b) join c == a join (b join c) using zt.join', () => {
        const sep = zt.t`-`;
        const left = zt.join([zt.join([a, b], sep), c], sep);
        const right = zt.join([a, zt.join([b, c], sep)], sep);
        deepEqual(left.render(), right.render());
    });
});

// ---------------------------------------------------------------------------
// Suite: Bind > render equivalence
// ---------------------------------------------------------------------------
describe('Bind · render law', () => {
    const tpl = zt.z({ x: z.number(), y: z.number() })`sum: ${(e) => e.x + e.y}`;
    const args = { x: 3, y: 4 };

    it('bind(t, k).render() == t.render(k)', () => {
        const bound = zt.bind(tpl, args);
        deepEqual(bound.render(), tpl.render(args));
    });

    it('bind with empty kargs still works', () => {
        const staticTpl = zt.t`no kargs`;
        const bound = zt.bind(staticTpl, undefined as any);
        deepEqual(bound.render(), staticTpl.render());
    });
});

// ---------------------------------------------------------------------------
// Suite: Map functorial properties
// ---------------------------------------------------------------------------
describe('Map properties', () => {
    const itemTpl = zt.z({ value: z.number() })`[${(e) => e.value}]`;
    const numbers = [1, 2, 3];

    it('empty list returns identity', () => {
        const result = zt.map([], itemTpl, (x: number) => ({ value: x }));
        deepEqual(result, zt.empty);
    });

    it('single item renders without separator', () => {
        const result = zt.map([42], itemTpl, (x) => ({ value: x }));
        deepEqual(result.render(), itemTpl.render({ value: 42 }));
    });

    it('map with identity mapFn produces join of individually bound items', () => {
        // The "identity" mapFn: (v) => v, meaning the item is already the kargs
        const list = zt.map(
            [{ value: 1 }, { value: 2 }, { value: 3 }],
            itemTpl,
            (x) => x,
            zt.t`, `
        );
        const joinVersion = zt.join(
            [
                zt.bind(itemTpl, { value: 1 }),
                zt.bind(itemTpl, { value: 2 }),
                zt.bind(itemTpl, { value: 3 }),
            ],
            zt.t`, `
        );
        deepEqual(list.render(), joinVersion.render());
    });

    it('map with separator is equivalent to join of references', () => {
        const sep = zt.t` | `;
        const mapped = zt.map(numbers, itemTpl, (n) => ({ value: n }), sep);
        const joined = zt.join(
            numbers.map((n) => zt.bind(itemTpl, { value: n })),
            sep
        );
        deepEqual(mapped.render(), joined.render());
    });
});

// ---------------------------------------------------------------------------
// Suite: Monoidal join properties
// ---------------------------------------------------------------------------
describe('Join monoidal properties', () => {
    const sep = zt.t`, `;

    it('join of empty list is zt.empty', () => {
        deepEqual(zt.join([], sep), zt.empty);
    });

    it('join of a single element list returns that element', () => {
        const elem = zt.bind(zt.z({ x: z.number() })`${(e) => e.x}`, { x: 99 });
        const single = zt.join([elem], sep);
        deepEqual(single.render(), elem.render());
    });

    it('join of list with default separator (identity) composes without gaps', () => {
        const a = zt.t`A`;
        const b = zt.t`B`;
        const joined = zt.join([a, b]);
        deepEqual(zt.debug(joined.render()), 'AB');
    });
});

// ---------------------------------------------------------------------------
// Suite: Conditional identity (zt.if)
// ---------------------------------------------------------------------------
describe('Conditional identity', () => {
    const tpl = zt.z({ n: z.number() })`Number: ${(e) => e.n}`;

    it('zt.if(false, t) is equivalent to zt.empty', () => {
        const result = zt.if(false, tpl);
        const composed = zt.t`before ${result} after`;
        deepEqual(composed.render(), [['before  after']]);
        const emptyComposed = zt.t`before ${zt.empty} after`;
        deepEqual(
            zt.t`before ${zt.if(false, zt.bind(tpl, { n: 0 }))} after`.render(),
            emptyComposed.render()
        );
    });

    it('zt.if(true, t) yields t', () => {
        const bound = zt.bind(tpl, { n: 42 });
        deepEqual(zt.if(true, bound).render(), bound.render());
    });
});

// ---------------------------------------------------------------------------
// Suite: Opaque is identity for runtime output
// ---------------------------------------------------------------------------
describe('Opaque runtime identity', () => {
    it('zt.opaque preserves the same rendered output', () => {
        const orig = zt.z({ x: z.number() })`x=${(e) => e.x}`;
        const opq = zt.opaque(orig);
        const args = { x: 7 };
        deepEqual(orig.render(args), opq.render(args));
    });

    it('opaque renderable can still be used in composition', () => {
        const inner = zt.t`hello`;
        const opq = zt.opaque(inner);
        const parent = zt.t`[${opq}]`;
        deepEqual(parent.render(), [['[hello]']]);
    });
});