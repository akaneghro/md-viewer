// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['src-tauri/**', 'coverage/**', 'dist/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
    },
  },
)
