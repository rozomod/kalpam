#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error('Usage: node scripts/release.mjs <X.Y.Z>');
  process.exit(1);
}
const sh = (c, a) => execFileSync(c, a, { cwd: root, stdio: 'inherit' });
if (execFileSync('git', ['status', '--porcelain'], { cwd: root }).toString().trim()) {
  console.error('Working tree not clean.');
  process.exit(1);
}
sh('node', ['scripts/set-version.mjs', version]);
sh('pnpm', ['-r', 'run', 'build', '--if-present']);
// Order: commit → tag → publish → push. If publish fails, delete the local tag (git tag -d vX.Y.Z) and reset the commit (git reset HEAD~1) before retrying.
sh('git', ['commit', '-am', `chore(release): v${version} [skip ci]`]);
sh('git', ['tag', `v${version}`]);
sh('node', ['scripts/publish-all.mjs']);
sh('git', ['push', '--follow-tags']);
console.log(`Released v${version}.`);
