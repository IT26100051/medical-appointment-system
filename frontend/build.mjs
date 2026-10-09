/* Bundles the npm libraries into js/vendor.js (+ js/vendor.css) with esbuild. */
import * as esbuild from 'esbuild';

const options = {
    entryPoints: ['js/vendor.entry.js'],
    /* the bundle ships the npm libraries AND the clinic's own modules under
       js/modules/, so the pages stay classic scripts while the source stays
       split into small, findable files */
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    outfile: 'js/vendor.js',
    legalComments: 'none',
    logLevel: 'info'
};

if (process.argv.includes('--watch')) {
    const context = await esbuild.context(options);
    await context.watch();
    console.log('watching js/vendor.entry.js ...');
} else {
    await esbuild.build(options);
    console.log('built js/vendor.js');
}
