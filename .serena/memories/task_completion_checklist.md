# Task Completion Checklist

When completing a task or implementing a feature, follow this checklist:

## 1. Code Implementation
- [ ] Implement the feature/fix
- [ ] Follow code style conventions (Composition API, `<script setup>`, TypeScript)
- [ ] Use Tailwind CSS utilities for styling
- [ ] Add proper input validation (server-side)
- [ ] Handle errors appropriately

## 2. Testing
- [ ] Write/update unit tests
- [ ] Run tests: `pnpm test --run`
- [ ] Ensure all tests pass
- [ ] Add E2E tests if needed: `pnpm test:e2e`
- [ ] Check test coverage if relevant: `pnpm test:coverage`

## 3. Type Safety
- [ ] Ensure TypeScript types are correct
- [ ] Run type generation if needed: `pnpm cf-typegen`
- [ ] No TypeScript errors

## 4. Build Verification
- [ ] Build the project: `pnpm build`
- [ ] Ensure build succeeds
- [ ] Preview locally if needed: `pnpm preview`

## 5. Documentation
- [ ] Update CLAUDE.md if architecture changed
- [ ] Add code comments where necessary
- [ ] Document new patterns or conventions
- [ ] Update relevant .md files (CONTEXT.md, IMPLEMENTATION_PLAN.md, etc.)

## 6. Git Workflow
- [ ] Create feature branch from main: `git checkout -b phase{X}-{description}`
- [ ] Commit changes with clear message: `git commit -m "Phase X: Description"`
- [ ] Push to remote: `git push origin {branch-name}`

## 7. Pull Request
- [ ] Create PR: `gh pr create --title "Phase X: Description" --body "..."`
- [ ] Wait for automated checks (2-3 minutes):
  - Claude Code review comments
  - Cloudflare deployment check
- [ ] Review and address feedback
- [ ] Push additional commits if needed
- [ ] Wait for human review and merge

## 8. Common Pitfalls to Avoid
- [ ] Don't forget to clean up heartbeat intervals in `webSocketClose()`
- [ ] Don't modify `server/api/room/[id]/ws.get.ts` (not used for WebSocket routing)
- [ ] Ensure session persistence works (localStorage + ws.serializeAttachment)
- [ ] Test reconnection logic with exponential backoff
- [ ] Validate inputs server-side (names, messages, rate limiting)

## 9. Monitoring After Deploy
- [ ] Check Cloudflare Dashboard → Workers & Pages → planning-poker → Logs
- [ ] Verify production deployment: https://planning-poker.tombaker.workers.dev
- [ ] Test the feature in production

## Standard GitHub Issue Workflow Summary
1. Start from main branch
2. Create feature branch: `phase{X}-{description}`
3. Implement + test + document
4. Commit and push
5. Open PR with `gh pr create`
6. Wait for automated checks
7. Address feedback
8. Wait for human review and merge
