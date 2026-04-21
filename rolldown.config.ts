import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts'


export default defineConfig({
  input: 'src/main.ts',
  external: ['zod'],
  plugins: [dts()],
  output: {
    dir: 'dist',
    format: 'es',
  }
});