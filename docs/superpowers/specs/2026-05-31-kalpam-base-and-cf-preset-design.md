# kalpam — Slice 0 + 1 Design Spec

**Date:** 2026-05-31 · **Status:** Draft for review · **Scope:** Slice 0 (shared base) + Slice 1 (first preset)

Companion architecture doc (the propagation rationale): `../../../../turbo-pnpm-ts-nextjs-hono-drizzle-base-ui-pure-css/docs/tooling-propagation-strategy.md`.

---

## 1. Problem & context

We want to spin up many small, independent projects fast, with consistent tooling, and **keep them current over time** — when the base evolves (dependency versions, lint/format/test rules, the build pipeline), every project should receive the change as a reviewable PR rather than drifting.

`kalpam` is the answer: an **open-source, CLI-first** project launcher. You pick a curated stack (eventually at `kalpam.dev`), bootstrap a project, and the project then receives **over-the-air** config + dependency updates. This spec covers the foundation — the **shared base** and the **first preset** — which everything else builds on.

## 2. Goals / non-goals

**In scope (this spec):**
- **Slice 0** — the stack-agnostic base: shared config packages, git hooks, automated releases, and the OTA plumbing, all living in one repo (`rozomod/kalpam`).
- **Slice 1** — the first curated preset, `vite-tanstack-hono-d1-cf`, as a self-contained Copier template that produces a working, deployable, OTA-updatable project.

**Out of scope (later slices):** the `create-kalpam` Node CLI (Slice 2), additional presets incl. Turso & Next.js variants (Slice 3), the `kalpam.dev` selector site (Slice 4).

**Success criteria:** generating a project from the preset yields an app that installs, lints, type-checks, tests, builds, and deploys to Cloudflare; and a later `kalpam` release opens a single grouped update PR in that project covering both config-package bumps and the root-file/hook refs.

## 3. Architecture overview

**One repo, `rozomod/kalpam`, plays three roles:** it (a) publishes the shared config packages to public npm under `@kalpam/*`, (b) hosts the canonical git-hook config + the shared Renovate preset + the Copier scaffolding, and (c) holds **one Copier template per preset**. It is **unified-versioned** — a single git tag per release drives the npm publish, the Copier template ref, the lefthook remote ref, and the Renovate preset pin.

Propagation splits by what a thing *is*:
- **LIVE layer** — anything that is a package or a version number (tsconfig/oxlint/oxfmt/vitest/commitlint/semantic-release configs; framework dep versions). Propagates via **Renovate (npm)**.
- **SEEDED layer** — files that cannot be a package (the app's `wrangler.jsonc`, `vite.config.ts`, root `package.json`, workspace files). Propagates via **Copier** (`copier update`, surfaced by Renovate's copier manager) plus a lefthook custom-manager for the pinned hook ref.

```
rozomod/kalpam  (unified-versioned)
├── packages/@kalpam/{tsconfig,oxlint-config,oxfmt-config,vitest-config,commitlint-config,semantic-release-config}
├── lefthook.yml · default.json (Renovate preset) · scripts/ · .github/workflows/
└── templates/vite-tanstack-hono-d1-cf/ (copier.yml + _agents/* + template/)
        │ npm publish + git tag (v0.1.0)            │ copier copy / Node bootstrap
        ▼                                           ▼
   consumed by every preset            a generated project (own repo, own Cloudflare deploy)
                         └── stays current via Renovate (npm) + copier-manager + lefthook custom-manager ──┘
```

## 4. Slice 0 — the shared base

**Carried over from the prior foundation design (reused as-is):** `@kalpam/{tsconfig,oxlint-config,oxfmt-config}`; lefthook consumed via `remotes:` + pinned tag; the Renovate `default.json` preset (atomic `@kalpam/**` group + lefthook-ref custom-manager); Copier scaffolding; the **OIDC Trusted Publishing** release pipeline (npm CLI — pnpm has no OIDC; `id-token: write`; a one-time manual `npm publish --access public` bootstrap per package, then tokenless OIDC); unified git-tag versioning.

**Three new config packages:**

| Package | Shape | Consumed by |
|---|---|---|
| `@kalpam/vitest-config` | Built TS → `dist/`; default export = base config + `/node`, `/browser` subpaths; `vitest` peer `>=4.0.0` (dev `^4.1.7`). Stack-agnostic. | `vitest.config.ts` → `mergeConfig(base, {…})` |
| `@kalpam/commitlint-config` | Buildless ESM (`index.js` + `index.d.ts`); `extends ["@commitlint/config-conventional"]` (dep `^21.0.1`); `@commitlint/cli` peer `>=20.0.0`. | `commitlint.config.js` (ESM; **not** `.ts`) |
| `@kalpam/semantic-release-config` | JS module exporting the shared release config; plugins are its deps (`commit-analyzer ^13`, `release-notes-generator ^14.1.1`, `changelog ^6`, `git ^10`, `github ^12.0.8`). **No `@semantic-release/npm`** (apps, not libraries). | `.releaserc.json` → `{ "extends": "@kalpam/semantic-release-config" }` |

