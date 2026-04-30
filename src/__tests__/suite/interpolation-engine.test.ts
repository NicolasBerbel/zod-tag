import { describe, it } from 'node:test';
import { deepEqual, throws, doesNotThrow, } from 'node:assert/strict';
import z from 'zod';
import {
    zt,
    createRenderable,
    interpolate,
    isRenderable,
    InterpolationError,
} from '../../../dist/main.js';

// ---------------------------------------------------------------------------
// Suite: Static Templates (no arguments, no interpolation)
// ---------------------------------------------------------------------------
describe('Static templates', () => {
    it('zt.t with no interpolations → single string, no values', () => {
        const tpl = zt.t`Hello World`;
        const result = tpl.render();
        deepEqual(result, [['Hello World']]);
    });

    it('zt.t with only static text (multiple lines)', () => {
        const tpl = zt.t`Line 1\nLine 2`;
        const result = tpl.render();
        deepEqual(result, [['Line 1\nLine 2']]);
    });

    it('render() has stable output', () => {
        const tpl = zt.t`immutable`;
        const a = tpl.render();
        const b = tpl.render();
        deepEqual(a, b);
        deepEqual(Object.isFrozen(a[0]), true);
        deepEqual(Object.isFrozen(a), true);
    });

    it('zod-tag identity (zt.empty) renders to empty string', () => {
        const result = zt.empty.render();
        deepEqual(result, [['']]);
    });
});

// ---------------------------------------------------------------------------
// Suite: Primitive values
// ---------------------------------------------------------------------------
describe('Primitive value interpolation', () => {
    const tpl = zt.t`Value: ${'hello'} and ${42}`;

    it('produces correct strings and values arrays', () => {
        const result = tpl.render();
        deepEqual(result, [['Value: ', ' and ', ''], 'hello', 42]);
    });

    it('primitive values are not structurally part of strings', () => {
        const [, ...vals] = tpl.render();
        deepEqual(vals, ['hello', 42]);
    });

    it('supports boolean and null', () => {
        const tpl2 = zt.t`${true} ${false} ${null}`;
        const result = tpl2.render();
        deepEqual(result, [['', ' ', ' ', ''], true, false, null]);
    });

    it('supports undefined as a value', () => {
        const tpl3 = zt.t`${undefined}`;
        const result = tpl3.render();
        deepEqual(result, [['', ''], undefined]);
    });

    it('adjacent primitive values create empty string boundaries', () => {
        const tpl4 = zt.t`${1}${2}${3}`;
        deepEqual(tpl4.render(), [['', '', '', ''], 1, 2, 3]);
    });
});

// ---------------------------------------------------------------------------
// Suite: Selector functions (keyword argument bindings)
// ---------------------------------------------------------------------------
describe('Selector functions (kargs)', () => {
    it('selector can return a renderable (composed inside)', () => {
        const inner = zt.t`[${'dynamic'}]`;
        const tpl3 = zt.t`Outer ${() => inner}`;
        const result = tpl3.render();
        // inner is pre-compiled into parent
        deepEqual(result, [['Outer [', ']'], 'dynamic']);
    });
});

// ---------------------------------------------------------------------------
// Suite: Inline Zod schemas (unscoped kargs)
// ---------------------------------------------------------------------------
describe('Inline Zod schemas', () => {
    it('z.object({...}) validates and unwraps value', () => {
        const tpl = zt.t`Name: ${z.object({ name: z.string() })}`;
        const result = tpl.render({ name: 'Alice' });
        deepEqual(result, [['Name: ', ''], { name: 'Alice' }]);
    });

    it('z.codec() as inline schema validates string value directly', () => {
        const codec = z.codec(z.object({ email: z.email() }), z.string(), {
            encode: v => ({ email: v }),
            decode: v => v.email
        })
        const tpl = zt.t`Value: ${codec}`;
        const result = tpl.render({ email: 'test@test.com' });
        deepEqual(result, [['Value: ', ''], 'test@test.com']);
    });

    it('inline schema validation failure throws InterpolationError', () => {
        const tpl = zt.t`Value: ${z.object({ min: z.string().min(10) })}`;
        throws(
            () => tpl.render({ min: 'short' }),
            InterpolationError,
            'should throw InterpolationError',
        );
    });

    it('multiple inline schemas with different keys merges kargs', () => {
        const tpl = zt.t`A: ${z.object({ a: z.number() })} B: ${z.object({ b: z.string() })}`;
        const result = tpl.render({ a: 1, b: 'two' });
        deepEqual(result, [['A: ', ' B: ', ''], { a: 1 }, { b: 'two' }]);
    });
});

