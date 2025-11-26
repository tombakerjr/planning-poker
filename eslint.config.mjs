import perfectionist from 'eslint-plugin-perfectionist';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  plugins: {
    perfectionist,
  },
  rules: {
    'perfectionist/sort-imports': 'error',
    'perfectionist/sort-named-imports': 'error',
  },
});
