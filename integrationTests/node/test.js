'use strict';

import childProcess from 'child_process';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import pkgJSON from './package.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nodeVersions = Object.keys(pkgJSON.dependencies)
  .filter((pkg) => pkg.startsWith('node-'))
  .sort((a, b) => b.localeCompare(a));

for (const version of nodeVersions) {
  console.log(`Testing on ${version} ...`);

  const nodePath = path.join(__dirname, 'node_modules', version, 'bin/node');
  childProcess.execSync(nodePath + ' index.js', { stdio: 'inherit' });
}
