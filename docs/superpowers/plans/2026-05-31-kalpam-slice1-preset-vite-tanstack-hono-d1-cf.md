# kalpam Slice 1 — Preset `vite-tanstack-hono-d1-cf` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first kalpam preset — a Copier template that scaffolds a unified Vite + React + TanStack Router SPA + Hono API + Drizzle + Cloudflare D1 app deployed as a single Worker + Static Assets — and prove it end-to-end (generate → build → test against real D1 → deploy → OTA).

**Architecture:** The template lives in the `rozomod/kalpam` repo under `presets/vite-tanstack-hono-d1-cf/template/`, selected by a root `copier.yml` `_subdirectory`. Generated projects consume the `@kalpam/*` packages (Slice 0) and stay current via the shared Renovate preset + Copier. The app is **one** Vite project: `@cloudflare/vite-plugin`'s `cloudflare()` runs the Hono Worker in real workerd during dev with local D1; static assets + SPA fallback are platform-handled; the Worker runs only for `/api/*`.

**Tech Stack (frozen matrix):** vite **^7** · @vitejs/plugin-react ^5 · react/react-dom ^19.2 · @tanstack/react-router ^1.170 · @tanstack/router-plugin ^1.168 · hono ^4.12.23 · drizzle-orm ^0.45.2 · drizzle-kit ^0.31.10 · @cloudflare/vite-plugin ^1.39.0 · wrangler ^4.95.0 · @cloudflare/vitest-pool-workers ^0.16.10 · vitest ^4.1.7 · @cloudflare/workers-types ^4.20260530 · semantic-release ^25 · Copier ≥9.2.

**Prerequisite:** Slice 0 is built and published — `@kalpam/{tsconfig,oxlint-config,oxfmt-config,vitest-config,commitlint-config,semantic-release-config}` live on npm; `rozomod/kalpam` has `lefthook.yml`, `default.json`, and the OIDC `release.yml`. Spec: `docs/superpowers/specs/2026-05-31-kalpam-base-and-cf-preset-design.md`.

> **Reconciliation fixes applied (do not revert to the raw component specs):** `enabledManagers` uses **`custom.regex`** (namespaced); `@cloudflare/vitest-pool-workers ^0.16.10` with the **`cloudflareTest()`** plugin (the old `defineWorkersConfig` is removed); deploy is a **`deploy` job `needs: release`** inside `release.yml` (a `GITHUB_TOKEN` release fires neither `on: release` nor `on: push: tags`); semantic-release config is **consumed from `@kalpam/semantic-release-config`** via `.releaserc.json` `extends` (no inlined plugins); seed **`commitlint.config.js`** (not `.ts`); migrations live at **`apps/web/migrations`**; worker entry at **`apps/web/src/worker/index.ts`**; client under **`apps/web/src/client/`**; ship **both `AGENTS.md` and a `CLAUDE.md` (`@AGENTS.md`)** at each level (Claude Code does not read `AGENTS.md`); import the **default** export of `@kalpam/vitest-config`.

> **TDD note:** template config/source files are authored then validated by the end-to-end generation (Task 11) — that generation, plus the generated app's own Vitest suite hitting real D1, is the integration test. The app's API logic is built TDD-first in Task 7 (write `api.test.ts` → see it fail → implement the route → see it pass).

---

## Task 1: Preset directory + `copier.yml`

**Files:**
- Create: `copier.yml`, `presets/vite-tanstack-hono-d1-cf/template/` (dir), `presets/vite-tanstack-hono-d1-cf/template/_agents/` (dir)

- [ ] **Step 1: Ensure Copier is available**

Run: `uv tool install copier || pipx install copier; copier --version`
Expected: prints a version `>= 9.2.0`.

- [ ] **Step 2: Create `copier.yml` at the kalpam repo root**

```yaml
_min_copier_version: "9.2.0"
_subdirectory: presets/vite-tanstack-hono-d1-cf/template
_templates_suffix: .jinja
_answers_file: .copier-answers.yml

project_name:
  type: str
  help: "Project name (kebab-case; used as package/worker name and repo slug)"
  validator: >-
    {% if not (project_name | regex_search('^[a-z][a-z0-9-]*[a-z0-9]$')) %}
    project_name must be kebab-case (a-z, 0-9, hyphens).
    {% endif %}

cloudflare_d1_database_name:
  type: str
  help: "Cloudflare D1 database name (the binding stays DB)"
  default: "{{ project_name }}-db"

_tasks:
  - command: "pnpm install"
    when: "{{ _copier_operation == 'copy' }}"
  - command: "pnpm exec lefthook install"
    when: "{{ _copier_operation == 'copy' }}"
```

- [ ] **Step 3: Create the template directories**

Run: `mkdir -p presets/vite-tanstack-hono-d1-cf/template/_agents`
Expected: dirs exist.

- [ ] **Step 4: Verify `copier.yml` is valid YAML**

