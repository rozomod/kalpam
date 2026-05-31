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
