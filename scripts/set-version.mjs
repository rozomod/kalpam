#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGES = (
  process.env.KALPAM_PACKAGES ??
  'packages/tsconfig,packages/oxlint-config,packages/oxfmt-config,packages/vitest-config,packages/commitlint-config,packages/semantic-release-config'
).split(',');

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error(`Invalid/missing version: "${version}"`);
  process.exit(1);
}
const root = process.cwd();
for (const dir of PACKAGES) {
  const file = resolve(root, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`set ${pkg.name} -> ${version}`);
}