Run: `pnpm dlx --package=js-yaml js-yaml copier.yml > /dev/null && echo YAML-OK`
Expected: `YAML-OK`.

- [ ] **Step 5: Commit**

```bash
git add copier.yml presets
git commit -m "feat(preset): scaffold vite-tanstack-hono-d1-cf Copier template + copier.yml"
```

---

## Task 2: AGENTS.md fragments + assembled shells + CLAUDE.md bridges

**Files (all under `presets/vite-tanstack-hono-d1-cf/template/`):**
- Create: `_agents/base-tooling.md`, `_agents/monorepo-map.md`, `_agents/commits-release.md`, `_agents/cloudflare-deploy.md`, `_agents/vite-tanstack-spa.md`, `_agents/hono-api.md`, `_agents/drizzle-d1.md`
- Create: `AGENTS.md.jinja`, `CLAUDE.md.jinja`, `apps/web/AGENTS.md.jinja`, `apps/web/CLAUDE.md.jinja`, `apps/web/src/worker/AGENTS.md.jinja`, `apps/web/src/worker/CLAUDE.md.jinja`, `packages/db/AGENTS.md.jinja`, `packages/db/CLAUDE.md.jinja`

> Fragments are variable-free markdown partials; the leading `_agents/` underscore keeps Copier's default `_exclude` (`_*`) from emitting them, while Jinja `{% include %}` still reads them. Each emitted `AGENTS.md` is a thin shell that includes the fragments for its level. A sibling `CLAUDE.md` is a one-line `@AGENTS.md` so Claude Code picks it up.

- [ ] **Step 1: Create `_agents/base-tooling.md`**

