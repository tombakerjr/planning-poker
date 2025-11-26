# ESLint Setup Design

**Date:** 2025-11-26
**Status:** Approved
**Related Issue:** [#52](https://github.com/tombakerjr/planning-poker/issues/52)

## Overview

Add ESLint v9 with Nuxt's official configuration to provide linting and formatting for the planning-poker codebase. Includes git hooks for pre-commit linting and CI integration for automated checks.

## Goals

- Enforce consistent code style across the codebase
- Catch bugs and issues before they reach production
- Provide Vue-specific linting (template syntax, accessibility, reactivity)
- Auto-fix formatting on commit
- Block PRs with linting errors via CI

## Design Decisions

### Tool Selection

**ESLint v9 with flat config** was chosen over alternatives:

| Tool | Speed | Vue Support | Decision |
|------|-------|-------------|----------|
| ESLint + Prettier | Moderate | Excellent | Not chosen - two tools adds complexity |
| Biome | Very fast | Basic (no Vue templates) | Not chosen - lacks Vue template linting |
| ESLint Stylistic | Moderate | Excellent | **Chosen** - single tool, full Vue support |

### Configuration Baseline

**@nuxt/eslint** was chosen over building from scratch because:
- Maintained by the Nuxt team
- Understands Nuxt conventions (auto-imports, Nitro routes)
- Bundles Vue, TypeScript, and stylistic rules
- Allows rule overrides for customization

### Code Style Preferences

- **Semicolons:** Required (always)
- **Quotes:** Single quotes preferred
- **Trailing commas:** Required in multiline
- **Import sorting:** Enforced via perfectionist plugin (included in @nuxt/eslint)

### Git Hooks

**Husky v9** was chosen over simple-git-hooks because:
- Familiarity from professional work
- Extensibility for future additions (commitlint, commitizen)
- Well-documented and widely adopted

### CI Integration

Combined lint + test workflow in a single job because:
- Both steps are fast (<30s each)
- Avoids duplicate environment setup
- Single clear status check on PRs

## Dependencies

```json
{
  "devDependencies": {
    "eslint": "^9.28.0",
    "@nuxt/eslint": "^1.4.1",
    "husky": "^9.1.7",
    "lint-staged": "^16.1.0"
  }
}
```

## Implementation

### New Files

#### `eslint.config.mjs`

```javascript
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
```

#### `.husky/pre-commit`

```bash
pnpm lint-staged
```

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version-file: '.nvmrc'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test --run
```

### Modified Files

#### `nuxt.config.ts`

Add `@nuxt/eslint` to modules:

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    // ... existing modules
  ],
});
```

#### `package.json`

Add scripts and lint-staged config:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{js,ts,vue,mjs,cjs}": "eslint --fix"
  }
}
```

## Documentation Updates

### CLAUDE.md

Add linting section to Essential Commands:

```markdown
### Linting
\`\`\`bash
# Check all files for linting errors
pnpm lint

# Auto-fix linting and formatting issues
pnpm lint:fix
\`\`\`
```

Update Testing section to mention CI:

```markdown
### Testing & CI

CI runs automatically on PRs and pushes to main:
- **Lint**: ESLint with Nuxt config, stylistic rules
- **Test**: Vitest unit tests

Pre-commit hook runs `lint-staged` to auto-fix staged files.
```

### Serena Memories

**suggested_commands:** Add linting commands
**tech_stack:** Add ESLint and Husky to Development Tools
**code_style_conventions:** Add linting rules and conventions
**task_completion_checklist:** Add lint step after testing

## Workflow Integration

```
Developer writes code
        ↓
Editor runs ESLint on save (auto-fix)
        ↓
Git commit triggers pre-commit hook
        ↓
Husky runs lint-staged (eslint --fix on staged files)
        ↓
Push to GitHub
        ↓
CI runs pnpm lint + pnpm test --run
        ↓
PR shows pass/fail status
```

## Initial Migration

After setup, running `pnpm lint:fix` will format the entire codebase to match the new conventions. Expected changes:

- Quote style normalization (double → single)
- Semicolon additions where missing
- Trailing comma additions in multiline structures
- Import reordering

This will touch most files and should be committed as a single "format codebase" commit.

## Future Considerations

- **commitlint/commitizen:** Husky setup supports adding commit message linting later
- **VS Code settings:** Could add `.vscode/settings.json` with ESLint auto-fix on save
- **Additional plugins:** Can add accessibility or security-focused ESLint plugins as needed
