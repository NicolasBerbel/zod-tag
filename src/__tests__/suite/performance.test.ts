// performance.test.ts
import { describe, it } from 'node:test';
import { ok } from 'node:assert/strict';
import z from 'zod';
import { zt, createRenderable, type IRenderable } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Timing helper
// ---------------------------------------------------------------------------
const measure = (fn: () => unknown): number => {
    const t0 = performance.now();
    fn();
    return performance.now() - t0;
};

// ---------------------------------------------------------------------------
// Suite: Creation cost
// ---------------------------------------------------------------------------
describe('Creation performance', () => {
    const FAST = 10;      // ms for small-scale operations
    const REASONABLE = 50; // ms for medium-scale

    it(`creates 1000 tiny static renderables < ${FAST * 5}ms`, () => {
        const elapsed = measure(() => {
            for (let i = 0; i < 1000; i++) zt.t`hello`;
        });
        ok(elapsed < FAST * 5, `1000 static creations took ${elapsed}ms`);
    });

    it(`creates many tiny static renderables quickly (5000x < ${FAST * 5}ms)`, () => {
        const elapsed = measure(() => {
            for (let i = 0; i < 5000; i++) zt.t`hello`;
        });
        ok(elapsed < FAST * 5, `5000 static creations took ${elapsed}ms`);
    });

    it('creates renderables with many primitive values (flat, no nesting)', () => {
        const N = 1000;
        const strings = ['', ...Array(N - 1).fill(''), ''];
        // use createRenderable directly to avoid argument-spread overhead
        const vals = Array.from({ length: N }, (_, i) => `val-${i}`);
        const elapsed = measure(() => {
            createRenderable(strings, vals);
        });
        ok(elapsed < REASONABLE, `1000 primitives creation took ${elapsed}ms`);
    });

    it('creates deeply nested static renderables (100 levels) without explosion', () => {
        const elapsed = measure(() => {
            let tpl = zt.t`leaf`;
            for (let depth = 0; depth < 100; depth++) {
                tpl = zt.t`(${tpl})`;
            }
            // force pre-compilation by rendering once (creation automatically compiles)
            tpl.render();
        });
        ok(elapsed < REASONABLE, `100-level nest creation + compile took ${elapsed}ms`);
    });


    it('creates deeply nested dynamic renderables (100 levels) without explosion', () => {
        const elapsed = measure(() => {
            let tpl = zt.t`${() => zt.t`leaf`}`;
            for (let depth = 0; depth < 100; depth++) {
                tpl = zt.t`(${tpl})`;
            }
            // force pre-compilation by rendering once (creation automatically compiles)
            tpl.render();
        });
        ok(elapsed < REASONABLE, `100-level nest creation + compile took ${elapsed}ms`);
    });


    it(`zt.map over 250 items creates quickly (< ${REASONABLE}ms`, () => {
        const item = zt.z({ x: z.number() })`${(e) => e.x}`;
        const data = Array.from({ length: 250 }, (_, i) => ({ x: i }));
        const elapsed = measure(() => {
            zt.map(data, item, (d) => d, zt.t`, `);
        });
        ok(elapsed < REASONABLE, `zt.map 250 items creation took ${elapsed}ms`);
    });

    it(`zt.map over 250 items creates and render quickly (< ${REASONABLE}ms`, () => {
        const item = zt.z({ x: z.number() })`${(e) => e.x}`;
        const data = Array.from({ length: 250 }, (_, i) => ({ x: i }));
        const elapsed = measure(() => {
            zt.map(data, item, (d) => d, zt.t`, `).render();
        });
        ok(elapsed < REASONABLE, `zt.map 250 items creation took ${elapsed}ms`);
    });

    it(`zt.map over 500 items creates quickly (< ${REASONABLE}ms`, () => {
        const item = zt.z({ x: z.number() })`${(e) => e.x}`;
        const data = Array.from({ length: 500 }, (_, i) => ({ x: i }));
        const elapsed = measure(() => {
            zt.map(data, item, (d) => d, zt.t`, `);
        });
        ok(elapsed < REASONABLE, `zt.map 500 items creation took ${elapsed}ms`);
    });


    it(`zt.map over 500 items creates and render quickly (< ${REASONABLE * 2}ms`, () => {
        const item = zt.z({ x: z.number() })`${(e) => e.x}`;
        const data = Array.from({ length: 500 }, (_, i) => ({ x: i }));
        const elapsed = measure(() => {
            zt.map(data, item, (d) => d, zt.t`, `).render();
        });
        ok(elapsed < REASONABLE * 2, `zt.map 500 items creation took ${elapsed}ms`);
    });
});