```markdown
## Tooling
- Package manager: **pnpm 11** (workspaces). Node **24** (`nvm use`). Turborepo orchestrates `build`/`check-types`/`test`/`dev`.
- Lint/format: **oxlint** + **oxfmt** (config from `@kalpam/*`). Run `pnpm lint` / `pnpm format`. Never hand-format; let oxfmt own style.
- Tests: **Vitest 4**. App tests run in the Cloudflare Workers pool (real workerd + local D1).
- Git hooks (lefthook): pre-commit lints/formats staged files; commit-msg enforces Conventional Commits; pre-push runs typecheck + lint + test. Do not bypass with `--no-verify`.
```

- [ ] **Step 2: Create `_agents/monorepo-map.md`**

```markdown
## Layout
- `apps/web` — the deployable: Vite SPA (`src/client`) **and** the Hono Worker (`src/worker`) in one package, deployed as a single Cloudflare Worker + Static Assets.
- `packages/db` — Drizzle schema + D1 helpers (`@<project>/db`). Imported by the worker via `workspace:*`.
- Generated config (`tsconfig`, oxlint, oxfmt, vitest, commitlint, semantic-release) extends the published `@kalpam/*` packages — edit those upstream in `rozomod/kalpam`, not here.
```

- [ ] **Step 3: Create `_agents/commits-release.md`**

```markdown
## Commits & releases
- **Conventional Commits** required (`feat:`, `fix:`, `chore:`, …). The commit-msg hook rejects non-conforming messages.
- Releases are automated by **semantic-release** on merge to `main`: it computes the next semver, writes `CHANGELOG.md`, tags, and creates a GitHub Release. This is an **app**, so there is **no npm publish**.
- The release tag **gates the Cloudflare deploy** (the `deploy` job runs only after a release is cut). Do not deploy manually from `main`.
```

- [ ] **Step 4: Create `_agents/cloudflare-deploy.md`**

```markdown
## Cloudflare deploy
- One Worker serves everything: static SPA assets + the Hono API. **One origin, no CORS** — never add CORS middleware.
- `wrangler.jsonc` is the source of truth for bindings. After editing it, run `pnpm cf-typegen` (`wrangler types`) to regenerate `worker-configuration.d.ts`.
- `run_worker_first: ["/api/*"]` routes API paths to the Worker; everything else is the SPA (`not_found_handling: single-page-application`). Do not set `assets.directory` — the Vite plugin supplies it.
- D1 binding is `DB`. The remote `database_id` is filled after `wrangler d1 create`; secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) live in CI, never in the repo.
```

- [ ] **Step 5: Create `_agents/vite-tanstack-spa.md`**

```markdown
## SPA (src/client)
- **TanStack Router**, file-based routes in `src/client/routes/`. `routeTree.gen.ts` is generated (gitignored) — never edit it by hand; the `tanstackRouter` Vite plugin regenerates it.
- The plugin order in `vite.config.ts` is load-bearing: `tanstackRouter()` → `react()` → `cloudflare()`.
- Call the API with the typed Hono client (`hc<AppType>`), importing **only** `type { AppType }` from the worker — no server code in the client bundle. Target relative `/api/...`.
```

- [ ] **Step 6: Create `_agents/hono-api.md`**

```markdown
## API (src/worker)
- The Worker entry (`src/worker/index.ts`) is a Hono app: `new Hono<{ Bindings: Env }>()`, routes mounted under `/api`, `export default app`.
- Export `type AppType = typeof app` for the client. Bindings come from the `wrangler types`-generated global `Env`.
- Access D1 via `createDb(c.env.DB)` from `@<project>/db`. Do not open raw D1 statements in route handlers when a Drizzle query exists.
- No catch-all route — non-`/api` paths are served by the SPA asset layer before the Worker runs.
```

- [ ] **Step 7: Create `_agents/drizzle-d1.md`**

```markdown
## Data (packages/db)
- Schema in `packages/db/src/schema.ts` using `drizzle-orm/sqlite-core` (D1 is SQLite).
- Workflow: edit schema → `pnpm db:generate` (drizzle-kit writes SQL to `apps/web/migrations`) → `pnpm db:migrate:local` (or `:remote`). **Never hand-edit generated migration files.**
- `wrangler` owns the D1 migration-history table; `migrations_dir` in `wrangler.jsonc` points at the same `apps/web/migrations` directory drizzle-kit writes to.
```

- [ ] **Step 8: Create the root `AGENTS.md.jinja` shell**

```jinja
# {{ project_name }} — agent guide

{% include "_agents/base-tooling.md" %}

{% include "_agents/monorepo-map.md" %}

{% include "_agents/commits-release.md" %}

{% include "_agents/cloudflare-deploy.md" %}
```

- [ ] **Step 9: Create the nested shells**

`apps/web/AGENTS.md.jinja`:
```jinja
# apps/web — agent guide

{% include "_agents/vite-tanstack-spa.md" %}

{% include "_agents/cloudflare-deploy.md" %}
```

`apps/web/src/worker/AGENTS.md.jinja`:
```jinja
# Worker / API — agent guide

{% include "_agents/hono-api.md" %}
```

`packages/db/AGENTS.md.jinja`:
```jinja
# packages/db — agent guide

{% include "_agents/drizzle-d1.md" %}
```

- [ ] **Step 10: Create the four `CLAUDE.md.jinja` bridges** (root, `apps/web`, `apps/web/src/worker`, `packages/db`) — each identical:

```jinja
@AGENTS.md
```

- [ ] **Step 11: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template
git commit -m "feat(preset): add AGENTS.md fragments, assembled shells, CLAUDE.md bridges"
```

---

## Task 3: Template root files

**Files (under `presets/vite-tanstack-hono-d1-cf/template/`):** `package.json.jinja`, `pnpm-workspace.yaml.jinja`, `turbo.json.jinja`, `.nvmrc.jinja`, `.gitignore.jinja`, `tsconfig.json.jinja`, `oxlint.config.ts.jinja`, `oxfmt.config.ts.jinja`, `vitest.config.ts.jinja`, `commitlint.config.js.jinja`, `lefthook.yml.jinja`, `renovate.json.jinja`, `.releaserc.json.jinja`, `README.md.jinja`, `{{ _copier_conf.answers_file }}.jinja`

- [ ] **Step 1: Create `package.json.jinja`** (root of the generated project)

```jinja
{
  "name": "{{ project_name }}",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix .",
    "format": "oxfmt .",
    "check-format": "oxfmt --check .",
    "check-types": "turbo run check-types",
    "test": "turbo run test",
    "db:generate": "pnpm --filter @{{ project_name }}/db db:generate",
    "db:migrate:local": "pnpm --filter web exec wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "pnpm --filter web exec wrangler d1 migrations apply DB --remote",
    "db:studio": "pnpm --filter @{{ project_name }}/db db:studio",
    "deploy": "pnpm --filter web run deploy",
    "cf-typegen": "pnpm --filter web exec wrangler types",
    "prepare": "lefthook install"
  },
  "devDependencies": {
    "@kalpam/tsconfig": "^0.1.0",
    "@kalpam/oxlint-config": "^0.1.0",
    "@kalpam/oxfmt-config": "^0.1.0",
    "@kalpam/vitest-config": "^0.1.0",
    "@kalpam/commitlint-config": "^0.1.0",
    "@kalpam/semantic-release-config": "^0.1.0",
    "@commitlint/cli": "^21.0.1",
    "deepmerge-ts": "^7.1.5",
    "lefthook": "^2.1.9",
    "oxfmt": "^0.52.0",
    "oxlint": "^1.67.0",
    "semantic-release": "^25.0.3",
    "turbo": "^2.9.16",
    "typescript": "5.9.2",
    "vitest": "^4.1.7"
  },
  "engines": { "node": ">=24" },
  "packageManager": "pnpm@11.0.8"
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml.jinja`**

```jinja
packages:
  - 'apps/*'
  - 'packages/*'

allowBuilds:
  esbuild: true
  lefthook: true
  workerd: true
```

- [ ] **Step 3: Create `turbo.json.jinja`**

```jinja
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": { "dependsOn": ["^build", "db:generate"], "outputs": ["dist/**", ".wrangler/**"] },
    "dev": { "cache": false, "persistent": true },
    "check-types": { "dependsOn": ["^build", "db:generate"] },
    "test": { "dependsOn": ["db:generate"], "outputs": ["coverage/**"] },
    "db:generate": { "cache": false, "outputs": ["../../apps/web/migrations/**"] }
  }
}
```

- [ ] **Step 4: Create `.nvmrc.jinja`** → `24`

- [ ] **Step 5: Create `.gitignore.jinja`**

```jinja
node_modules
dist
.turbo
.wrangler
.dev.vars
coverage
*.tsbuildinfo
.DS_Store
*.log
apps/web/src/client/routeTree.gen.ts
apps/web/worker-configuration.d.ts
```

- [ ] **Step 6: Create `tsconfig.json.jinja`** (solution root)

```jinja
{ "files": [], "references": [{ "path": "./apps/web" }, { "path": "./packages/db" }] }
```

- [ ] **Step 7: Create `oxlint.config.ts.jinja`** (env re-declared per oxc#20087)

```jinja
import { defineConfig } from "oxlint";
import rozomod from "@kalpam/oxlint-config";

export default defineConfig({
  extends: [rozomod],
  env: { browser: true, node: true, es2024: true },
});
```

- [ ] **Step 8: Create `oxfmt.config.ts.jinja`** (deepmerge-ts, not classic deepmerge)

```jinja
import { deepmerge } from "deepmerge-ts";
import shared from "@kalpam/oxfmt-config/oxfmt" with { type: "json" };

export default deepmerge(shared, {
  // project-local oxfmt overrides (deep-merged over the shared config)
});
```

- [ ] **Step 9: Create root `vitest.config.ts.jinja`** (workspace projects; the CF pool config lives in `apps/web`)

```jinja
import { defineConfig } from "vitest/config";

// Each package owns its own vitest config (apps/web uses the Workers pool).
// This root config only defines the project glob; it does NOT run apps/web in the default pool.
export default defineConfig({
  test: { projects: ["packages/*", "apps/web"] },
});
```

- [ ] **Step 10: Create `commitlint.config.js.jinja`**

```jinja
export { default } from "@kalpam/commitlint-config";
```

- [ ] **Step 11: Create `lefthook.yml.jinja`** (remote canonical hooks + local commit-msg)

```jinja
remotes:
  - git_url: https://github.com/rozomod/kalpam
    ref: {{ _copier_answers._commit | default("v0.1.0") }}
    configs:
      - lefthook.yml

commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}
```

- [ ] **Step 12: Create `renovate.json.jinja`**

```jinja
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>rozomod/kalpam#{{ _copier_answers._commit | default('v0.1.0') }}"],
  "enabledManagers": ["npm", "github-actions", "nvm", "copier", "custom.regex"]
}
```

- [ ] **Step 13: Create `.releaserc.json.jinja`** (consumes the shared config package)

```jinja
{ "extends": "@kalpam/semantic-release-config" }
```

- [ ] **Step 14: Create `README.md.jinja`**

```jinja
# {{ project_name }}

Vite + React + TanStack Router SPA · Hono API · Drizzle + Cloudflare D1, deployed as a single Cloudflare Worker. Bootstrapped from [rozomod/kalpam](https://github.com/rozomod/kalpam).

## Develop
```bash
nvm use && corepack enable && pnpm install
pnpm exec wrangler d1 create {{ cloudflare_d1_database_name }}   # paste database_id into apps/web/wrangler.jsonc
pnpm db:generate && pnpm db:migrate:local
pnpm dev    # http://localhost:5173 (SPA + /api on one origin)
```

## Deploy
Push to `main` with Conventional Commits → semantic-release cuts a tag → the deploy job ships to Cloudflare. Set repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
```

- [ ] **Step 15: Create `{{ _copier_conf.answers_file }}.jinja`**

```jinja
# Changes here will be overwritten by Copier; NEVER EDIT MANUALLY
{{ _copier_answers|to_nice_yaml -}}
```

- [ ] **Step 16: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template
git commit -m "feat(preset): add template root files (configs, lefthook, renovate, releaserc)"
```

---

## Task 4: `packages/db` (Drizzle schema + D1 helper)

**Files (under `.../template/packages/db/`):** `package.json.jinja`, `tsconfig.json.jinja`, `drizzle.config.ts.jinja`, `src/schema.ts.jinja`, `src/index.ts.jinja`

- [ ] **Step 1: Create `packages/db/package.json.jinja`**

```jinja
{
  "name": "@{{ project_name }}/db",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./schema": "./src/schema.ts" },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:studio": "drizzle-kit studio",
    "check-types": "tsc -p tsconfig.json"
  },
  "dependencies": { "drizzle-orm": "^0.45.2" },
  "devDependencies": {
    "@kalpam/tsconfig": "^0.1.0",
    "@cloudflare/workers-types": "^4.20260530.0",
    "drizzle-kit": "^0.31.10",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json.jinja`**

```jinja
{
  "extends": "@kalpam/tsconfig/node.json",
  "compilerOptions": { "types": ["@cloudflare/workers-types"], "noEmit": true },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `packages/db/src/schema.ts.jinja`**

```jinja
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
```

- [ ] **Step 4: Create `packages/db/src/index.ts.jinja`**

```jinja
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
export * from "./schema.js";
```

- [ ] **Step 5: Create `packages/db/drizzle.config.ts.jinja`** (out → `apps/web/migrations`, the single migrations dir)

```jinja
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/schema.ts",
  out: "../../apps/web/migrations",
  // d1-http creds (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN)
  // are only needed for `push`/`studio`/remote inspection — `generate` works offline.
});
```

- [ ] **Step 6: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template/packages/db
git commit -m "feat(preset): add packages/db (Drizzle schema + D1 helper)"
```

---

## Task 5: `apps/web` shell (Vite + Cloudflare config)

**Files (under `.../template/apps/web/`):** `package.json.jinja`, `vite.config.ts.jinja`, `wrangler.jsonc.jinja`, `tsconfig.json.jinja`, `tsconfig.node.json.jinja`, `index.html.jinja`

- [ ] **Step 1: Create `apps/web/package.json.jinja`**

```jinja
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "wrangler deploy",
    "check-types": "tsc -b",
    "test": "vitest run",
    "cf-typegen": "wrangler types"
  },
  "dependencies": {
    "@{{ project_name }}/db": "workspace:*",
    "hono": "^4.12.23",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@tanstack/react-router": "^1.170.9"
  },
  "devDependencies": {
    "@kalpam/tsconfig": "^0.1.0",
    "@kalpam/vitest-config": "^0.1.0",
    "@cloudflare/vite-plugin": "^1.39.0",
    "@cloudflare/vitest-pool-workers": "^0.16.10",
    "@cloudflare/workers-types": "^4.20260530.0",
    "@tanstack/router-plugin": "^1.168.12",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.0.0",
    "@vitest/coverage-istanbul": "^4.1.7",
    "vite": "^7.0.0",
    "vitest": "^4.1.7",
    "wrangler": "^4.95.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/vite.config.ts.jinja`** (plugin order is load-bearing)

```jinja
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/client/routes",
      generatedRouteTree: "./src/client/routeTree.gen.ts",
    }),
    react(),
    cloudflare(),
  ],
});
```

- [ ] **Step 3: Create `apps/web/wrangler.jsonc.jinja`**

```jinja
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "{{ project_name }}",
  "main": "./src/worker/index.ts",
  "compatibility_date": "2026-05-30",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "{{ cloudflare_d1_database_name }}",
      "database_id": "REPLACE_WITH_D1_DATABASE_ID",
      "migrations_dir": "migrations"
    }
  ],
  "observability": { "enabled": true }
}
```

- [ ] **Step 4: Create `apps/web/tsconfig.json.jinja`** (app/client — DOM + JSX, references the worker via node config)

```jinja
{
  "extends": "@kalpam/tsconfig/react.json",
  "compilerOptions": {
    "types": ["vite/client", "@cloudflare/workers-types"],
    "paths": { "@/*": ["./src/client/*"] },
    "baseUrl": "."
  },
  "include": ["src", "worker-configuration.d.ts", "test"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create `apps/web/tsconfig.node.json.jinja`** (vite.config / tooling)

```jinja
{
  "extends": "@kalpam/tsconfig/node.json",
  "compilerOptions": { "composite": true, "noEmit": true, "moduleResolution": "Bundler" },
  "include": ["vite.config.ts", "vitest.config.ts", "drizzle.config.ts"]
}
```

- [ ] **Step 6: Create `apps/web/index.html.jinja`**

```jinja
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ project_name }}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template/apps/web
git commit -m "feat(preset): add apps/web shell (vite, wrangler, tsconfigs, index.html)"
```

---

## Task 6: `apps/web` client (TanStack Router SPA)

**Files (under `.../template/apps/web/src/client/`):** `main.tsx.jinja`, `routeTree.gen.ts.jinja` (placeholder; regenerated), `routes/__root.tsx.jinja`, `routes/index.tsx.jinja`

- [ ] **Step 1: Create `src/client/routes/__root.tsx.jinja`**

```jinja
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => <Outlet />,
});
```

- [ ] **Step 2: Create `src/client/routes/index.tsx.jinja`** (calls the typed Hono client)

```jinja
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hc } from "hono/client";
import type { AppType } from "../../worker/index";

const api = hc<AppType>("/");

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    api.api.posts
      .$get()
      .then((r) => r.json())
      .then((posts) => setSlugs(posts.map((p) => p.slug)));
  }, []);
  return (
    <main>
      <h1>{{ project_name }}</h1>
      <ul>{slugs.map((s) => <li key={s}>{s}</li>)}</ul>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/client/main.tsx.jinja`**

```jinja
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- [ ] **Step 4: Create `src/client/routeTree.gen.ts.jinja`** (committed placeholder so first typecheck before `dev`/`build` resolves; regenerated by the plugin)

```jinja
// Placeholder — regenerated by @tanstack/router-plugin on dev/build. Do not edit.
import { createRootRoute } from "@tanstack/react-router";
export const routeTree = createRootRoute();
```

> Note: `.gitignore` excludes `routeTree.gen.ts` in the *generated* project, but the template ships this placeholder so a fresh checkout type-checks before the first `vite` run. The plugin overwrites it on `dev`/`build`.

- [ ] **Step 5: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template/apps/web/src/client
git commit -m "feat(preset): add TanStack Router SPA client (root, index, main)"
```

---

## Task 7: `apps/web` worker + API (TDD) + Vitest workers-pool setup

**Files (under `.../template/apps/web/`):** `src/worker/index.ts.jinja`, `vitest.config.ts.jinja`, `test/apply-migrations.ts.jinja`, `test/env.d.ts.jinja`, `test/api.test.ts.jinja`, `worker-configuration.d.ts.jinja`

> This is the one place with real runtime logic, so it is built test-first. The test/worker `.jinja` files are written so that when a project is generated, its `pnpm test` exercises the Hono route against real (local) D1.

- [ ] **Step 1: Create the Vitest workers-pool config `apps/web/vitest.config.ts.jinja`** (new `cloudflareTest()` API; default import of the shared config)

```jinja
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig, defineProject, mergeConfig } from "vitest/config";
import shared from "@kalpam/vitest-config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return mergeConfig(
    shared,
    defineProject({
      plugins: [
        cloudflareTest({
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
        }),
      ],
      test: {
        setupFiles: ["./test/apply-migrations.ts"],
        include: ["test/**/*.test.ts"],
        coverage: { provider: "istanbul" },
      },
    }),
  );
});
```

> `coverage.provider` is overridden to `istanbul` because the base config's `v8` provider is broken inside `workerd`.

- [ ] **Step 2: Create `apps/web/test/apply-migrations.ts.jinja`** (idempotent per-file D1 migration)

```jinja
import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

