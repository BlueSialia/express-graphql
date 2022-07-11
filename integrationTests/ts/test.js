'use strict';

import childProcess from 'child_process';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import pkgJSON from './package.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsVersions = Object.keys(pkgJSON.dependencies)
	.filter((pkg) => pkg.startsWith('typescript-'))
	.sort((a, b) => b.localeCompare(a));

for (const version of tsVersions) {
	console.log(`Testing on ${version} ...`);

	const tscPath = path.join(__dirname, 'node_modules', version, 'bin/tsc');
	childProcess.execSync(tscPath, { stdio: 'inherit' });
}