**lefthook (canonical, repo root) — three stages:** pre-commit → oxlint + oxfmt on staged files; **commit-msg → `pnpm exec commitlint --edit {1}`**; pre-push (parallel) → `check-types` + `lint` + **`test`** (`turbo run test`).

**Release machinery:** the version-stamp / publish scripts now iterate **six** packages; the first `v0.1.0` cut publishes and verifies all six; the one-time public bootstrap covers all six before OIDC takes over.

## 5. Slice 1 — preset `vite-tanstack-hono-d1-cf`

**Stack:** Vite + React + TanStack Router (file-based) SPA · Hono API · Drizzle (D1 driver) · Cloudflare D1 · deployed as a **single Cloudflare Worker + Static Assets**. **Unified fullstack app** layout.

**`apps/web`** (package name `web`):
- `src/client/` — TanStack Router: `routes/`, `main.tsx`, generated `routeTree.gen.ts` (gitignored).
- `src/worker/index.ts` — Hono (`/api/*`) + asset serving / SPA fallback; this is the wrangler `main`.
- `vite.config.ts` — `@vitejs/plugin-react` + `tanstackRouter({ routesDirectory: "./src/client/routes", generatedRouteTree: "./src/client/routeTree.gen.ts" })` + `@cloudflare/vite-plugin`.
- `wrangler.jsonc` — `main: "./src/worker/index.ts"`; `assets: { directory: "./dist/client", not_found_handling: "single-page-application" }`; `run_worker_first: ["/api/*"]`; `d1_databases: [{ binding: "DB", database_name, database_id: "REPLACE_WITH_D1_DATABASE_ID", migrations_dir: "migrations" }]`; `compatibility_date: "2026-05-30"`.
- `vitest.config.ts` — `@cloudflare/vitest-pool-workers ^0.16.10` via its `cloudflareTest()` plugin (the ≥0.13 API), `mergeConfig`'d with the `@kalpam/vitest-config` default; real D1/bindings in tests.
- Typed env `{ DB: D1Database }`; the SPA calls Hono through `hono/client` (`hc`) sharing `AppType` for end-to-end types.

**`packages/db`** (name `@{{ project_name }}/db`): Drizzle schema + `drizzle.config.ts` (dialect `d1`); `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`. Migrations output to **`apps/web/migrations`** — the single directory read by `drizzle-kit generate`, `wrangler d1 migrations apply`, and the Vitest `readD1Migrations` helper.