// ---------------------------------------------------------------------------
// Suite: Rendering cost (pre-compilation benefit)
// ---------------------------------------------------------------------------
describe('Rendering performance', () => {
    const REASONABLE = 50;

    it('renders a large flat template with many primitive values quickly', () => {
        const N = 1000;
        const strings = ['', ...Array(N - 1).fill(''), ''];
        const vals = Array.from({ length: N }, (_, i) => `v${i}`);
        const tpl = createRenderable<void>(strings, vals);
        const elapsed = measure(() => tpl.render());
        ok(elapsed < REASONABLE, `render 1000 primitives took ${elapsed}ms`);
    });

    it('rendering pre-compiled nested structures is fast (flattened at creation)', () => {
        // build a nesting chain: depth = 6
        let inner = zt.z({ value: z.number() })`${(e) => e.value}`;
        for (let i = 0; i < 6; i++) {
            inner = zt.t`[${inner}]`;
        }
        // Now inner is fully compiled. Render 2000 times and check speed.
        const elapsed = measure(() => {
            for (let i = 0; i < 2000; i++) inner.render({ value: i });
        });
        // With pre-compilation the render of each call is O(total values), not O(tree traversal).
        ok(elapsed < REASONABLE * 5, `2000 renders of depth-6 took ${elapsed}ms`);
    });

    it('render performance scales roughly linearly with value count', () => {
        const sizes = [100, 500];
        const times = sizes.map((n) => {
            const strings = ['', ...Array(n - 1).fill(''), ''];
            const vals = Array.from({ length: n }, (_, i) => i);
            const tpl = createRenderable<void>(strings, vals);
            const elapsed = measure(() => {
                for (let i = 0; i < 100; i++) tpl.render();
            });
            return elapsed;
        });
        // Expect 500-value renders to be at most 7× slower than 100-value renders
        // (allowing some non-linearity from array copying, but not exponential).
        ok(times[1] / times[0] < 7, `non-linear scaling: ${sizes[1]}-value renders to be at most 7x slower than ${sizes[0]}-value renders - result = ${times[1] / times[0]}x`);
    });

    it('repeated renders are stable (no memory leak or degradation)', () => {
        const tpl = zt.z({ n: z.number() })`count: ${(e) => e.n}`;
        // throw away first run (JIT warm-up)
        tpl.render({ n: 1 });
        const runs = 2000;
        const elapsed = measure(() => {
            for (let i = 0; i < runs; i++) tpl.render({ n: i });
        });
        // If there were quadratic growth, 2000 runs would be dramatically slower.
        ok(elapsed < REASONABLE * 4, `2000 renders of small template took ${elapsed}ms`);
    });
});

// ---------------------------------------------------------------------------
// Suite: Large-data edge cases
// ---------------------------------------------------------------------------
describe('Large-data handling', () => {
    const GENEROUS = 300; // ms for heavy operations

    it('zt.join with 1000 renderables and separator completes', () => {
        const items = Array.from({ length: 1000 }, (_, i) =>
            zt.bind(zt.z({ x: z.number() })`${(e) => e.x}`, { x: i })
        );
        const sep = zt.t`, `;
        const createTime = measure(() => zt.join(items, sep));
        ok(createTime < GENEROUS, `join 1000 items creation took ${createTime}ms`);
        const tpl = zt.join(items, sep);
        const renderTime = measure(() => tpl.render());
        ok(renderTime < GENEROUS, `render join of 1000 items took ${renderTime}ms`);
    });

    it('zt.match with many branches (50) creates and renders quickly', () => {
        const branches: Record<string, IRenderable<{ val: number }, []>> = {};
        for (let i = 0; i < 50; i++) {
            (branches as any)[`action_${i}`] = zt.z({ val: z.number() })`${(e) => e.val}`;
        }
        let m: IRenderable<any, []>;
        const createTime = measure(() => {
            m = zt.match('action', branches);
        });
        ok(createTime < GENEROUS, `match 50 branches creation took ${createTime}ms`);
        const renderTime = measure(() => m.render({ action: 'action_49', val: 99 }));
        ok(renderTime < 50, `match render 50 branches took ${renderTime}ms`);
    });

    it('creates renderable with many scoped parameters (zt.p) without slowdown', () => {
        const paramCount = 200;
        const values: Record<string, number> = {};
        const holes: IRenderable<any, any>[] = [];
        for (let i = 0; i < paramCount; i++) {
            const key = `p${i}`;
            values[key] = i;
            holes.push(zt.p(key, z.number()));
        }
        const createTime = measure(() => zt.t`${holes[0]}`); // warm-up
        const elapsed = measure(() => {
            // Build a template with all params by flattening array of holes
            const allHoles = holes.map((h: any) => h);
            // Cannot directly pass array; use a proxy template that just joins them
            const inner = allHoles.reduce((acc: IRenderable<any, any>, h: IRenderable<any, any>) => zt.t`${acc}${h}`, zt.t``);
            inner.render(values);
        });
        ok(elapsed < GENEROUS, `200 zt.p params ${elapsed}ms`);
    });
});