// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'dist-audit/**', '**/.expo/**'],
  },
  {
    rules: {
      // React Native Animated/PanResponder intentionally keep imperative values
      // in refs. React Compiler can skip those components without making lint fail.
      'react-hooks/refs': 'off',
      // Data-loading effects and modal reset effects intentionally update state
      // after synchronizing with Supabase or a visibility prop.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