// ---------------------------------------------------------------------------
// Suite: zt.p – scoped parameters with schema or renderable
// ---------------------------------------------------------------------------
describe('zt.p - scoped parameters', () => {
    it('zt.p with schema scopes under name and transforms', () => {
        const tpl = zt.t`User: ${zt.p('user', z.email(), (e) => e.toLowerCase())}`;
        const result = tpl.render({ user: 'User@Example.com' });
        deepEqual(result, [['User: ', ''], 'user@example.com']);
    });

    it('zt.p with renderable scopes its kargs', () => {
        const inner = zt.z({ age: z.number() })`age: ${(e) => e.age}`;
        const tpl = zt.t`Child: ${zt.p('child', inner)}`;
        const result = tpl.render({ child: { age: 10 } });
        deepEqual(result, [['Child: age: ', ''], 10]);
    });

    it('zt.p with schema and no transform uses identity', () => {
        const tpl = zt.t`Data: ${zt.p('data', z.number())}`;
        const result = tpl.render({ data: 123 });
        deepEqual(result, [['Data: ', ''], 123]);
    });

    it('zt.p with schema validation fails', () => {
        const tpl = zt.t`Data: ${zt.p('num', z.number())}`;
        throws(
            // @ts-expect-error num is not type number
            () => tpl.render({ num: 'not a number' }),
            InterpolationError,
        );
    });

    it('multiple zt.p with different names compose', () => {
        const tpl = zt.t`A: ${zt.p('a', z.string())} B: ${zt.p('b', z.number())}`;
        const result = tpl.render({ a: 'hello', b: 42 });
        deepEqual(result, [['A: ', ' B: ', ''], 'hello', 42]);
    });
});

// ---------------------------------------------------------------------------
// Suite: Nested renderable composition (pre-compilation)
// ---------------------------------------------------------------------------
describe('Nested renderable composition', () => {
    const inner = zt.z({ name: z.string() })`Hello, ${(e) => e.name}!`;

    it('nested renderable is flattened into parent strings', () => {
        const tpl = zt.t`Prefix ${inner} Suffix`;
        const result = tpl.render({ name: 'World' });
        deepEqual(result, [['Prefix Hello, ', '! Suffix'], 'World']);
    });

    it('nested renderable with its own kargs requires those kargs at parent', () => {
        const tpl = zt.t`outer ${inner}`;
        throws(
            () => tpl.render({} as any),
            InterpolationError, // name is required
        );
    });

    it('schema from nested renderable is merged into parent schema', () => {
        const tpl = zt.t`outer ${inner}`;
        const result = tpl.render({ name: 'Test' });
        deepEqual(result[0], ['outer Hello, ', '!']);
    });

    it('two nested renderables with overlapping kargs merge schemas', () => {
        const a = zt.z({ x: z.number() })`A${(e) => e.x}`;
        const b = zt.z({ y: z.string() })`B${(e) => e.y}`;
        const tpl = zt.t`${a} ${b}`;
        const result = tpl.render({ x: 1, y: 'two' });
        deepEqual(result[0], ['A', ' B', '']); // strings: 'A', ' ', 'B', ''
        deepEqual(result.slice(1), [1, 'two']);
    });

    it('deeply nested renderables (3 levels) compose correctly', () => {
        const l3 = zt.z({ v: z.number() })`L3:${(e) => e.v}`;
        const l2 = zt.z({ u: z.string() })`(L2:${e => e.u})[${l3}]`;
        const l1 = zt.t`L1${l2}`;
        const result = l1.render({ u: 'hello', v: 99 });
        deepEqual(result, [['L1(L2:', ')[L3:', ']'], 'hello', 99]);
        deepEqual(zt.debug(result), 'L1(L2:hello)[L3:99]');
    });

    it('nested renderable can be rendered standalone and still works when nested', () => {
        const standalone = inner.render({ name: 'Standalone' });
        deepEqual(standalone, [['Hello, ', '!'], 'Standalone']);
        const composed = zt.t`${inner}`.render({ name: 'Composed' });
        deepEqual(composed, [['Hello, ', '!'], 'Composed']);
    });
});

// ---------------------------------------------------------------------------
// Suite: Schema validation and merging
// ---------------------------------------------------------------------------
describe('Schema validation', () => {
    it('zt.z with shape enforces kargs', () => {
        const tpl = zt.z({ id: z.uuid() })`ID: ${(e) => e.id}`;
        throws(() => tpl.render({ id: 'not-uuid' }), InterpolationError);
        doesNotThrow(() => tpl.render({ id: '550e8400-e29b-41d4-a716-446655440000' }));
    });

    it('zt.z with shape uses defaults', () => {
        const tpl = zt.z({ name: z.string().default('Guest') })`Name: ${(e) => e.name}`;
        const result = tpl.render({});
        deepEqual(result, [['Name: ', ''], 'Guest']);
    });

    it('schema intersection when two zt.z are composed', () => {
        const a = zt.z({ a: z.string() })`A ${e => e.a}`;
        const b = zt.z({ b: z.number() })`B ${e => e.b}`;
        const composed = zt.t`${a}${b}`;
        throws(() => composed.render({ a: 'x' } as any), InterpolationError);
        doesNotThrow(() => composed.render({ a: 'x', b: 1 }));
    });

    it('schema with transform works', () => {
        const tpl = zt.z({ age: z.string().transform(Number) })`Age: ${(e) => e.age}`;
        const result = tpl.render({ age: '25' });
        deepEqual(result, [['Age: ', ''], 25]);
    });
});

