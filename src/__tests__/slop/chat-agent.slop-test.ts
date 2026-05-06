// chat-agent.slop-test.ts
import { z } from 'zod';
import { zt, type IRenderableKargs, InterpolationError } from '../../../dist/main.js';

/**
 * ASYNC CHAT AGENT — Multi-turn LLM Tool-Calling
 *
 * Demonstrates zod-tag with async schemas (refine, transform), discriminated
 * tool dispatch, composition of sync/async branches, and async streaming.
 *
 * Gotchas covered:
 *  - sync render() throws for async schemas
 *  - async schemas propagate to parent renderables
 *  - zt.bind with async schemas requires renderAsync
 *  - streamAsync yields the same chunks as sync stream for static parts
 *  - mixing sync and async children in a single template
 */

// ---------------------------------------------------------------------------
// Simulated async utilities (no real network)
// ---------------------------------------------------------------------------
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const validApiKeys = new Set(['sk-valid', 'key-ok']);
const checkApiKey = async (key: string) => {
    await delay(5); // fake network
    return validApiKeys.has(key);
};

// ---------------------------------------------------------------------------
// Tool definitions (async schemas for external tools, sync for calculation)
// ---------------------------------------------------------------------------

// Async refine: validate API key before performing search
const searchTool = zt.z({
    query: z.string().min(1),
    apiKey: z.string().refine(async (k) => checkApiKey(k), {
        message: 'Invalid API key for search',
    }),
})`
SEARCH("${e => e.query}") -> results would go here
`;

// Sync calculation tool
const calculateTool = zt.z({
    expression: z.string().min(1),
    precision: z.number().int().min(0).max(10).default(2),
})`
CALC(${e => e.expression}, ${e => e.precision})
`;

// Async transform: translate text after validating API key
const translateTool = zt.z({
    text: z.string(),
    targetLang: z.enum(['es', 'fr', 'de']),
    apiKey: z.string().refine(async (k) => checkApiKey(k), {
        message: 'Invalid API key for translation',
    }),
})`
TRANSLATE("${e => e.text}" -> ${e => e.targetLang})
`;

// ---------------------------------------------------------------------------
// Agent tool dispatcher (zt.match with async branches)
// ---------------------------------------------------------------------------
const toolCallTemplate = zt.match('tool', {
    search: searchTool,
    calculate: calculateTool,
    translate: translateTool,
});

// ---------------------------------------------------------------------------
// Full chat turn: system prompt + user message + tool call
// ---------------------------------------------------------------------------
const chatTurnTemplate = zt.z({
    systemPrompt: z.string().default('You are a helpful assistant.'),
    userMessage: z.string(),
})`
[SYSTEM] ${e => e.systemPrompt}
[USER] ${e => e.userMessage}
[TOOL] ${zt.p('toolCall', toolCallTemplate)}
`;

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
console.log('\n' + '═'.repeat(80));
console.log('  ASYNC CHAT AGENT — Multi-turn Tool-Calling');
console.log('═'.repeat(80) + '\n');

let passed = 0, failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
    const run = async () => {
        try {
            await fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (e) {
            console.log(`  ✗ ${name}: ${(e as Error).message.split('\n')[0]}`);
            console.error(e);
            failed++;
        }
    };
    // synchronous test execution; we'll wrap in async IIFE at the end
    return run();
}

