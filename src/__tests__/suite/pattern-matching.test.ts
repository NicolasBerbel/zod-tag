import { describe, it } from 'node:test';
import { deepEqual, throws, doesNotThrow } from 'node:assert/strict';
import z from 'zod';
import { zt, InterpolationError } from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Suite: Basic discriminated routing
// ---------------------------------------------------------------------------
describe('zt.match - basic routing', () => {
  const actions = zt.match('action', {
    create: zt.z({ name: z.string(), email: z.email() })`INSERT ${(e) => e.name}`,
    update: zt.z({ id: z.uuid(), name: z.string() })`UPDATE ${(e) => e.name} WHERE id=${(e) => e.id}`,
    delete: zt.z({ id: z.uuid() })`DELETE WHERE id=${(e) => e.id}`,
  });

  it('routes to the correct branch based on discriminator', () => {
    const resCreate = actions.render({ action: 'create', name: 'Alice', email: 'a@b.com' });
    deepEqual(resCreate, [['INSERT ', ''], 'Alice']);

    const resUpdate = actions.render({ action: 'update', id: '550e8400-e29b-41d4-a716-446655440000', name: 'Bob' });
    deepEqual(resUpdate, [['UPDATE ', ' WHERE id=', ''], 'Bob', '550e8400-e29b-41d4-a716-446655440000']);

    const resDelete = actions.render({ action: 'delete', id: '550e8400-e29b-41d4-a716-446655440000' });
    deepEqual(resDelete, [['DELETE WHERE id=', ''], '550e8400-e29b-41d4-a716-446655440000']);
  });
});

