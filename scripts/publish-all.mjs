#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGES = [
  'packages/tsconfig',
  'packages/oxlint-config',
  'packages/oxfmt-config',
  'packages/vitest-config',
  'packages/commitlint-config',
  'packages/semantic-release-config',
];
const root = process.cwd();
for (const dir of PACKAGES) {
  const cwd = resolve(root, dir);
  const { name, version } = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8'));
  let exists = false;
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], { stdio: 'ignore' });
    exists = true;
  } catch {} // any error (incl. "not found" or registry/auth failure) → fall through to publish, which fails with a clear error if the registry is unreachable
  if (exists) {
    console.log(`skip ${name}@${version} (already published)`);
    continue;
  }
  console.log(`publish ${name}@${version}`);
  execFileSync('npm', ['publish', '--access', 'public'], { cwd, stdio: 'inherit' });
}