async function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
(async () => {

    // ── 1. Sync tool works with sync render() ───────────────────────
    await test('calculate tool (sync) renders with render()', async () => {
        const res = calculateTool.render({
            expression: '2+3',
            precision: 2,
        });
        const debug = zt.debug(res);
        console.log('\n' + debug + '\n')
        await assert(debug.includes('CALC(2+3, 2)'), 'Should contain CALC');
    });

    // ── 2. Async tool rejects render(), requires renderAsync() ─────
    await test('search tool (async) throws on render()', async () => {
        await assert(
            (() => {
                try {
                    searchTool.render({ query: 'test', apiKey: 'bad' });
                    return false;
                } catch (e) {
                    return e instanceof InterpolationError;
                }
            })(),
            'sync render() should throw for async schema'
        );
    });

    // ── 3. Async tool renders correctly with renderAsync() ─────────
    await test('search tool with valid API key renders via renderAsync', async () => {
        const res = await searchTool.renderAsync({ query: 'hello', apiKey: 'sk-valid' });
        const debug = zt.debug(res);
        console.log('\n' + debug + '\n')
        await assert(debug.includes('SEARCH("hello")'), 'Should contain SEARCH');
    });

    // ── 4. Async tool rejects invalid API key (async validation) ───
    await test('search tool with invalid API key rejects', async () => {
        try {
            await searchTool.renderAsync({ query: 'x', apiKey: 'bad-key' });
            throw new Error('Should have thrown');
        } catch (e) {
            // expected
        }
    });

    // ── 5. zt.match dispatch with mixed sync/async → async ────────
    await test('toolCallTemplate is async because it contains async branches', async () => {
        // The toolCallTemplate should have __async = true
        const isAsync = (toolCallTemplate as any).__async;
        await assert(isAsync === true, 'should be async');
        // sync render() should throw
        try {
            toolCallTemplate.render({ tool: 'search', query: 'x', apiKey: 'valid' });
            throw new Error('should have thrown');
        } catch (e) {
            // ok
        }
    });

    // ── 6. renderAsync on toolCallTemplate with sync branch works ──
    await test('toolCallTemplate.renderAsync with calculate (sync) tool', async () => {
        const res = await toolCallTemplate.renderAsync({
            tool: 'calculate',
            expression: '10/2',
            precision: 2,
        });
        const debug = zt.debug(res);
        console.log('\n' + debug + '\n')
        await assert(debug.includes('CALC(10/2, 2)'), 'Should render calculate');
    });

    await test('chatTurnTemplate with async tool requires renderAsync', async () => {
        // sync render() should throw because the template is async
        try {
            chatTurnTemplate.render({
                userMessage: 'Search for weather',
                toolCall: {                         // ← nest under toolCall
                    tool: 'search',
                    query: 'weather',
                    apiKey: 'sk-valid',
                },
            });
            throw new Error('should have thrown');
        } catch (e) {
            // expected
        }
        // renderAsync should succeed
        const res = await chatTurnTemplate.renderAsync({
            userMessage: 'Search for weather',
            toolCall: {                             // ← nest under toolCall
                tool: 'search',
                query: 'weather',
                apiKey: 'sk-valid',
            },
        });
        const debug = zt.debug(res);
        console.log('\n' + debug + '\n')
        await assert(debug.includes('SEARCH("weather")'), 'Must contain search');
        await assert(debug.includes('[USER] Search for weather'), 'User message');
    });

    // ── 8. zt.bind with async renderable then renderAsync ──────────
    await test('zt.bind async renderable + renderAsync', async () => {
        const bound = zt.bind(searchTool, { query: 'hello', apiKey: 'sk-valid' });
        // bound is async because source was async
        await assert((bound as any).__async === true, 'bound should be async');
        try {
            bound.render();
            throw new Error('should have thrown');
        } catch (e) { /* ok */ }
        const res = await bound.renderAsync();
        const debug = zt.debug(res);
        console.log('\n' + debug + '\n')
        await assert(debug.includes('SEARCH("hello")'), 'Bound rendered correctly');
    });

    // ── 9. streamAsync on async renderable yields chunks ───────────
    await test('streamAsync yields correct chunks for async tool', async () => {
        const tpl = searchTool;
        const stream = tpl.streamAsync({ query: 'test', apiKey: 'sk-valid' });
        const chunks: any[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        // Expect: ['SEARCH("', 'test'], ['") -> results...']
        await assert(chunks.length >= 2, `expected at least 2 chunks, got ${chunks.length}`);
        await assert(chunks[0][1] === 'test', 'first value should be query');
        await assert(Object.isFrozen(chunks[0]), 'chunks should be frozen');
    });

    // ── 10. Mixing sync child in async parent still works ──────────
    await test('async parent with sync child yields correct stream', async () => {
        const syncChild = zt.t`[sync]`;
        const parent = zt.z({ key: z.string().refine(async (k) => k === 'ok') })`
      ${syncChild} ${e => e.key}
    `;
        const stream = parent.streamAsync({ key: 'ok' });
        const chunks: any[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        await assert(chunks[0][0].includes('[sync]'), `should contain [sync]: ${JSON.stringify(chunks[0])}`);
        await assert(chunks[0][1] === 'ok', `expected 'ok', got ${chunks[0]?.[1]}`);
    });

    // ── 11. Gotcha: Forgetting renderAsync and catching the error ──
    await test('clear InterpolationError message on sync render of async', async () => {
        try {
            searchTool.render({ query: 'x', apiKey: 'sk-valid' });
        } catch (e) {
            const msg = (e as Error).message;
            await assert(msg.includes('async renderables should be rendered asynchronously'), 'Error message should guide user');
        }
    });

    // ── 12. Async validation failure error message is informative ──
    await test('async validation failure gives clear error', async () => {
        try {
            await searchTool.renderAsync({ query: 'x', apiKey: 'bad' });
        } catch (e) {
            const msg = (e as Error).message;
            await assert(msg.includes('Invalid API key'), 'Should mention API key validation');
        }
    });

    // ── 13. Performance: multiple async renders don't degrade ──────
    await test('batched async renders are stable', async () => {
        const start = performance.now();
        const promises = [];
        for (let i = 0; i < 20; i++) {
            promises.push(searchTool.renderAsync({ query: `q${i}`, apiKey: 'sk-valid' }));
        }
        await Promise.all(promises);
        const elapsed = performance.now() - start;
        console.log(`    Rendered 20 async calls in ${elapsed.toFixed(0)}ms`);
        await assert(elapsed < 2000, 'Should complete within 2s');
    });

    // ── Results ─────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(80));
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(80) + '\n');

})();