// ---------------------------------------------------------------------------
// Suite: Loose schema - extra keys are allowed
// ---------------------------------------------------------------------------
describe('zt.match - loose schema allows extra keys', () => {
  const math = zt.match('op', {
    add: zt.z({ a: z.number(), b: z.number() })`${(e) => e.a + e.b}`,
    neg: zt.z({ x: z.number() })`${(e) => -e.x}`,
  });

  it('extra keys from another branch do not cause validation errors', () => {
    // Pass 'a' and 'b' (for add) plus an extra key 'x' from the neg branch
    doesNotThrow(() => {
      const res = math.render({ op: 'add', a: 10, b: 5, x: 99 } as any);
      deepEqual(res[1], 15);
    });
  });

  it('extra key not used by any branch is also allowed (loose)', () => {
    doesNotThrow(() => {
      const res = math.render({ op: 'add', a: 1, b: 2, extra: true } as any);
      deepEqual(res[1], 3);
    });
  });

  it('missing required key for selected branch still fails', () => {
    throws(
      () => math.render({ op: 'add', a: 1 } as any),
      InterpolationError,
    );
  });

  it('invalid discriminator value fails', () => {
    throws(
      () => math.render({ op: 'mul' } as any),
      InterpolationError,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Direct nesting of matches (now works with loose)
// ---------------------------------------------------------------------------
describe('zt.match - direct nesting', () => {
  const inner = zt.match('method', {
    cash: zt.z({ amount: z.number() })`PAID $${(e) => e.amount.toFixed(2)}`,
    card: zt.z({ amount: z.number(), last4: z.string().length(4) })`CHARGED $${(e) => e.amount.toFixed(2)} card ****${(e) => e.last4}`,
  });

  const payment = zt.match('status', {
    pending: zt.t`[AWAITING]`,
    paid: inner,
  });

  it('outer discriminator routes to pending', () => {
    const res = payment.render({ status: 'pending' });
    deepEqual(res, [['[AWAITING]']]);
  });

  it('outer discriminator routes to inner match (paid → cash)', () => {
    const res = payment.render({ status: 'paid', method: 'cash', amount: 49.99 } as any);
    deepEqual(res, [['PAID $', ''], '49.99']);
  });

  it('outer discriminator routes to inner match (paid → card) with extra last4', () => {
    const res = payment.render({
      status: 'paid',
      method: 'card',
      amount: 99.95,
      last4: '4242',
    } as any);
    deepEqual(res, [['CHARGED $', ' card ****', ''], '99.95', '4242']);
  });

  it('missing required key for inner branch fails', () => {
    throws(
      () => payment.render({ status: 'paid', method: 'card', amount: 10 } as any), // missing last4
      InterpolationError,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Match with branches of varying karg requirements
// ---------------------------------------------------------------------------
describe('zt.match - varying shapes', () => {
  const calc = zt.match('fn', {
    add: zt.z({ a: z.number(), b: z.number() })`${(e) => e.a + e.b}`,
    clamp: zt.z({ val: z.number(), min: z.number(), max: z.number() })`${(e) => Math.max(e.min, Math.min(e.max, e.val))}`,
    neg: zt.z({ x: z.number() })`${(e) => -e.x}`,
    abs: zt.z({ x: z.number() })`${(e) => Math.abs(e.x)}`,
    sqrt: zt.z({ x: z.number().min(0) })`${(e) => Math.sqrt(e.x)}`,
  });

  it('each branch uses only its own kargs', () => {
    const r1 = calc.render({ fn: 'add', a: 10, b: 20 });
    deepEqual(r1[1], 30);

    const r2 = calc.render({ fn: 'clamp', val: 500, min: 100, max: 200 });
    deepEqual(r2[1], 200);

    const r3 = calc.render({ fn: 'neg', x: 42 });
    deepEqual(r3[1], -42);

    const r4 = calc.render({ fn: 'sqrt', x: 144 });
    deepEqual(r4[1], 12);
  });

  it('validation still rejects branch-specific constraints', () => {
    throws(() => calc.render({ fn: 'sqrt', x: -1 }), InterpolationError);
  });

  it('branch-specific constraints are not applied to other branches', () => {
    // neg branch does not have min(0) constraint
    doesNotThrow(() => calc.render({ fn: 'neg', x: -10 }));
  });
});

// ---------------------------------------------------------------------------
// Suite: Match inside scoped parameters (zt.p)
// TODO: zt.match inside zt.p
// zt.p not properly scoping the renderable returned from zt.match
// ---------------------------------------------------------------------------
describe('zt.match inside zt.p', () => {
  const cityMatch = zt.match('type', {
    small: zt.z({ name: z.string() })`Small city: ${(e) => e.name}`,
    metro: zt.z({ name: z.string(), population: z.number() })`Metro: ${(e) => e.name} (pop ${(e) => e.population})`,
  });

  it('scoped match uses nested kargs', () => {
    const tpl = zt.t`City info: ${zt.p('city', cityMatch)}`;
    const res = tpl.render({ city: { type: 'small', name: 'Springfield' }});
    deepEqual(res, [['City info: Small city: ', ''], 'Springfield']);
  });

  it('scoped match with a more complex branch', () => {
    const tpl = zt.t`City info: ${zt.p('city', cityMatch)}`;
    const res = tpl.render({ city: { type: 'metro', name: 'Metropolis', population: 5_000_000 } });
    deepEqual(res, [['City info: Metro: ', ' (pop ', ')'], 'Metropolis', 5_000_000]);
  });

  it('scoped match validation failures propagate', () => {
    const tpl = zt.t`City info: ${zt.p('city', cityMatch)}`;
    throws(
      () => tpl.render({ city: { type: 'metro', name: 'Gotham' } } as any), // missing population
      InterpolationError,
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Match combined with zt.map, zt.join, zt.if
// ---------------------------------------------------------------------------
describe('zt.match with map/join/if', () => {
  const shape = zt.match('shape', {
    circle: zt.z({ radius: z.number() })`Circle(r=${(e) => e.radius})`,
    rect: zt.z({ w: z.number(), h: z.number() })`Rect(${(e) => e.w}x${(e) => e.h})`,
  });

  it('map over array of match inputs', () => {
    const items = [
      { shape: 'circle' as const, radius: 5 },
      { shape: 'rect' as const, w: 10, h: 20 },
      { shape: 'circle' as const, radius: 3 },
    ];
    const list = zt.map(items, shape, item => item as any, zt.t`, `);
    const res = list.render();
    deepEqual(zt.debug(res), 'Circle(r=5), Rect(10x20), Circle(r=3)');
  });

  it('join two match renderables', () => {
    const a = zt.match('type', {
      a: zt.t`A`,
      b: zt.t`B`,
    });
    const joined = zt.join([a, zt.bind(a, { type: 'b'})], zt.t`+`);
    const res = joined.render({ type: 'a' });
    deepEqual(res, [['A+B']]);
  });

  it('conditional branch returning match renderable', () => {
    const tpl = zt.z({ useMatch: z.boolean() })`${(e) => (e.useMatch ? shape : zt.t`NO MATCH`)}`;
    const res = tpl.render({ useMatch: true, shape: 'circle', radius: 7 } as any);
    deepEqual(res, [['Circle(r=', ')'], 7]);
  });
});

// ---------------------------------------------------------------------------
// Suite: Error handling and edge cases
// ---------------------------------------------------------------------------
describe('zt.match - error handling', () => {
  it('single branch match works', () => {
    const single = zt.match('type', {
      greet: zt.z({ name: z.string() })`Hello, ${(e) => e.name}!`,
    });
    const res = single.render({ type: 'greet', name: 'World' });
    deepEqual(res, [['Hello, ', '!'], 'World']);
  });

  it('discriminator must be present in kargs', () => {
    const m = zt.match('action', { go: zt.t`GO` });
    throws(() => m.render({} as any), InterpolationError);
  });
});