# kalpam Slice 0 (Shared Base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the stack-agnostic kalpam base — six `@kalpam/*` config packages, the canonical lefthook config, the shared Renovate preset, and the OIDC release pipeline — so any preset can consume them and stay current via OTA.

**Architecture:** One pnpm + Turborepo monorepo (`rozomod/kalpam`) that publishes config packages to public npm, is **unified-versioned** (one git tag publishes all packages), and uses npm OIDC Trusted Publishing (no `NPM_TOKEN`). Config packages follow two shapes: built TS→`dist/` (oxlint, vitest) and buildless/JSON (tsconfig, oxfmt, commitlint, semantic-release). Slice 1 (the first preset) is a separate plan that depends on these packages being published.

**Tech Stack:** pnpm 11.0.8 · Node 24 · Turborepo 2.9 · TypeScript 5.9.2 · oxlint 1.67 · oxfmt 0.52 (beta) · Vitest 4.1 · commitlint 21 · semantic-release 25 · lefthook 2.1 · Renovate (Mend App) · Copier (consumed in Slice 1).

**Spec:** `docs/superpowers/specs/2026-05-31-kalpam-base-and-cf-preset-design.md`. The repo is already `git init`'d (`main`, root commits `4d33a9e`, `5473b84`).

> **Note on TDD for config packages:** pure config packages have no unit logic, so their "test" is a **verification command** (`tsc --showConfig`, `oxlint --print-config`, `npm pack --dry-run`, `commitlint` on a sample message). Run it, see it fail (package/config absent), create the files, run it again, see it pass. The two JS *scripts* (Task 10) get real Vitest unit tests.

---

## Task 1: Repo scaffolding (workspace root)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitignore`, `LICENSE`, `README.md`

- [ ] **Step 1: Create `.nvmrc`**

```
24
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'

# pnpm 11 postinstall build allowlist
allowBuilds:
  esbuild: true
  lefthook: true
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "kalpam",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.0.8",
  "engines": { "node": ">=24" },
  "scripts": {
    "build": "turbo run build",
    "check-types": "turbo run check-types",
    "test": "turbo run test",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "oxfmt .",
    "check-format": "oxfmt --check .",
    "version:set": "node scripts/set-version.mjs",
    "publish:all": "node scripts/publish-all.mjs",
    "release": "node scripts/release.mjs",
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "lefthook": "^2.1.9",
    "oxfmt": "^0.52.0",
    "oxlint": "^1.67.0",
    "turbo": "^2.9.16",
    "typescript": "5.9.2",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "check-types": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
.turbo
coverage
*.tsbuildinfo
.DS_Store
*.log
```

- [ ] **Step 6: Create `LICENSE` (MIT) and `README.md`**

`README.md`:

```markdown
# kalpam

The kalpam base: shared `@kalpam/*` config packages, canonical git hooks, a shared Renovate preset, and the release pipeline that publishes them. Presets live under `templates/`.

## Packages
- `@kalpam/tsconfig` · `@kalpam/oxlint-config` · `@kalpam/oxfmt-config`
- `@kalpam/vitest-config` · `@kalpam/commitlint-config` · `@kalpam/semantic-release-config`

## Develop
```bash
nvm use && corepack enable
pnpm install   # runs lefthook install
pnpm build && pnpm check-types && pnpm test
```
```

`LICENSE`: standard MIT text, copyright `2026 rozomod`.

- [ ] **Step 7: Install + commit**

Run: `pnpm install`
Expected: resolves; `lefthook` postinstall may warn that no `lefthook.yml` exists yet (fine — added in Task 8).

```bash
git add -A
git commit -m "chore: scaffold kalpam workspace root"
```

---

## Task 2: `@kalpam/tsconfig` (JSON-only, no build)

**Files:**
- Create: `packages/tsconfig/package.json`, `packages/tsconfig/base.json`, `packages/tsconfig/node.json`, `packages/tsconfig/react.json`

> Variants for Slice 0+1: `base` (shared), `node` (Workers/db), `react` (the Vite SPA client). A `nextjs` variant is deferred to the Next.js preset (Slice 3).

- [ ] **Step 1: Verify it does NOT resolve yet**

Run: `node -e "require.resolve('@kalpam/tsconfig/base.json')" 2>&1 || echo MISSING`
Expected: `MISSING`

- [ ] **Step 2: Create `packages/tsconfig/package.json`**

```json
{
  "name": "@kalpam/tsconfig",
  "version": "0.0.0",
  "description": "Shared TypeScript configs for rozomod projects.",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/tsconfig" },
  "files": ["base.json", "node.json", "react.json"]
}
```

- [ ] **Step 3: Create `packages/tsconfig/base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "incremental": false,
    "isolatedModules": true,
    "lib": ["es2022"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

- [ ] **Step 4: Create `packages/tsconfig/node.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": { "types": ["node"], "noEmit": false, "sourceMap": true }
}
```

- [ ] **Step 5: Create `packages/tsconfig/react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "declaration": false,
    "declarationMap": false
  }
}
```

- [ ] **Step 6: Verify the configs are valid JSON**

Run: `node -e "const fs=require('fs');['base','node','react'].forEach(f=>JSON.parse(fs.readFileSync('packages/tsconfig/'+f+'.json','utf8')));console.log('JSON-OK')"`
Expected: `JSON-OK`. (Cross-package `extends` resolution — `"@kalpam/tsconfig/base.json"` resolving from `node_modules` — is proven when `@kalpam/oxlint-config` builds in Task 3, whose `tsconfig.json` extends it; building there fails loudly if resolution breaks.)

- [ ] **Step 7: Verify the published file set**

Run: `cd packages/tsconfig && npm pack --dry-run`
Expected: lists exactly `base.json`, `node.json`, `react.json`, `package.json` (+ LICENSE/README if present). `cd` back to root.

- [ ] **Step 8: Commit**

```bash
git add packages/tsconfig
git commit -m "feat(tsconfig): add @kalpam/tsconfig base/node/react configs"
```

---

## Task 3: `@kalpam/oxlint-config` (built TS → dist/)

**Files:**
- Create: `packages/oxlint-config/package.json`, `packages/oxlint-config/tsconfig.json`, `packages/oxlint-config/src/index.ts`

- [ ] **Step 1: Create `packages/oxlint-config/package.json`**

```json
{
  "name": "@kalpam/oxlint-config",
  "version": "0.0.0",
  "description": "Shared oxlint config for rozomod projects.",
  "type": "module",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/oxlint-config" },
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": { "build": "tsc -p tsconfig.json", "clean": "rm -rf dist" },
  "peerDependencies": { "oxlint": ">=1.63.0" },
  "devDependencies": { "@kalpam/tsconfig": "workspace:*", "oxlint": "^1.67.0", "typescript": "5.9.2" }
}
```

- [ ] **Step 2: Create `packages/oxlint-config/tsconfig.json`**

```json
{
  "extends": "@kalpam/tsconfig/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "noEmit": false, "module": "ESNext", "moduleResolution": "Bundler" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/oxlint-config/src/index.ts`**

```ts
import type { OxlintConfig } from "oxlint";

/**
 * Shared oxlint config object. Consume from a project's oxlint.config.ts:
 *   import rozomod from "@kalpam/oxlint-config";
 *   import { defineConfig } from "oxlint";
 *   export default defineConfig({ extends: [rozomod], env: { browser: true, node: true, es2024: true } });
 * NOTE: oxlint does NOT inherit `env` through `extends` (oxc#20087) — consumers re-declare it.
 */