// ---------------------------------------------------------------------------
// Suite: Output structure edge cases
// ---------------------------------------------------------------------------
describe('Output structure edges', () => {
    it('template with only a leading value', () => {
        const tpl = zt.t`${'start'}middle`;
        const result = tpl.render();
        deepEqual(result[0], ['', 'middle']);
        deepEqual(result.slice(1), ['start']);
    });

    it('template with only a trailing value', () => {
        const tpl = zt.t`middle${'end'}`;
        const result = tpl.render();
        deepEqual(result[0], ['middle', '']);
        deepEqual(result.slice(1), ['end']);
    });

    it('template with only edge values', () => {
        const tpl = zt.t`${'start'}middle${'end'}`;
        const result = tpl.render();
        deepEqual(result[0], ['', 'middle', '']);
        deepEqual(result.slice(1), ['start', 'end']);
    });

    it('template with only one value surrounded by nothing', () => {
        const tpl = zt.t`${42}`;
        deepEqual(tpl.render(), [['', ''], 42]);
    });

    it('mixed static and dynamic spaces', () => {
        const tpl = zt.t`a${'b'}c${'d'}e`;
        const result = tpl.render();
        deepEqual(result[0], ['a', 'c', 'e']);
        deepEqual(result.slice(1), ['b', 'd']);
    });

    it('zt.debug() produces expected concatenation', () => {
        const tpl = zt.t`A${1}B${2}C`;
        deepEqual(zt.debug(tpl.render()), 'A1B2C');
    });

    it('zt.$n replaces values with $0... placeholders', () => {
        const tpl = zt.t`A${'x'}B${'y'}`;
        deepEqual(zt.$n(tpl.render()), 'A$0B$1');
    });

    it('zt.atIndex replaces with @0...', () => {
        const tpl = zt.t`A${'x'}B${'y'}`;
        deepEqual(zt.atIndex(tpl.render()), 'A@0B@1');
    });
});

// ---------------------------------------------------------------------------
// Suite: Pre-compilation behavior
// ---------------------------------------------------------------------------
describe('Pre-compilation guarantees', () => {
    it('nested renderables are compiled only once (immutable strings/values)', () => {
        const inner = zt.t`[${'inner'}]`;
        const outer = zt.t`outer ${inner} outer`;

        const result1 = outer.render();
        const result2 = outer.render();
        deepEqual(result1, result2);

        const renderable = zt.t`${inner}`;
        // @ts-expect-error access internal
        deepEqual(Object.isFrozen(renderable.strs), true);
        // @ts-expect-error access internal
        deepEqual(Object.isFrozen(renderable.vals), true);
    });

    it('schema of nested renderable is merged into parent at creation time, not render time', () => {
        const child = zt.z({ childKey: z.number() })`child ${e => e.childKey}`;
        const parent = zt.t`parent ${child}`;
        // @ts-expect-error access internal
        throws(() => parent.schema.encode({ childKey: 'string' }), z.ZodError);
    });
});

// ---------------------------------------------------------------------------
// Suite: Low-level functions (createRenderable, interpolate, isRenderable)
// ---------------------------------------------------------------------------
describe('Low-level API', () => {
    it('createRenderable works directly', () => {
        const r = createRenderable<void>(['Hello, ', '!'], ['World']);
        deepEqual(isRenderable(r), true);
        const result = r.render();
        deepEqual(result, [['Hello, ', '!'], 'World']);
    });

    it('interpolate can process a renderable with kargs', () => {
        const r = createRenderable(['A', 'B'], [(k: any) => k.x]);
        const result = interpolate(r, { x: 10 });
        deepEqual(result, [['A', 'B'], 10]);
    });

    it('createRenderable with schema validates', () => {
        const schema = z.object({ n: z.number() });
        const r = createRenderable(['n=', ''], [(k: any) => k.n], schema);
        throws(() => r.render({ n: 'oops' }), InterpolationError);
        doesNotThrow(() => r.render({ n: 5 }));
    });

    it('createRenderable with nested renderable pre-compiles', () => {
        const inner = createRenderable(['inner', ''], [42]);
        const outer = createRenderable<void>(['[', ']'], [inner]);
        const result = outer.render();
        deepEqual(result, [['[inner', ']'], 42]);
    });
});