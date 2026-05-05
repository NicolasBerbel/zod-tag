import { describe, it } from 'node:test';
import { ok } from 'node:assert/strict';
import z from 'zod';
import { zt } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// GC helpers – tests are silently skipped when --expose-gc is not used
// ---------------------------------------------------------------------------
const gc = (globalThis as any).gc as (() => void) | undefined;
const hasGC = typeof gc === 'function';
const runIfGC = hasGC ? it : it.skip;

const forceCollect = () => {
    if (gc) gc();
};

const heapUsed = () => process.memoryUsage().heapUsed;

const measureHeapDelta = (fn: () => void): number => {
    forceCollect();
    const before = heapUsed();
    fn();
    forceCollect();
    const after = heapUsed();
    return after - before;
};

const MB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

const SMALL = .5 * 1024 * 1024;      // 0.5 MB
const REASONABLE = 2.5 * 1024 * 1024;  // 2,5 MB

// ---------------------------------------------------------------------------
// Suite: Memory footprint
// ---------------------------------------------------------------------------
describe('Memory footprint', () => {

    runIfGC('creating 10k static renderables uses bounded memory', () => {
        const delta = measureHeapDelta(() => {
            for (let i = 0; i < 10_000; i++) {
                zt.t`static-${i}`;
            }
        });
        console.log(`'creating 10k static renderables uses bounded memory': delta ${(delta)} B`)
        ok(delta < SMALL, `delta ${(delta)} B`);
    });

    runIfGC('rendering the same template repeatedly does not leak memory', () => {
        const tpl = zt.z({ n: z.number() })`value: ${(e) => e.n}`;
        // warm‑up and tenured space
        for (let i = 0; i < 100; i++) tpl.render({ n: i });
        forceCollect();
        const delta = measureHeapDelta(() => {
            for (let i = 0; i < 10_000; i++) tpl.render({ n: i });
        });
        console.log(`'rendering the same template repeatedly does not leak memory': delta ${(delta)} B`)
        ok(delta < SMALL * 2, `10k renders delta ${(delta)} B`);
    });

    runIfGC('large flat template with 10k values uses memory proportional to output size', () => {
        const N = 10_000;
        const strings = ['', ...Array(N - 1).fill(''), ''];
        const vals = Array.from({ length: N }, (_, i) => `value-${i}`);
        // build from individual renderables to mimic real construction
        const tpl = zt.join(
            vals.map((v) => zt.t`${v}`),
            zt.t``
        );
        forceCollect();
        const before = heapUsed();
        const result = tpl.render();
        forceCollect();
        const after = heapUsed();
        const growth = after - before;
        console.log(`'large flat template with 10k values uses memory proportional to output size': growth ${(growth)} B`)
        ok(growth < REASONABLE, `memory growth ${(growth)} B`);
        ok(result.length === N + 1, `unexpected result length ${result.length}`);
    });

});