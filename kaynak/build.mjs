// Motoru derler: Site/web/js/motor.worker.js
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const G = path.join(here, 'uma-tools', 'umalator-global');
const redirect = {
	name: 'redirect',
	setup(b) {
		b.onResolve({ filter: /(?:^|\/)data\/[a-z_]+\.json$/ }, (a) => ({ path: path.join(G, a.path.split('/data/')[1]) }));
		b.onResolve({ filter: /skill_meta\.json$/ }, () => ({ path: path.join(G, 'skill_meta.json') }));
		b.onResolve({ filter: /umas\.json$/ }, () => ({ path: path.join(G, 'umas.json') }));
		b.onResolve({ filter: /^node:assert$/ }, (a) => ({ path: a.path, namespace: 'assert' }));
		b.onLoad({ filter: /.*/, namespace: 'assert' }, () => ({ contents: 'module.exports={strict:function(){}};', loader: 'js' }));
	},
};
await esbuild.build({
	entryPoints: [path.join(here, 'src', 'motor.worker.ts')], bundle: true, minify: true, format: 'iife',
	outfile: path.join(here, '..', 'web', 'js', 'motor.worker.js'),
	define: { CC_DEBUG: 'false', CC_GLOBAL: 'true' }, plugins: [redirect], logLevel: 'warning',
	banner: { js: '/* UmaCollector yarış motoru. Motor: alpha123/uma-tools ve uma-skill-tools (GPL-3.0-or-later). Kaynak: https://github.com/umacollector/umacollector.github.io/tree/main/kaynak */' },
});
console.log('motor.worker.js hazır');