- [ ] **Step 3: Create `apps/web/test/env.d.ts.jinja`**

```jinja
declare module "cloudflare:test" {
  interface ProvidedEnv extends Cloudflare.Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
```

- [ ] **Step 4: Write the failing API test `apps/web/test/api.test.ts.jinja`**

```jinja
import { env, exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

describe("api /api/posts", () => {
  it("round-trips a post through D1", async () => {
    const created = await exports.default.fetch("https://example.com/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "hello", body: "world" }),
    });
    expect(created.status).toBe(201);

    const got = await exports.default.fetch("https://example.com/api/posts");
    expect(got.status).toBe(200);
    const posts = (await got.json()) as Array<{ slug: string }>;
    expect(posts.map((p) => p.slug)).toContain("hello");
  });

  it("seeds D1 directly then lists via the route", async () => {
    await env.DB.prepare("INSERT INTO posts (slug, body) VALUES (?1, ?2)").bind("seeded", "x").run();
    const res = await exports.default.fetch("https://example.com/api/posts");
    const posts = (await res.json()) as Array<{ slug: string }>;
    expect(posts.map((p) => p.slug)).toContain("seeded");
  });
});
```

- [ ] **Step 5: Create the minimal worker so the test can compile/fail meaningfully — first a stub, then implement**

