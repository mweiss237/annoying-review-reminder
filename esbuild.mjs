import * as esbuild from 'esbuild';

const production = process.argv.includes('--minify');
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: !production,
  minify: production,
  target: 'es2022',
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[watch] build started');
} else {
  await esbuild.build(buildOptions);
  console.log('build complete');
}
