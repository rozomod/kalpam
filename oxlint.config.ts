import { defineConfig } from 'oxlint';
import kalpam from '@kalpam/oxlint-config';

export default defineConfig({
  extends: [kalpam],
  // env is NOT inherited through extends (oxc#20087); kalpam is a Node tooling repo.
  env: { node: true, es2024: true },
});