First create `apps/web/src/worker/index.ts.jinja` as the **full** implementation (the route the test needs):

```jinja
import { Hono } from "hono";
import { createDb, posts } from "@{{ project_name }}/db";

const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  .get("/posts", async (c) => {
    const db = createDb(c.env.DB);
    const rows = await db.select().from(posts).all();
    return c.json(rows);
  })
  .post("/posts", async (c) => {
    const { slug, body } = await c.req.json<{ slug: string; body: string }>();
    const db = createDb(c.env.DB);
    const [row] = await db.insert(posts).values({ slug, body }).returning();
    return c.json(row, 201);
  });

export default app;
export type AppType = typeof app;
```

- [ ] **Step 6: Create the `worker-configuration.d.ts.jinja` placeholder** (regenerated by `wrangler types`; template ships a minimal `Env` so the worker type-checks pre-typegen)

```jinja
// Placeholder — regenerated by `wrangler types` (pnpm cf-typegen). Do not rely on hand edits.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: Fetcher;
  }
}
interface Env extends Cloudflare.Env {}
```

- [ ] **Step 7: Verify (deferred to the generated project)** — the actual red→green TDD cycle runs in Task 11 against a generated project:

In the generated project: `pnpm db:generate && pnpm exec vitest run --dir apps/web` — expect the two `api /api/posts` tests PASS (route implemented, real local D1, migrations applied). If the worker route were missing, they'd fail with a 404 — confirming the test exercises the route.

