import { exec } from 'child_process'
import { writeFileSync } from 'fs'
import path from 'path'

const cwd = process.cwd()
let output = ''

const child = exec('npm run test', {
    env: { ...process.env, FORCE_COLOR: '1' },
}, (err) => {
    const sanitized = output
        .replaceAll(cwd.replaceAll(path.sep, '/'), './zod-tag')
        .replace(/\x1b\[[0-9;]*m/g, '')
    writeFileSync('./src/__tests__/TESTS.snapshot.txt', sanitized)
    process.exit(err ? 1 : 0)
})

child.stdout?.on('data', (data: string) => {
    output += data
    process.stdout.write(data)
})

child.stderr?.on('data', (data: string) => {
    output += data
    process.stderr.write(data)
})
