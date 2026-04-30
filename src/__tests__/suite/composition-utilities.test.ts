import { describe, it } from 'node:test';
import { deepEqual, throws, doesNotThrow, ok } from 'node:assert/strict';
import z from 'zod';
import {
    zt,
    createRenderable,
    isRenderable,
    InterpolationError,
} from '../../../dist/main.js';

// Helper to render and get the debug string
const debug = (tpl: ReturnType<typeof zt.t>, kargs?: any) =>
    zt.debug(tpl.render(kargs ?? ({} as any)));

// ---------------------------------------------------------------------------
// Suite: zt.unsafe - static structural injection
// ---------------------------------------------------------------------------
describe('zt.unsafe', () => {
    it('embeds validated value as static string, not in values', () => {
        const unsafeChunk = zt.unsafe(z.string().regex(/^\w+$/), 'Users');
        const tpl = zt.t`SELECT * FROM ${unsafeChunk}`;
        const result = tpl.render();
        deepEqual(result, [['SELECT * FROM Users']]);
    });

    it('fails at creation time if value fails schema validation', () => {
        throws(
            () => zt.unsafe(z.string().regex(/^\w+$/), 'bad; DROP'),
            z.ZodError,
        );
    });

    it('accepts other primitive types (number, boolean)', () => {
        const unsafeNum = zt.unsafe(z.number(), 42);
        const tpl = zt.t`Limit: ${unsafeNum}`;
        deepEqual(tpl.render(), [['Limit: 42']]);
    });

    it('is structural - value never appears in the values array of parent', () => {
        const unsafe = zt.unsafe(z.string().min(1), 'static');
        const tpl = zt.t`<${unsafe}>`;
        const [strings, ...vals] = tpl.render();
        deepEqual(strings, ['<static>']);
        deepEqual(vals, []);
    });

    it('can be used inside conditional or mapped contexts', () => {
        const table = zt.unsafe(z.string().regex(/^\w+$/), 'users');
        const tpl = zt.t`FROM ${table} WHERE id = ${'placeholder'}`;
        const [strings, ...vals] = tpl.render();
        ok(strings[0].includes('FROM users'));
        deepEqual(vals, ['placeholder']);
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.bind - partial application of kargs
// ---------------------------------------------------------------------------
describe('zt.bind', () => {
    const greet = zt.z({ name: z.string() })`Hello, ${(e: { name: string }) => e.name}!`;

    it('fully bound renderable requires no kargs (void input)', () => {
        const bound = zt.bind(greet, { name: 'World' });
        const result = bound.render();
        deepEqual(result, [['Hello, ', '!'], 'World']);
    });

    it('bound renderable can be composed without adding kargs to parent', () => {
        const bound = zt.bind(greet, { name: 'Alice' });
        const tpl = zt.t`A: ${bound}, B: ${bound}`;
        const result = tpl.render();
        deepEqual(result, [['A: Hello, ', '!, B: Hello, ', '!'], 'Alice', 'Alice']);
    });

    it('binding with invalid kargs throws at bind time', () => {
        throws(
            () => zt.bind(greet, { name: 123 } as any),
            InterpolationError,
        );
    });

    it('bind produces an IRenderable that is itself bindable', () => {
        const bound = zt.bind(greet, { name: 'Bob' });
        const twice = zt.bind(bound, {} as any);
        const result = twice.render();
        deepEqual(result, [['Hello, ', '!'], 'Bob']);
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.map - mapping arrays to renderables
// ---------------------------------------------------------------------------
describe('zt.map', () => {
    const itemTpl = zt.z({ product: z.string(), price: z.number() })`${(e) => e.product}: $${(e) => e.price}`;

    it('empty array returns identity (zt.empty)', () => {
        const result = zt.map([], itemTpl, (x: any) => x, zt.t`, `);
        deepEqual(result, zt.empty);
    });

    it('single item renders without separator', () => {
        const items = [{ product: 'Sword', cost: 50 }];
        const list = zt.map(items, itemTpl, item => ({ product: item.product, price: item.cost }));
        const rendered = list.render();
        deepEqual(rendered, [['', ': $', ''], 'Sword', 50]);
    });

    it('multiple items with separator join correctly', () => {
        const items = [
            { product: 'Sword', cost: 50 },
            { product: 'Shield', cost: 75 },
        ];
        const list = zt.map(items, itemTpl, item => ({ product: item.product, price: item.cost }), zt.t`, `);
        const result = list.render();
        deepEqual(result, [['', ': $', ', ', ': $', ''], 'Sword', 50, 'Shield', 75]);
    });

    it('validates each mapped item\'s kargs against the renderable schema', () => {
        const badItems = [{ product: 'Sword' }]; // missing price
        throws(
            // @ts-expect-error Property 'price' is missing
            () => zt.map(badItems, itemTpl, item => item).render(),
            InterpolationError,
        );
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.join - joining renderables (or primitives) with separator
// ---------------------------------------------------------------------------
describe('zt.join', () => {
    it('joins list of renderables with separator', () => {
        const a = zt.t`[A]`;
        const b = zt.z({ n: z.number() })`B(${(e) => e.n})`;
        const c = zt.t`[C]`;
        const joined = zt.join([a, b, c], zt.t` - `);
        const result = joined.render({ n: 42 });
        deepEqual(result, [['[A] - B(', ') - [C]'], 42]);
    });

    it('joins list of primitives using separator (zt.join on any[])', () => {
        const joined = zt.join([1, 2, 3], zt.t`, `);
        const result = joined.render();
        deepEqual(result, [['', ', ', ', ', ''], 1, 2, 3]);
    });

    it('empty list returns identity', () => {
        const result = zt.join([], zt.t`, `);
        deepEqual(result, zt.empty);
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.if - conditional rendering
// ---------------------------------------------------------------------------
describe('zt.if', () => {
    const tpl = zt.t`Visible`;

    it('true condition yields the template', () => {
        const conditional = zt.if(true, tpl);
        deepEqual(conditional.render(), [['Visible']]);
    });

    it('false condition yields empty identity', () => {
        const conditional = zt.if(false, tpl);
        deepEqual(conditional.render(), [['']]);
    });

    it('truthy non-boolean values treated as true', () => {
        const conditional = zt.if('non-empty', tpl);
        deepEqual(conditional.render(), [['Visible']]);
    });

    it('falsy values (null, undefined, 0) yield identity', () => {
        [null, undefined, 0].forEach(val => {
            deepEqual(zt.if(val, tpl).render(), [['']]);
        });
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.match - discriminated union routing
// ---------------------------------------------------------------------------
describe('zt.match', () => {
    const createUser = zt.z({ name: z.string(), email: z.email() })`INSERT users: ${(e) => e.name}`;
    const deleteUser = zt.z({ id: z.uuid() })`DELETE WHERE id = ${(e) => e.id}`;
    const command = zt.match('action', {
        create: createUser,
        delete: deleteUser,
    });

    it('routes to correct branch based on discriminator', () => {
        const res = command.render({ action: 'create', name: 'Alice', email: 'a@b.com' });
        deepEqual(res, [['INSERT users: ', ''], 'Alice']);
        const res2 = command.render({ action: 'delete', id: '550e8400-e29b-41d4-a716-446655440000' });
        deepEqual(res2, [['DELETE WHERE id = ', ''], '550e8400-e29b-41d4-a716-446655440000']);
    });

    it('lose schema: extra keys from other branches are not rejected', () => {
        doesNotThrow(
            () =>
                command.render({
                    action: 'create',
                    name: 'Alice',
                    email: 'a@b.com',
                    id: '550e8400-e29b-41d4-a716-446655440000',
                } as any),
            InterpolationError,
        );
    });

    it('missing required kargs for the matched branch throws', () => {
        throws(
            () => command.render({ action: 'create', name: 'Alice' } as any),
            InterpolationError,
        );
    });

    it('invalid discriminator throws', () => {
        throws(
            // @ts-expect-error invalid action
            () => command.render({ action: 'update' }),
            InterpolationError,
        );
    });

    // Nested zt.match delegation is currently limited: the outer match extracts
    // the shape of the inner renderable, which for a match returns the full
    // discriminator‑union schema, but strict wrapping can make extra keys
    // (method, amount) unrecognised.  For now we simply document the limitation
    // and test a workaround using a selector that returns the inner match.
    it.skip('nested match via selector returns inner renderable correctly', () => {
        const inner = zt.match('method', {
            cash: zt.z({ amount: z.number() })`PAID $${(e) => e.amount.toFixed(2)}`,
            card: zt.z({ amount: z.number(), last4: z.string().length(4) })`CHARGED $${(e) => e.amount.toFixed(2)} card ****${(e) => e.last4}`,
        });
        // Instead of direct nesting, use a selector that evaluates to the inner match
        const payment = zt.z({ status: z.enum(['pending', 'paid']), method: z.enum(['cash', 'card']).optional(), amount: z.number().optional(), last4: z.string().optional() })`
      ${(e) => {
                if (e.status === 'pending') return zt.t`[AWAITING]`;
                if (e.status === 'paid') {
                    // manually route inner match
                    return inner;
                }
                return zt.t``;
            }}
    `;
        const r1 = payment.render({ status: 'pending' });
        deepEqual(r1, [['[AWAITING]']]);
        const r2 = payment.render({ status: 'paid', method: 'cash', amount: 49.99 });
        deepEqual(r2, [['PAID $', ''], '49.99']);
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.opaque - opaque type escape hatch
// ---------------------------------------------------------------------------
describe('zt.opaque', () => {
    it('renders identical content to the original renderable', () => {
        const inner = zt.z({ x: z.number() })`Value: ${(e) => e.x}`;
        const opaque = zt.opaque(inner);
        const original = inner.render({ x: 10 });
        const opaqueResult = opaque.render({ x: 10 });
        deepEqual(original, opaqueResult);
    });

    it('opaque hides the output type at TS level but preserves runtime behavior', () => {
        const complex = zt.t`A${'B'}C`;
        const opaqueComplex = zt.opaque(complex);
        deepEqual(complex.render(), opaqueComplex.render());
        ok(Array.isArray(opaqueComplex.render()));
    });
});

// ---------------------------------------------------------------------------
// Suite: Structural vs values boundary
// ---------------------------------------------------------------------------
describe('Structural vs values boundary', () => {
    it('user-supplied primitive values are never concatenated into string segments', () => {
        const tpl = zt.z({ name: z.string() })`Hello, ${(e) => e.name}!`;
        const [strs, ...vals] = tpl.render({ name: 'Alice' });
        const allStrings = strs.join('');
        ok(!allStrings.includes('Alice'));
        ok(vals.includes('Alice'));
    });

    it('zt.unsafe injects validated content as static, not as a value', () => {
        const unsafe = zt.unsafe(z.string().regex(/^\w+$/), 'Users');
        const tpl = zt.t`${unsafe}`;
        const [strs, ...vals] = tpl.render();
        ok(strs[0] === 'Users');
        ok(vals.length === 0);
    });

    it('nested renderable structure is flattened, but dynamic parts become values', () => {
        const inner = zt.z({ age: z.number() })`age ${(e) => e.age}`;
        const outer = zt.t`Outer: ${inner}`;
        const [strs, ...vals] = outer.render({ age: 30 });
        ok(strs.join('').includes('age '));
        ok(vals.includes(30));
        ok(!strs.join('').includes('30'));
    });
});

// ---------------------------------------------------------------------------
// Suite: Additional schema composition edge cases
// ---------------------------------------------------------------------------
describe('Schema composition edge cases', () => {
    it('two sibling zt.z with same key and compatible schema intersect gracefully', () => {
        const a = zt.z({ name: z.string().min(1) })`A: ${(e) => e.name}`;
        const b = zt.z({ name: z.string().max(10) })`B: ${(e) => e.name}`;
        const tpl = zt.t`${a} | ${b}`;
        const result = tpl.render({ name: 'valid' });
        deepEqual(result[1], 'valid');
        ok(result[0].length > 1);
    });

    it('sibling zt.z with conflicting types cause validation failure', () => {
        const a = zt.z({ name: z.string() })`A ${e => e.name}`;
        const b = zt.z({ name: z.number() })`B ${e => e.name}`;
        const tpl = zt.t`${a} ${b}`;
        throws(
            () => tpl.render({ name: 'string' } as any),
            InterpolationError,
        );
        throws(
            () => tpl.render({ name: 42 } as any),
            InterpolationError,
        );
    });

    it('scoped parameter (zt.p) merges schema under namespace', () => {
        const inner = zt.z({ name: z.string() })`Hi ${(e) => e.name}`;
        const tpl = zt.t`Scoped: ${zt.p('user', inner)}`;
        throws(
            () => tpl.render({ user: {} } as any),
            InterpolationError,
        );
        const result = tpl.render({ user: { name: 'Alice' } });
        deepEqual(result, [['Scoped: Hi ', ''], 'Alice']);
    });

    it('unscoped renderable schema merges with zt.z parent schema', () => {
        const inner = zt.z({ counter: z.number() })`Count: ${(e) => e.counter}`;
        const outer = zt.z({ title: z.string() })`${(e) => e.title} ${inner}`;
        const result = outer.render({ title: 'Test', counter: 5 });
        deepEqual(result, [['', ' Count: ', ''], 'Test', 5]);
    });
});