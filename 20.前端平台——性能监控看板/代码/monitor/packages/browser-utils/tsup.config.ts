import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // ESM -> .js, CJS -> .cjs，与 package.json exports 字段对应
  outExtension({ format }) {
    return { js: format === 'esm' ? '.js' : '.cjs' }
  },
})