const config: OxlintConfig = {
  plugins: ["typescript", "react", "jsx-a11y", "import", "oxc"],
  env: { browser: true, node: true, es2024: true },
  categories: { correctness: "error", suspicious: "warn", perf: "warn", style: "off" },
  rules: {
    "no-console": "warn",
    "no-debugger": "error",
    eqeqeq: "error",
    "typescript/no-explicit-any": "warn",
    "typescript/consistent-type-imports": "error",
    "react/jsx-key": "error",
    "import/no-duplicates": "error",
    "jsx-a11y/alt-text": "error",
    "react/react-in-jsx-scope": "off",
  },
  overrides: [
    { files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"], rules: { "no-console": "off", "typescript/no-explicit-any": "off" } },
  ],
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.turbo/**", "**/coverage/**", "**/*.d.ts"],
};

export default config;
```

> If `OxlintConfig` is not exported by the pinned `oxlint`, fall back to `const config = { ... } satisfies` removed (drop the annotation). `tsc` (Step 4) surfaces this.

- [ ] **Step 4: Build it**

Run: `pnpm --filter @kalpam/oxlint-config build`
Expected: emits `dist/index.js` + `dist/index.d.ts`, exit 0.

- [ ] **Step 5: Verify the default export loads**

Run: `node -e "import('@kalpam/oxlint-config').then(m=>console.log(Array.isArray(m.default.plugins)))"`
Expected: `true`

- [ ] **Step 6: Commit**

```bash
git add packages/oxlint-config
git commit -m "feat(oxlint-config): add @kalpam/oxlint-config shared ruleset"
```

---

## Task 4: `@kalpam/oxfmt-config` (JSON-only, no build)

**Files:**
- Create: `packages/oxfmt-config/package.json`, `packages/oxfmt-config/oxfmt.json`

- [ ] **Step 1: Create `packages/oxfmt-config/package.json`**

```json
{
  "name": "@kalpam/oxfmt-config",
  "version": "0.0.0",
  "description": "Shared oxfmt formatter config for rozomod projects.",
  "type": "module",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/oxfmt-config" },
  "exports": { "./oxfmt": "./oxfmt.json", "./package.json": "./package.json" },
  "files": ["oxfmt.json"],
  "devDependencies": { "oxfmt": "^0.52.0" }
}
```

- [ ] **Step 2: Create `packages/oxfmt-config/oxfmt.json`**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "quoteProps": "as-needed",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Verify it imports as JSON**

Run: `pnpm install && node --input-type=module -e "import c from '@kalpam/oxfmt-config/oxfmt' with { type: 'json' }; console.log(c.printWidth===100 && c.singleQuote===true)"`
Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add packages/oxfmt-config
git commit -m "feat(oxfmt-config): add @kalpam/oxfmt-config formatter config"
```

---

## Task 5: `@kalpam/vitest-config` (built TS → dist/)

**Files:**
- Create: `packages/vitest-config/package.json`, `packages/vitest-config/tsconfig.json`, `packages/vitest-config/src/index.ts`, `packages/vitest-config/src/node.ts`, `packages/vitest-config/src/browser.ts`

- [ ] **Step 1: Create `packages/vitest-config/package.json`**

```json
{
  "name": "@kalpam/vitest-config",
  "version": "0.0.0",
  "description": "Shared Vitest base config for rozomod projects.",
  "type": "module",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/vitest-config" },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./node": { "types": "./dist/node.d.ts", "default": "./dist/node.js" },
    "./browser": { "types": "./dist/browser.d.ts", "default": "./dist/browser.js" }
  },
  "files": ["dist"],
  "scripts": { "build": "tsc -p tsconfig.json", "clean": "rm -rf dist" },
  "peerDependencies": { "vitest": ">=4.0.0" },
  "devDependencies": { "@kalpam/tsconfig": "workspace:*", "typescript": "5.9.2", "vitest": "^4.1.7" }
}
```

- [ ] **Step 2: Create `packages/vitest-config/tsconfig.json`**

```json
{
  "extends": "@kalpam/tsconfig/base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "noEmit": false, "module": "ESNext", "moduleResolution": "Bundler" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/vitest-config/src/index.ts`**

```ts
import { defineConfig, type ViteUserConfig } from "vitest/config";

/** Stack-agnostic Vitest base. Consume via mergeConfig in a project's vitest.config.ts. */
const base: ViteUserConfig = defineConfig({
  test: {
    globals: false,
    clearMocks: true,
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "html"], exclude: ["**/dist/**", "**/*.config.*", "**/*.d.ts"] },
  },
});

export default base;
```

- [ ] **Step 4: Create `packages/vitest-config/src/node.ts`**

```ts
import { mergeConfig } from "vitest/config";
import base from "./index.js";

export default mergeConfig(base, { test: { environment: "node" } });
```

- [ ] **Step 5: Create `packages/vitest-config/src/browser.ts`**

```ts
import { mergeConfig } from "vitest/config";
import base from "./index.js";

export default mergeConfig(base, { test: { environment: "jsdom" } });
```

- [ ] **Step 6: Build + verify default export loads**

Run: `pnpm --filter @kalpam/vitest-config build && node -e "import('@kalpam/vitest-config').then(m=>console.log(!!m.default.test))"`
Expected: build exit 0, then `true`.

- [ ] **Step 7: Commit**

```bash
git add packages/vitest-config
git commit -m "feat(vitest-config): add @kalpam/vitest-config base + node/browser"
```

---

## Task 6: `@kalpam/commitlint-config` (buildless ESM)

**Files:**
- Create: `packages/commitlint-config/package.json`, `packages/commitlint-config/index.js`, `packages/commitlint-config/index.d.ts`

- [ ] **Step 1: Create `packages/commitlint-config/package.json`**

```json
{
  "name": "@kalpam/commitlint-config",
  "version": "0.0.0",
  "description": "Shared commitlint (conventional) config for rozomod projects.",
  "type": "module",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/commitlint-config" },
  "exports": { ".": "./index.js", "./package.json": "./package.json" },
  "main": "./index.js",
  "types": "./index.d.ts",
  "files": ["index.js", "index.d.ts"],
  "dependencies": { "@commitlint/config-conventional": "^21.0.1" },
  "peerDependencies": { "@commitlint/cli": ">=20.0.0" },
  "devDependencies": { "@commitlint/cli": "^21.0.1" }
}
```

- [ ] **Step 2: Create `packages/commitlint-config/index.js`**

```js
/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [1, "always", 120],
  },
};

export default config;
```

- [ ] **Step 3: Create `packages/commitlint-config/index.d.ts`**

```ts
import type { UserConfig } from "@commitlint/types";
declare const config: UserConfig;
export default config;
```

- [ ] **Step 4: Verify it lints a sample message**

Run:
```bash
pnpm install
printf 'feat: a valid message\n' | pnpm --filter @kalpam/commitlint-config exec commitlint --config index.js && echo VALID-OK
printf 'broken message\n'        | pnpm --filter @kalpam/commitlint-config exec commitlint --config index.js || echo INVALID-REJECTED
```
Expected: `VALID-OK` for the conventional message, `INVALID-REJECTED` for the broken one. (Runs in the package dir so its bundled `@commitlint/cli` + `config-conventional` resolve locally — no registry fetch of the unpublished workspace package.)

- [ ] **Step 5: Commit**

```bash
git add packages/commitlint-config
git commit -m "feat(commitlint-config): add @kalpam/commitlint-config (conventional)"
```

---

## Task 7: `@kalpam/semantic-release-config` (JS module, app-oriented)

**Files:**
- Create: `packages/semantic-release-config/package.json`, `packages/semantic-release-config/index.js`

> App-oriented: NO `@semantic-release/npm`. Cuts a GitHub release + tag + CHANGELOG on push to `main`.

- [ ] **Step 1: Create `packages/semantic-release-config/package.json`**

```json
{
  "name": "@kalpam/semantic-release-config",
  "version": "0.0.0",
  "description": "Shared semantic-release config for rozomod app presets (no npm publish).",
  "type": "module",
  "license": "MIT",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/rozomod/kalpam.git", "directory": "packages/semantic-release-config" },
  "exports": { ".": "./index.js", "./package.json": "./package.json" },
  "main": "./index.js",
  "files": ["index.js"],
  "dependencies": {
    "@semantic-release/changelog": "^6.0.3",
    "@semantic-release/commit-analyzer": "^13.0.1",
    "@semantic-release/git": "^10.0.1",
    "@semantic-release/github": "^12.0.8",
    "@semantic-release/release-notes-generator": "^14.1.1",
    "conventional-changelog-conventionalcommits": "^9.3.1"
  },
  "peerDependencies": { "semantic-release": ">=24.0.0" }
}
```

- [ ] **Step 2: Create `packages/semantic-release-config/index.js`**

```js
/** Shared semantic-release config for deployed apps (no npm publish). */
const config = {
  branches: ["main"],
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["@semantic-release/git", { assets: ["CHANGELOG.md"], message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}" }],
    "@semantic-release/github",
  ],
};

export default config;
```

- [ ] **Step 3: Verify it loads + has no npm plugin**

Run: `node -e "import('@kalpam/semantic-release-config').then(m=>{const p=JSON.stringify(m.default.plugins); console.log(!p.includes('@semantic-release/npm') && m.default.branches[0]==='main')})"`
Expected: `true` (after `pnpm install`).

- [ ] **Step 4: Commit**

```bash
git add packages/semantic-release-config
git commit -m "feat(semantic-release-config): add @kalpam/semantic-release-config (app)"
```

---

## Task 8: Canonical `lefthook.yml` (3 stages)

**Files:**
- Create: `lefthook.yml`

- [ ] **Step 1: Create `lefthook.yml`**

```yaml
# Canonical kalpam hooks. Consumers reference this via remotes: + a pinned tag.
pre-commit:
  parallel: true
  jobs:
    - name: oxlint
      glob: '*.{js,jsx,ts,tsx,mjs,cjs}'
      run: pnpm exec oxlint --fix {staged_files}
      stage_fixed: true
    - name: oxfmt
      glob: '*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,yaml,yml}'
      run: pnpm exec oxfmt {staged_files}
      stage_fixed: true

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}

pre-push:
  parallel: true
  commands:
    check-types:
      run: pnpm run check-types
    lint:
      run: pnpm run lint
    test:
      run: pnpm run test
```

- [ ] **Step 2: Add commitlint to the root devDeps so the hook resolves**

Edit root `package.json` `devDependencies` to add:
```json
"@commitlint/cli": "^21.0.1",
"@kalpam/commitlint-config": "workspace:*"
```
And create root `commitlint.config.js`:
```js
export { default } from "@kalpam/commitlint-config";
```

- [ ] **Step 3: Install hooks + verify dump**

Run: `pnpm install && pnpm exec lefthook install && pnpm exec lefthook dump`
Expected: dump shows `pre-commit`, `commit-msg`, and `pre-push` sections.

- [ ] **Step 4: Verify the commit-msg hook rejects a bad message**

Run: `git commit --allow-empty -m "bad message" || echo REJECTED`
Expected: `REJECTED` (commit-msg hook fails on the non-conventional message).

- [ ] **Step 5: Commit (with a conventional message, so the hook passes)**

```bash
git add lefthook.yml commitlint.config.js package.json
git commit -m "chore: add canonical lefthook hooks (pre-commit, commit-msg, pre-push)"
```

---

## Task 9: Renovate shared preset `default.json`

**Files:**
- Create: `default.json`

- [ ] **Step 1: Create `default.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard", ":semanticCommits", "schedule:weekly"],
  "rangeStrategy": "bump",
  "lockFileMaintenance": { "enabled": true, "schedule": ["before 5am on monday"] },
  "packageRules": [
    {
      "description": "Atomic kalpam release: group the @kalpam/* npm bumps with the rozomod/kalpam git-tag refs (copier + lefthook)",
      "matchPackageNames": ["@kalpam/**", "rozomod/kalpam"],
      "groupName": "kalpam release",
      "automerge": true,
      "automergeType": "pr",
      "minimumReleaseAge": "3 days"
    },
    { "description": "Never auto-merge majors", "matchUpdateTypes": ["major"], "automerge": false },
    { "description": "Pin GitHub Actions to digests", "matchManagers": ["github-actions"], "pinDigests": true }
  ],
  "copier": { "enabled": true, "versioning": "semver" },
  "customManagers": [
    {
      "customType": "regex",
      "description": "Bump the lefthook remote ref to the latest rozomod/kalpam tag",
      "managerFilePatterns": ["/(^|/)lefthook\\.ya?ml$/"],
      "matchStrings": ["git_url:\\s*https://github\\.com/(?<depName>rozomod/kalpam)[\\s\\S]*?ref:\\s*(?<currentValue>v[0-9][0-9.]*)"],
      "datasourceTemplate": "github-tags"
    },
    {
      "customType": "regex",
      "description": "Bump Cloudflare wrangler compatibility_date to the latest workerd release date",
      "managerFilePatterns": ["/(^|/)wrangler\\.jsonc?$/"],
      "matchStrings": ["\"compatibility_date\"\\s*:\\s*\"(?<currentValue>\\d{4}-\\d{2}-\\d{2})\""],
      "depNameTemplate": "cloudflare/workerd",
      "packageNameTemplate": "cloudflare/workerd",
      "datasourceTemplate": "github-releases",
      "extractVersionTemplate": "^v1\\.(?<version>\\d{8})\\.\\d+$",
      "versioningTemplate": "regex:^v?1?\\.?(?<major>\\d{4})-?(?<minor>\\d{2})-?(?<patch>\\d{2})(\\.\\d+)?$"
    }
  ]
}
```

> Consumers must list `"custom.regex"` (namespaced) in `enabledManagers` for the two customManagers to run — that lives in the per-preset `renovate.json` (Slice 1).

- [ ] **Step 2: Validate the config**

Run: `pnpm dlx --package renovate renovate-config-validator default.json`
Expected: `Config validated successfully` (no errors).

- [ ] **Step 3: Commit**

```bash
git add default.json
git commit -m "feat(renovate): add shared default.json preset (atomic group + custom managers)"
```

---

## Task 10: Release scripts (`set-version`, `publish-all`) with tests

**Files:**
- Create: `scripts/set-version.mjs`, `scripts/publish-all.mjs`, `scripts/release.mjs`
- Test: `scripts/set-version.test.mjs`

> The six publishable packages are the single source of truth — keep the `PACKAGES` list in sync.

- [ ] **Step 1: Write the failing test for `set-version`**

`scripts/set-version.test.mjs`:
```js
import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("set-version stamps the version into every package", () => {
  const root = mkdtempSync(join(tmpdir(), "kalpam-"));
  for (const p of ["packages/tsconfig", "packages/oxlint-config"]) {
    mkdirSync(join(root, p), { recursive: true });
    writeFileSync(join(root, p, "package.json"), JSON.stringify({ name: p, version: "0.0.0" }));
  }
  execFileSync("node", [join(import.meta.dirname, "set-version.mjs"), "1.2.3"], {
    cwd: root,
    env: { ...process.env, KALPAM_PACKAGES: "packages/tsconfig,packages/oxlint-config" },
  });
  const v = JSON.parse(readFileSync(join(root, "packages/tsconfig/package.json"), "utf8")).version;
  expect(v).toBe("1.2.3");
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm exec vitest run scripts/set-version.test.mjs`
Expected: FAIL (`set-version.mjs` does not exist).

- [ ] **Step 3: Write `scripts/set-version.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGES = (process.env.KALPAM_PACKAGES ??
  "packages/tsconfig,packages/oxlint-config,packages/oxfmt-config,packages/vitest-config,packages/commitlint-config,packages/semantic-release-config"
).split(",");

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) {
  console.error(`Invalid/missing version: "${version}"`);
  process.exit(1);
}
const root = process.cwd();
for (const dir of PACKAGES) {
  const file = resolve(root, dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`set ${pkg.name} -> ${version}`);
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `pnpm exec vitest run scripts/set-version.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write `scripts/publish-all.mjs`**

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGES = [
  "packages/tsconfig", "packages/oxlint-config", "packages/oxfmt-config",
  "packages/vitest-config", "packages/commitlint-config", "packages/semantic-release-config",
];
const root = process.cwd();
for (const dir of PACKAGES) {
  const cwd = resolve(root, dir);
  const { name, version } = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  let exists = false;
  try { execFileSync("npm", ["view", `${name}@${version}`, "version"], { stdio: "ignore" }); exists = true; } catch {}
  if (exists) { console.log(`skip ${name}@${version} (already published)`); continue; }
  console.log(`publish ${name}@${version}`);
  execFileSync("npm", ["publish", "--access", "public"], { cwd, stdio: "inherit" });
}
```

- [ ] **Step 6: Write `scripts/release.mjs` (local fallback)**

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
const root = process.cwd();
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? "")) { console.error("Usage: node scripts/release.mjs <X.Y.Z>"); process.exit(1); }
const sh = (c, a) => execFileSync(c, a, { cwd: root, stdio: "inherit" });
if (execFileSync("git", ["status", "--porcelain"], { cwd: root }).toString().trim()) { console.error("Working tree not clean."); process.exit(1); }
sh("node", ["scripts/set-version.mjs", version]);
sh("pnpm", ["-r", "run", "build", "--if-present"]);
sh("git", ["commit", "-am", `chore(release): v${version} [skip ci]`]);
sh("git", ["tag", `v${version}`]);
sh("node", ["scripts/publish-all.mjs"]);
sh("git", ["push", "--follow-tags"]);
console.log(`Released v${version}.`);
```

- [ ] **Step 7: Commit**

```bash
git add scripts
git commit -m "feat(release): add set-version, publish-all, release scripts (6 packages) + test"
```

---

## Task 11: GitHub Actions — `ci.yml` + `release.yml`

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm check-types
      - run: pnpm lint
      - run: pnpm test
```

- [ ] **Step 2: Create `.github/workflows/release.yml`**

```yaml
name: release
on:
  push:
    tags: ["v*.*.*"]
permissions:
  contents: read
  id-token: write # npm OIDC trusted publishing
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: "https://registry.npmjs.org"
      - run: npm install -g npm@latest # >= 11.5.1 for OIDC
      - run: pnpm install --frozen-lockfile
      - run: node scripts/set-version.mjs "${GITHUB_REF_NAME#v}"
      - run: pnpm -r run build --if-present
      - run: node scripts/publish-all.mjs
```

- [ ] **Step 3: Validate workflow YAML**

Run: `pnpm dlx --package=js-yaml js-yaml .github/workflows/release.yml > /dev/null && echo YAML-OK`
Expected: `YAML-OK`.

- [ ] **Step 4: Commit**

```bash
git add .github
git commit -m "ci: add ci.yml and OIDC release.yml workflows"
```

---

## Task 12: GitHub remote + full local verification

- [ ] **Step 1: Create the GitHub repo + push**

Run (needs `gh auth login` first; if `gh` isn't authed, run with the `!` prefix in your terminal):
```bash
gh repo create rozomod/kalpam --public --source=/Users/razi.rasheed/Developer/POCs/kalpam --remote=origin --push
```
Expected: repo created, `main` pushed.

- [ ] **Step 2: Full local gate**

Run: `pnpm install && pnpm build && pnpm check-types && pnpm test && pnpm lint && pnpm check-format`
Expected: all green.

---

## Task 13: First release — bootstrap publish, Trusted Publishers, cut `v0.1.0`

> Hazard H3/H5: scoped packages need `--access public` (set via `publishConfig`); OIDC can only attach to a package that already exists, so the FIRST publish is manual.

- [ ] **Step 1: Stamp + build at 0.1.0 locally**

Run: `node scripts/set-version.mjs 0.1.0 && pnpm -r run build --if-present`
Expected: all six `package.json` show `0.1.0`; builds succeed.

- [ ] **Step 2: One-time bootstrap publish (manual, with `npm login`)**

Run (after `npm login` as `rozomod`):
```bash
node scripts/publish-all.mjs
```
Expected: all six `@kalpam/*` packages published at `0.1.0` (provenance not generated locally — that's fine for the bootstrap).

- [ ] **Step 3: Configure npm Trusted Publishers (manual, npmjs.com)**

For each of the six packages → Settings → Trusted Publisher → GitHub Actions: org `rozomod`, repo `kalpam`, workflow `release.yml`, environment `release`, allowed action `npm publish`.

- [ ] **Step 4: Tag + push to drive the OIDC release path**

Run:
```bash
git commit -am "chore(release): v0.1.0" || true
git tag v0.1.0
git push origin main --follow-tags
```
Expected: `release.yml` runs; `publish-all.mjs` logs `skip @kalpam/...@0.1.0 (already published)` for all six (idempotent — no double publish).

- [ ] **Step 5: Verify all six are live at 0.1.0**

Run:
```bash
for p in tsconfig oxlint-config oxfmt-config vitest-config commitlint-config semantic-release-config; do npm view @kalpam/$p version; done
```
Expected: `0.1.0` printed six times.

- [ ] **Step 6: Install the Mend Renovate GitHub App** on `rozomod`, granting access to `kalpam` (and future preset repos).

---

## Done criteria for Slice 0
All six `@kalpam/*` packages published at `0.1.0`; `pnpm build/check-types/test/lint/check-format` green; lefthook hooks fire (pre-commit, commit-msg, pre-push); `renovate-config-validator` passes `default.json`; tag `v0.1.0` exists (the ref the preset + lefthook + Renovate will pin). **Slice 1 (the `vite-tanstack-hono-d1-cf` preset) is the next plan and consumes these published packages.**
