import {defineConfig, globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  // React Compiler is not enabled. Keep its migration findings visible without
  // requiring a broad effect/state rewrite as part of this focused cleanup.
  {rules:{'react-hooks/set-state-in-effect':'warn','react-hooks/refs':'warn','react-hooks/purity':'warn'}},
  globalIgnores(['.next*/**', 'artifacts/**', 'next-env.d.ts', '.popin-data/**', 'scripts/.qa-run-*']),
]);
