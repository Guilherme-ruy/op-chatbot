/**
 * Build script: compila src/widget/index.ts → public/widget.js
 * Uso: node scripts/build-widget.mjs [--watch]
 */
import * as esbuild from 'esbuild';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = join(__dirname, '..');
const isWatch   = process.argv.includes('--watch');

mkdirSync(join(root, 'public'), { recursive: true });

const buildOptions = {
  entryPoints: [join(root, 'src/widget/index.ts')],
  bundle:      true,
  minify:      !isWatch,
  sourcemap:   isWatch ? 'inline' : false,
  outfile:     join(root, 'public/widget.js'),
  target:      ['es2018'],
  format:      'iife',
  logLevel:    'info',
};

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('👀 Observando src/widget/index.ts...');
} else {
  await esbuild.build(buildOptions);
  console.log('✅ public/widget.js gerado com sucesso.');
}
