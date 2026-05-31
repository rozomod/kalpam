import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('set-version stamps the version into every package', () => {
  const root = mkdtempSync(join(tmpdir(), 'kalpam-'));
  for (const p of ['packages/tsconfig', 'packages/oxlint-config']) {
    mkdirSync(join(root, p), { recursive: true });
    writeFileSync(join(root, p, 'package.json'), JSON.stringify({ name: p, version: '0.0.0' }));
  }
  execFileSync('node', [join(import.meta.dirname, 'set-version.mjs'), '1.2.3'], {
    cwd: root,
    env: { ...process.env, KALPAM_PACKAGES: 'packages/tsconfig,packages/oxlint-config' },
  });
  const v = JSON.parse(readFileSync(join(root, 'packages/tsconfig/package.json'), 'utf8')).version;
  expect(v).toBe('1.2.3');
  const v2 = JSON.parse(
    readFileSync(join(root, 'packages/oxlint-config/package.json'), 'utf8'),
  ).version;
  expect(v2).toBe('1.2.3');
});
