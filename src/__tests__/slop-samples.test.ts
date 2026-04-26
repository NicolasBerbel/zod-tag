import { describe, it } from 'node:test';
import path from 'node:path';
import { glob } from 'node:fs/promises';

const testFiles: string[] = [];
for await (const entry of glob([
    '**/*.type-test.*',
    '**/*.slop-test.*',
    '**/*-test.*',
], { withFileTypes: true })) {
    testFiles.push(path.join(entry.parentPath, entry.name));
}

describe('slop tests - does the slop-test files run?', async () => {
    await Promise.all(testFiles.flatMap(filePath => {
        const testName = path.basename(filePath)
        const importPath = path.relative(import.meta.dirname, filePath)
        return it(testName, () => import(`./${importPath}`))
    }))
});