**Version matrix (frozen for the preset):** wrangler `^4.95.0` · `@cloudflare/vite-plugin ^1.39.0` · hono `^4.12.23` · **vite `^7`** (Vite 8's major bump is intentionally deferred to the later OTA pull-upgrade via Renovate) · `@vitejs/plugin-react` aligned to Vite 7.

**AGENTS.md (LLM architectural guidelines):** per-part fragments in `templates/<preset>/_agents/` (base-tooling, vite-tanstack-spa, hono-api, drizzle-d1, cloudflare-deploy, commits/semrel), assembled via Jinja `{% include %}` into a root `AGENTS.md` + nested files at `apps/web/src/client/`, `apps/web/src/worker/`, and `packages/db/`. Each fragment carries architecture rules, a folder map, do/don't, and patterns — written for a coding agent. The `_agents/` dir is excluded from generated output.

**CI / release / deploy** — a single `release.yml` with two jobs: a `release` job runs semantic-release; a `deploy` job `needs: release`, gated on `needs.release.outputs.released == 'true'`, checks out the new tag and runs `cloudflare/wrangler-action@v4` (`wrangler deploy` + `wrangler d1 migrations apply --remote`). A `GITHUB_TOKEN`-created release fires neither `on: release` nor `on: push: tags` (GitHub anti-recursion), so the job-dependency pattern is required. A separate `ci.yml` runs on PRs: install · lint · typecheck · test (workers pool) · build.

**OTA wiring:** the preset is a Copier template; the seeded `.copier-answers.yml` (`_src_path: gh:rozomod/kalpam`, `_commit: v0.1.0`) plus the `@kalpam/*` dev-deps make it fully updatable. The consumer `renovate.json` extends `github>rozomod/kalpam#v0.1.0` with `enabledManagers: ["npm","github-actions","nvm","copier","custom.regex"]` — the namespaced `custom.regex` token (bare `regex` is legacy and silently disabled in Renovate v40+). The shared `default.json` defines two `customManagers`: one bumps the lefthook remote `ref`, the other bumps the wrangler `compatibility_date` via the `github-releases` datasource on `cloudflare/workerd` (its `v1.YYYYMMDD.N` tags map to the newest valid compat date; `extractVersion` + a regex versioning reconcile the dashed file value with the undashed tag).

## 6. Data flow

- **Request:** browser → Cloudflare Worker. `/api/*` → Hono (Drizzle over the `DB` D1 binding); everything else → static assets with SPA fallback. Client→server calls are typed via `hc<AppType>`.
- **OTA:** a `kalpam` change → publish + tag (`vX.Y.Z`) → Renovate opens one grouped *"kalpam release"* PR per consumer that bumps the `@kalpam/*` npm deps **and** the `rozomod/kalpam` git-tag refs (Copier `_commit` + lefthook `ref`) together → merge applies the update.

## 7. Testing strategy

Server/API and D1 logic run under `@cloudflare/vitest-pool-workers` (real Worker runtime + D1 bindings, migrations applied from `apps/web/migrations`). The root Vitest config must not glob `apps/web` (it would run those tests in the wrong pool). **Known gap (C9):** the Workers pool cannot run jsdom SPA component tests; if client unit tests are in scope, a second Vitest project (jsdom) for `src/client` is added — deferred for v1 unless needed.

## 8. Failure modes & handling

- **Deploy never fires:** mitigated by the `deploy`-`needs:`-`release` job gate (the documented `GITHUB_TOKEN` trap). Verified via semantic-release `--dry-run` outputs before first real release.
- **First publish fails:** scoped packages default to restricted; mitigated by `publishConfig.access: "public"` + the one-time public bootstrap before OIDC.
- **Migration drift:** a single migrations directory shared by generate/apply/test; smoke-tested for drizzle-kit's folder format vs wrangler's flat `.sql` expectation.
- **OTA half-applies:** the atomic Renovate group keeps the npm bumps and the git-tag refs in one PR so a consumer can't end up on mixed versions.

## 9. Key resolved decisions

| Decision | Resolution |
|---|---|
| D1 migrations dir | `apps/web/migrations` (one path for generate/apply/test) |
| Worker entry | `apps/web/src/worker/index.ts` (wrangler `main`) |
| Client layout | `apps/web/src/client/` with explicit `routesDirectory`/`generatedRouteTree` |
| Workers test API | `@cloudflare/vitest-pool-workers ^0.16.10` + `cloudflareTest()`; root vitest excludes `apps/web` |
| vitest-config shape | built, default export; consumers `mergeConfig` the default |
| Deploy trigger | `deploy` job `needs: release` (not `on:release`/`on:push:tags`) |
| semantic-release config | delivered as the 6th package; release scripts iterate 6 |
| Drizzle pins | `drizzle-orm ^0.45.2` / `drizzle-kit ^0.31.10`; db pkg `@{{ project_name }}/db`, app `web` |
| commitlint config file | `commitlint.config.js` (not `.ts`); lefthook `^2.1.9` |
| Vite version | `^7` now; Vite 8 major deferred to the OTA pull-upgrade (Renovate) |

## 10. Risks & verification watch-list

- **C1** lefthook-`ref` Renovate regex custom-manager — validate with `renovate-config-validator` + dry-run; `copier update` is the fallback.
- **C4/C5** `run_worker_first` shape, `nodejs_compat` need, `assets.directory` — confirm on first `vite build` / `wrangler dev`.
- **C6** semantic-release step outputs that gate the deploy job — confirm via `--dry-run` before first real release.
- **C7** drizzle-kit migration folder format vs wrangler's flat `.sql` — smoke-test; add a flatten step if needed.
- **C9** Workers pool vs jsdom SPA tests — add a second Vitest project if client unit tests are needed.
- **C2/C8** Copier `_exclude: ["_agents"]` (fragments must not leak); multi-preset `_subdirectory` behavior is a Slice-3 concern.

## 11. Implementation outline

Build `kalpam` (workspace + the 3 carried-over packages + the 3 new packages + expanded lefthook + Renovate preset + OIDC release pipeline) → build the preset template under `templates/vite-tanstack-hono-d1-cf/` → bootstrap-publish the six packages and configure Trusted Publishers → cut `v0.1.0` → install the Renovate App → validate by generating a project, provisioning D1, deploying to Cloudflare, and confirming a later `v0.2.0` produces a single grouped OTA PR. The detailed, ordered task plan is produced next via `writing-plans`.

## 12. Deferred & open items

- **Deferred slices:** `create-kalpam` CLI (2) · more presets incl. Turso + Next.js (3) · `kalpam.dev` selector (4).
- **Resolved:** Vite is pinned at `^7`; the Vite 8 major upgrade is deferred to the OTA pull-upgrade — Renovate will surface it as a major-update PR once the cf-plugin + pool-workers peer ranges support it.
- **Resolved:** `compatibility_date` is **Renovate-managed** — a `default.json` `customManagers` entry tracks the `github-releases` datasource on `cloudflare/workerd` and opens a PR bumping the date to the latest workerd release (verified recipe; requires `custom.regex` in `enabledManagers`). No open items remain.