- [ ] **Step 8: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template/apps/web
git commit -m "feat(preset): add Hono worker + /api/posts route, Vitest workers-pool + D1 tests"
```

---

## Task 8: CI workflows (`ci.yml` + `release.yml` with the deploy job)

**Files (under `.../template/.github/workflows/`):** `ci.yml.jinja`, `release.yml.jinja`

- [ ] **Step 1: Create `ci.yml.jinja`**

```jinja
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
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm lint
      - run: pnpm check-format
      - run: pnpm check-types
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Create `release.yml.jinja`** (release job cuts the tag; deploy job `needs: release` — the only pattern that actually fires, since a `GITHUB_TOKEN` release triggers no `on: release`/`on: push: tags`)

```jinja
name: release
on:
  push:
    branches: [main]
concurrency:
  group: release-${{ '{{' }} github.ref {{ '}}' }}
  cancel-in-progress: false
permissions:
  contents: write
  issues: write
  pull-requests: write
jobs:
  release:
    runs-on: ubuntu-latest
    outputs:
      released: ${{ '{{' }} steps.semrel.outputs.new_release_published {{ '}}' }}
      tag: ${{ '{{' }} steps.semrel.outputs.new_release_git_tag {{ '}}' }}
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm build
      - id: semrel
        run: pnpm exec semantic-release
        env:
          GITHUB_TOKEN: ${{ '{{' }} secrets.GITHUB_TOKEN {{ '}}' }}

  deploy:
    needs: release
    if: needs.release.outputs.released == 'true'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v5
        with: { ref: ${{ '{{' }} needs.release.outputs.tag {{ '}}' }} }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm build
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ '{{' }} secrets.CLOUDFLARE_API_TOKEN {{ '}}' }}
          accountId: ${{ '{{' }} secrets.CLOUDFLARE_ACCOUNT_ID {{ '}}' }}
          workingDirectory: apps/web
          preCommands: npx wrangler d1 migrations apply DB --remote
          command: deploy
```

