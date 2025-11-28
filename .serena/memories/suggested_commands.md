# Suggested Commands

## Installation
```bash
pnpm install
```

## Development
```bash
# Start local dev server (Nuxt dev mode with Durable Objects)
pnpm dev

# Preview production build locally with Wrangler
pnpm preview
```

## Building
```bash
# Build for production
pnpm build
# Output: .output/server/index.mjs (Nitro server) + .output/public/ (static assets)
```

## Testing
```bash
# Run all unit tests (watch mode by default)
pnpm test

# Run tests without watch mode
pnpm test --run

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run single test file
vitest server/poker-room.test.ts

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run E2E tests in headed mode
pnpm test:e2e:headed

# Run specific E2E test file
pnpm test:e2e e2e/room-creation.spec.ts --reporter=list
```

## Type Generation
```bash
# Generate Cloudflare Workers types from wrangler.jsonc
pnpm cf-typegen
```

## Linting
```bash
# Check all files for linting errors
pnpm lint

# Auto-fix linting and formatting issues
pnpm lint:fix
```

## Deployment
```bash
# Deploy to Cloudflare Workers
pnpm deploy
```

## Git Workflow
```bash
# Check Git status
git status

# View recent commits
git log --oneline -n 5

# Create feature branch
git checkout -b phase{X}-{brief-description}

# Push branch
git push origin {branch-name}
```

## GitHub CLI (gh)
```bash
# Create pull request
gh pr create --title "Phase X: Description" --body "..."

# View issue
gh issue view {number}

# List open issues
gh issue list --state open

# View PR
gh pr view {number}

# View PR comments
gh pr view {number} --json comments --jq '.comments[] | {user: .user.login, body: .body}'
```

## System Utilities (Linux)
```bash
# List files
ls -la

# Find files
find . -name "*.ts"

# Search in files
grep -r "pattern" .

# Change directory
cd /path/to/directory
```
