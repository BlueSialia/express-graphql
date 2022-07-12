'use strict';

import childProcess from 'child_process';
import fs from 'fs';
import { describe, it } from 'mocha';
import os from 'os';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function exec(command, options = {}) {
	const result = childProcess.execSync(command, {
		encoding: 'utf-8',
		...options,
	});
	return result != null ? result.trimEnd() : result;
}

describe('Integration Tests', () => {
	const tmpDir = path.join(os.tmpdir(), 'express-graphql-integrationTmp');
	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.mkdirSync(tmpDir);

	const distDir = path.resolve('.');
	const archiveName = exec(`npm --quiet pack ${distDir}`, { cwd: tmpDir });
	fs.renameSync(
		path.join(tmpDir, archiveName),
		path.join(tmpDir, 'express-graphql.tgz'),
	);

	function testOnNodeProject(projectName) {
		exec(`cp -R ${path.join(__dirname, projectName)} ${tmpDir}`);

		const cwd = path.join(tmpDir, projectName);
		exec('npm --quiet install', { cwd, stdio: 'inherit' });
		exec('npm --quiet test', { cwd, stdio: 'inherit' });
	}

	it('Should compile with all supported TS versions', () => {
		testOnNodeProject('ts');
	}).timeout(60 * 1000);

	it('Should work on all supported node versions', () => {
		testOnNodeProject('node');
	}).timeout(60 * 1000);
});