> The `${{ '{{' }} … {{ '}}' }}` escaping makes Copier/Jinja leave the GitHub Actions `${{ }}` expressions intact (verified: `${{ '{{' }} github.ref {{ '}}' }}` renders to `${{ github.ref }}`). This is the single approach used here — do **not** also wrap the file in `{% raw %}`.

- [ ] **Step 3: Validate YAML**

Run: `for f in presets/vite-tanstack-hono-d1-cf/template/.github/workflows/*.jinja; do sed 's/{% raw %}//;s/{% endraw %}//' "$f" | pnpm dlx --package=js-yaml js-yaml > /dev/null && echo "$f OK"; done`
Expected: both files `OK`.

- [ ] **Step 4: Commit**

```bash
git add presets/vite-tanstack-hono-d1-cf/template/.github
git commit -m "feat(preset): add ci.yml and release.yml (release + needs:release deploy job)"
```

---

## Task 9: Renovate preset additions for the Cloudflare stack

**Files:**
- Modify: `default.json` (kalpam root — created in Slice 0)

- [ ] **Step 1: Add grouping `packageRules` to `default.json`** so the noisy Cloudflare/TanStack deps update together. Insert these objects into the existing `packageRules` array:

```json
{ "description": "Group the Cloudflare stack", "matchPackageNames": ["wrangler", "@cloudflare/**", "miniflare"], "groupName": "cloudflare stack" },
{ "description": "Group TanStack Router", "matchPackageNames": ["@tanstack/**"], "groupName": "tanstack router" }
```

- [ ] **Step 2: Re-validate**

Run: `pnpm dlx --package renovate renovate-config-validator default.json`
Expected: `Config validated successfully`.

- [ ] **Step 3: Commit**

```bash
git add default.json
git commit -m "feat(renovate): group cloudflare stack + tanstack router updates"
```

---

## Task 10: Cut `v0.2.0` (publish packages + make the template available at a tag)

> Slice 0 cut `v0.1.0` (packages only). The template is new content; the consumer pins a tag and Copier copies from a tag, so the template must exist at a published ref. Cutting `v0.2.0` republishes the six packages at `0.2.0` and makes the template available at `gh:rozomod/kalpam` ref `v0.2.0`.

- [ ] **Step 1: Stamp + build + publish + tag**

