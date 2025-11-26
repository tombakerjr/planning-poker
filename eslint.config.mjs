import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    // Style preferences
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],

    // Import sorting (perfectionist is included in @nuxt/eslint)
    'perfectionist/sort-imports': 'error',
    'perfectionist/sort-named-imports': 'error',
  },
});