Run:
```bash
node scripts/set-version.mjs 0.2.0
pnpm -r run build --if-present
git commit -am "feat(preset): release v0.2.0 (vite-tanstack-hono-d1-cf template)"
git tag v0.2.0
git push origin main --follow-tags
```
Expected: `release.yml` (kalpam's own) publishes the six packages at `0.2.0` via OIDC; `npm view @kalpam/tsconfig version` → `0.2.0`.

> The template's `renovate.json.jinja` and `lefthook.yml.jinja` use `{{ _copier_answers._commit }}`, so a project generated with `--vcs-ref v0.2.0` automatically pins `v0.2.0`.

---

## Task 11: End-to-end validation (the integration test)

> Generate a real project, prove it builds/tests/deploys, and confirm OTA. This is the acceptance gate for Slice 1.

- [ ] **Step 1: Generate a project from the tag**

Run:
```bash
cd /tmp
copier copy --trust --vcs-ref v0.2.0 gh:rozomod/kalpam probe-app
cd probe-app
```
Expected: prompts for `project_name` (enter `probe-app`) + `cloudflare_d1_database_name`; `_tasks` run `pnpm install` + `lefthook install`. `.copier-answers.yml` shows `_commit: v0.2.0`, `_src_path: gh:rozomod/kalpam`.

- [ ] **Step 2: Confirm AGENTS fragments did NOT leak**

Run: `test ! -d _agents && test -f AGENTS.md && test -f CLAUDE.md && grep -q '@AGENTS.md' CLAUDE.md && echo CLEAN`
Expected: `CLEAN` (the `_agents/` partials were excluded; root `AGENTS.md` + `CLAUDE.md` bridge emitted). If `_agents/` leaked, add `_exclude: ["_agents"]` to `copier.yml` and re-cut.

- [ ] **Step 3: Provision D1 + migrate locally**

Run:
```bash
git init && git add -A && git commit -m "chore: seed from kalpam"   # clean tree for copier update later
pnpm exec wrangler d1 create probe-app-db    # paste returned database_id into apps/web/wrangler.jsonc
pnpm db:generate
pnpm db:migrate:local
```
Expected: a migration SQL file appears in `apps/web/migrations`; local apply succeeds. (Smoke-test C7: confirm wrangler consumes drizzle-kit's `.sql`; if the journal format conflicts, see the fallback note below.)

- [ ] **Step 4: Run the gate**

Run: `pnpm install && pnpm db:generate && pnpm check-types && pnpm test && pnpm build`
Expected: typecheck clean; the two `api /api/posts` Vitest tests PASS against local D1; `vite build` produces `dist/client` + the worker bundle. (Smoke-test C4/C5: if build complains about assets, add `"directory": "./dist/client"` to `wrangler.jsonc` `assets`; if a runtime needs Node APIs, confirm `nodejs_compat`.)

- [ ] **Step 5: Dev smoke**

Run: `pnpm dev` then `curl -s localhost:5173/api/posts` in another shell.
Expected: SPA serves at `/`, `/api/posts` returns `[]` (or seeded rows) from local D1 — one origin, no CORS. Stop dev.

- [ ] **Step 6: Deploy path**

Push `probe-app` to a new GitHub repo, set repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, then merge a `feat:` commit to `main`.
Expected: `release.yml` `release` job cuts a tag + GitHub Release; the `deploy` job (gated on `released == 'true'`) applies remote D1 migrations and `wrangler deploy`s. Visit the `*.workers.dev` URL — SPA loads, `/api/posts` works against remote D1.

- [ ] **Step 7: Verify OTA**

Run (after installing the Renovate App on the probe repo): `pnpm dlx --package renovate renovate-config-validator renovate.json`
Expected: passes. Then confirm Renovate opens a "Configure Renovate" onboarding PR detecting `.copier-answers.yml` (copier manager) + the `@kalpam/*` deps. Later, cutting kalpam `v0.3.0` should yield one grouped **"kalpam release"** PR bumping the `@kalpam/*` deps **and** the `rozomod/kalpam` refs (copier `_commit` + lefthook `ref`) together.

- [ ] **Step 8: Clean up the probe** — `rm -rf /tmp/probe-app` and delete the probe GitHub repo + D1 db once satisfied.

---

## Done criteria for Slice 1
`copier copy --vcs-ref v0.2.0 gh:rozomod/kalpam` produces a project that: installs, type-checks, passes its Vitest D1 tests, builds, runs in `pnpm dev` (SPA + `/api` on one origin), and deploys to Cloudflare via the release→deploy pipeline; `_agents/` fragments do not leak; Renovate validates and onboards. **Next slices:** the `create-kalpam` Node CLI (Slice 2), more presets (Slice 3), `kalpam.dev` (Slice 4).

## Risk watch-list (smoke-test points, from the design reconciliation)
- **C1** lefthook-`ref` + `compatibility_date` `custom.regex` managers — validate with `renovate-config-validator` + a dry-run.
- **C4/C5** `run_worker_first` shape · `nodejs_compat` · `assets.directory` — confirm on first `vite build` / `wrangler dev`.
- **C6** semantic-release `new_release_published`/`new_release_git_tag` outputs gate the deploy job — confirm via `semantic-release --dry-run`.
- **C7** drizzle-kit migration folder vs wrangler's flat `.sql` — if `wrangler d1 migrations apply` ignores drizzle output, generate the wrangler migration with `wrangler d1 migrations create` and paste drizzle's SQL, or add a flatten step to `db:generate`.
- **C8** Copier `_subdirectory` + answers behavior for the Slice-3 multi-preset switch — verify before the second preset.
- **C9** Workers pool can't run jsdom SPA component tests — add a second Vitest (jsdom) project for `src/client` if client unit tests are wanted (out of scope for v1).
