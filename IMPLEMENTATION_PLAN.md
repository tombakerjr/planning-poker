# Planning Poker - Feature Enhancement Plan

**Status:** Active Development
**Last Updated:** 2025-10-27

This document outlines the incremental feature development plan for the Planning Poker application. The focus is on building a full-featured planning poker solution with authentication, room access control, analytics, and all standard planning poker features.

**Note:** No production users currently - backward compatibility not required.

---

## Current State (as of Phase 4C completion)

**Completed:**
- ✅ Single-worker architecture with WebSocket Hibernation API
- ✅ Durable Objects with proper state management
- ✅ Real-time voting functionality
- ✅ Basic rate limiting (room creation)
- ✅ Input validation and sanitization
- ✅ Session persistence and recovery
- ✅ Reconnection with exponential backoff
- ✅ Error handling and user feedback
- ✅ Toast notification system
- ✅ Connection status indicators
- ✅ Loading states for actions
- ✅ Professional logging system
- ✅ Type-safe provide/inject patterns
- ✅ Comprehensive E2E testing with Playwright (18 tests)
- ✅ Production deployment at https://planning-poker.tombaker.workers.dev

---

## Phase 5: Dark Mode & UI Polish
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features
- System-aware dark mode with manual toggle
- Persistent theme preference (localStorage → eventually D1)
- Dark mode styles for all components
- Smooth theme transitions
- Improved loading states and animations
- Better mobile responsiveness

### Success Criteria
- Dark mode toggle works across all pages
- Theme preference persists across sessions
- All components properly styled in both modes
- Smooth transitions without flashing

---

## Phase 5B: Voting Scale Selection
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features
- Multiple voting scales:
  - **Fibonacci**: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕
  - **Modified Fibonacci**: 0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕
  - **T-Shirt Sizes**: XS, S, M, L, XL, XXL, ?
  - **Powers of 2**: 1, 2, 4, 8, 16, 32, 64, ?
  - **Linear**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?
  - **Custom**: User-defined values
- Scale selection on room creation
- Moderator can change scale mid-session
- Store scale preference per user
- Dynamic voting cards based on selected scale

### Success Criteria
- All voting scales render correctly
- Scale changes update voting UI instantly
- User preference persists
- Custom scales support arbitrary values

---

## Phase 5C: Enhanced Voting UX
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features

**Voting Status Indicators:**
- Visual indicator showing who voted vs. who hasn't
- Participant list shows: ✓ (voted), ⏳ (not voted), 👁️ (spectator)
- Progress bar: "X of Y voted"
- Real-time updates as votes come in

**Auto-Reveal Toggle:**
- Room setting: "Auto-reveal when everyone votes"
- Default: OFF (manual reveal)
- Configurable by moderator
- Optional: visual countdown before auto-reveal

**Vote Change Tracking:**
- Highlight user's current vote
- Allow vote changes before reveal
- "Vote changed" indicator (temporary)

### Success Criteria
- Clear visibility of who has/hasn't voted
- Auto-reveal works reliably when enabled
- Vote changes reflected instantly
- Progress indicator accurate

---

## Phase 5D: Connection Resilience
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features
- Enhanced reconnection for high-latency connections
- Optimistic UI updates (assume success, rollback on failure)
- Connection quality indicator (good/fair/poor)
- Automatic bandwidth detection and adaptation
- Queue messages during temporary disconnections
- Longer timeout thresholds for slow connections
- Improved retry with exponential backoff
- Network state detection (online/offline events)
- Better handling of packet loss
- Compression for low-bandwidth scenarios

### Goal
Support users in Central/South America, Eastern Europe with flaky or high-latency internet connections.

### Success Criteria
- App remains usable on 3G connections
- Graceful handling of 500ms+ latency
- No message loss during brief disconnections
- Clear feedback on connection issues
- Automatic recovery without page refresh

---

## Phase 6: Local-First Session Management
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features
- Enhanced localStorage session persistence
- Local voting history (last 10 sessions)
- Session metadata: date, participants, story count, avg estimate
- Export sessions to JSON/CSV
- User preferences: vote scale, theme, auto-reveal
- "Recent Rooms" list on homepage
- Session search and filtering
- Delete old sessions

### Success Criteria
- Sessions persist across browser restarts
- Export works for all data formats
- Recent rooms list accurate and up-to-date
- Preferences apply immediately

---

## Phase 6B: Voting Statistics & Analytics
**Priority:** MEDIUM-HIGH
**Dependencies:** Phase 5B (vote scales)
**Status:** Pending

### Features

**When votes revealed, show:**
- Average (mean)
- Median
- Mode (most common)
- Standard deviation (consensus indicator)
- Range (min-max)
- Consensus percentage (% voting for mode)

**Visual indicators:**
- Consensus bar: red (<50%), yellow (50-75%), green (>75%)
- Outlier highlighting (>2 std dev from mean)
- Distribution histogram (simple bar chart)
- Trend indicators for multiple rounds

### Success Criteria
- Statistics calculated correctly for all vote scales
- Visual indicators accurate and helpful
- Statistics update in real-time on reveal
- Works with non-numeric scales (T-shirt sizes)

---

## Phase 6C: Cloudflare Web Analytics
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features
- Add Cloudflare Web Analytics beacon
- Track page views, room creation, voting sessions
- Privacy-first (no cookies, no personal data)
- Dashboard in Cloudflare for metrics
- Custom events for key actions
- Performance monitoring (Core Web Vitals)

### Benefits
- No cookie banner required (privacy-first)
- Free with Cloudflare account
- Real-time metrics
- Zero impact on performance

### Success Criteria
- Analytics beacon loaded on all pages
- Key events tracked correctly
- Dashboard shows accurate data
- No privacy concerns

---

## Phase 7: Timer & Round Management
**Priority:** MEDIUM
**Dependencies:** None
**Status:** Pending

### Features
- Optional timer for voting rounds (30s, 1m, 2m, 5m, custom)
- Visual countdown in room
- Audio/visual alert when time's up
- Optional: auto-reveal on timer expiration
- Timer pause/cancel by moderator
- Timer preferences saved per user/room
- Timer synchronization across all participants

### Success Criteria
- Timer synced across all clients
- Visual countdown clear and prominent
- Audio alerts not intrusive
- Timer preferences persist

---

## Phase 7B: Keyboard Shortcuts
**Priority:** MEDIUM
**Dependencies:** None
**Status:** Pending

### Features

**Keyboard shortcuts for common actions:**
- `0-9`: Vote with numeric value
- `R`: Reveal votes
- `N`: New round / Reset
- `?` or `Shift+/`: Toggle help overlay
- `T`: Start/stop timer
- `Esc`: Close modals
- `C`: Copy room URL
- `S`: Toggle settings

**Additional features:**
- Shortcut help panel showing all available shortcuts
- Visual hints on buttons (show shortcut on hover)
- Configurable shortcuts (future enhancement)
- Disable shortcuts in text inputs

### Success Criteria
- All shortcuts work reliably
- Help panel accessible and clear
- No conflicts with browser shortcuts
- Shortcuts disabled in input fields

---

## Phase 7C: SEO & Social Sharing
**Priority:** MEDIUM
**Dependencies:** None
**Status:** Pending

### Features
- Meta tags (title, description, Open Graph tags)
- Dynamic OG image generation per room
- Twitter card support
- Favicon + app icons (multiple sizes)
- Sitemap.xml and robots.txt
- Better preview when sharing on Slack/Teams/Discord
- Structured data (Schema.org)

### Success Criteria
- Links shared on social media show rich previews
- Search engines can index landing page
- App icons display correctly on all devices
- Room-specific sharing shows room details

---

## Phase 8: Authentication Infrastructure
**Priority:** HIGH
**Dependencies:** None (but enables Phase 9+)
**Status:** Pending

### Features
- D1 database configuration and migrations
- OAuth integration: Google + Github via Cloudflare Workers
- Optional sign-in (not required for basic use)
- Migrate localStorage data to user profile on first auth
- User profile page (name, email, avatar, preferences)
- Session management (JWT in httpOnly cookie)
- Account deletion and data export (privacy compliance)

### Database Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  preferences_json TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, provider_id)
);

-- Room configurations
CREATE TABLE room_configs (
  room_id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  is_private INTEGER DEFAULT 0,
  requires_auth INTEGER DEFAULT 0,
  password_hash TEXT,
  settings_json TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- Voting sessions (historical)
CREATE TABLE voting_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  issue_reference TEXT,
  story_title TEXT,
  votes_json TEXT NOT NULL,
  final_estimate TEXT,
  completed_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES room_configs(room_id)
);

-- Room members (who participated)
CREATE TABLE room_members (
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'moderator', 'participant', 'spectator'
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES room_configs(room_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Success Criteria
- OAuth flow works for Google and Github
- User data migrates from localStorage on first auth
- Profile page shows correct user information
- Session persists across browser restarts
- Logout clears session properly

---

## Phase 9: Room Access Control
**Priority:** HIGH
**Dependencies:** Phase 8 (Authentication)
**Status:** Pending

### Features

**Room Configuration (on creation):**
- Public/Private toggle
- Require authentication (yes/no)
- Optional password protection
- Max participants limit
- Expiration time

**Role System:**
- Creator → auto moderator
- First user in room (if creator absent) → temp moderator
- Roles: Moderator, Participant, Spectator

**Moderator Powers:**
- Kick/ban users from room
- Lock room (prevent new joins)
- Change room settings
- Transfer moderator role to another user
- Promote participants to co-moderators
- Close/archive room

**Spectator Mode:**
- View-only (cannot vote)
- Doesn't affect vote count
- Useful for observers, stakeholders, trainees

**Password Protection:**
- Optional password on room creation
- Hash passwords (bcrypt or argon2)
- Password entry modal on join
- Moderator can change/remove password

### Success Criteria
- Only authenticated users can create private rooms
- Password protection works reliably
- Moderator actions reflected immediately
- Spectators can't affect voting
- Kicked users can't rejoin

---

## Phase 10: Error Tracking
**Priority:** HIGH
**Dependencies:** None
**Status:** Pending

### Features

**Integration Options:**
- Sentry.io (recommended) OR
- Cloudflare Tail Workers (free, built-in)

**Error Tracking:**
- Client-side error boundary (React/Vue)
- Server-side error logging
- WebSocket error tracking
- User feedback on errors ("Report this issue")
- Error grouping and deduplication
- Alerting for critical errors
- Context: user ID, room ID, action attempted

**Performance Monitoring:**
- Web Vitals (LCP, FID, CLS)
- Custom performance marks
- API response times
- WebSocket latency

### Success Criteria
- All errors captured and reported
- Alerts sent for critical issues
- Performance metrics tracked
- User feedback form works
- Enough context to debug issues

---

## Phase 11: Multiple Stories & History
**Priority:** MEDIUM
**Dependencies:** None
**Status:** Pending

### Features
- Support multiple stories per session
- Story queue: create, reorder, delete stories
- Active story indicator (highlight current)
- Story details: title, description, acceptance criteria
- Vote history per story
- Navigate between stories (prev/next buttons)
- Session summary view (all stories + estimates)
- Export session with all stories
- Story templates (save common story formats)

### Success Criteria
- Can manage 50+ stories per session
- Navigation between stories is smooth
- Export includes all stories
- Story history preserved
- Templates save time

---

## Phase 12: Cloud Session Persistence
**Priority:** MEDIUM
**Dependencies:** Phase 8 (Auth), Phase 9 (Access Control)
**Status:** Pending

### Features

**Save to Cloud:**
- All voting sessions saved to D1 (authenticated users)
- Automatic save on vote completion
- Manual save option

**"My Rooms" Dashboard:**
- Rooms I created
- Rooms I participated in
- Recently active rooms
- Bookmarked/favorite rooms
- Archived rooms

**Session History:**
- Filter by date range
- Filter by participants
- Search by story title
- Sort by various fields

**Additional Features:**
- Cloud export (JSON/CSV)
- Room templates (save config for reuse)
- Restore previous session
- Share session results (public link)

### Success Criteria
- Sessions sync across devices
- Dashboard loads quickly
- Filters/search work correctly
- Export includes cloud data
- Templates reusable

---

## Phase 13: Issue Tracker Integration
**Priority:** MEDIUM
**Dependencies:** Phase 8 (Auth - for API tokens)
**Status:** Pending

### Features

**Github Integration:**
- OAuth to access user's repos
- Issue picker (search by repo, number, title)
- Display: title, description, labels, current estimate
- Store issue URL in room state
- Fetch issue on room load
- Link back to Github issue
- Optional: Write estimate back as comment or label

**Jira Integration:**
- API token or OAuth
- Issue picker (search by project, JQL query)
- Display: summary, description, story points field
- Store issue key in room state
- Fetch issue on room load
- Link back to Jira issue
- Optional: Update story points field via API

**Generic Integration:**
- Manual issue URL/ID entry
- Fetch metadata via public API if available
- Fallback: just store reference text
- Custom issue display template

**Read-Only Focus:**
- Primary goal: display issue info to reduce context switching
- Write-back optional and configurable
- Moderator-only write permissions

### Success Criteria
- Github issue fetch works reliably
- Jira issue fetch works reliably
- Issue details display clearly
- Manual entry fallback works
- No breaking API rate limits

---

## Phase 14: Google Analytics 4 + Cookie Banner
**Priority:** LOW-MEDIUM
**Dependencies:** Phase 6C (Cloudflare Analytics)
**Status:** Pending

### Features

**Google Analytics 4:**
- Add GA4 tracking script
- Enhanced event tracking (custom events)
- User journey analysis
- Conversion funnels
- E-commerce tracking (if monetization added)

**Cookie Consent Banner:**
- Simple opt-in/opt-out mechanism
- Respect "Do Not Track" header
- Store preference in localStorage
- Only required for GA4 (cookies)
- US-friendly (not full GDPR)
- Easy to upgrade to CCPA compliance later

**Privacy Policy:**
- Privacy policy page
- Data collection disclosure
- Third-party services disclosure
- User rights (access, deletion)
- Contact information

### Success Criteria
- GA4 tracks events correctly
- Cookie banner appears on first visit
- Preference persists
- Analytics respect opt-out
- Privacy policy comprehensive

---

## Phase 15: Advanced Facilitator Features
**Priority:** LOW-MEDIUM
**Dependencies:** Phase 8, 9
**Status:** Pending

### Features

**Async Voting Mode:**
- Allow voting over extended period (hours/days)
- Email/notification when all votes in
- Useful for distributed teams across timezones

**Anonymous Voting Option:**
- Hide who voted what until reveal
- Shows only "voted" status, not actual votes
- Reduces groupthink/anchoring bias

**Vote Locking:**
- Prevent vote changes after submission
- Useful for formal estimation processes
- Moderator can enable/disable

**Room Expiration Warnings:**
- Notify 1 hour before room expires
- Allow moderator to extend lifetime
- Auto-archive old rooms
- Cleanup expired rooms from D1

### Success Criteria
- Async voting works across timezones
- Anonymous voting truly anonymous
- Vote locking enforced
- Expiration warnings timely

---

## Phase 16: Collaboration Enhancements
**Priority:** LOW
**Dependencies:** Phase 8
**Status:** Pending

### Features
- Real-time participant avatars (from OAuth or generated)
- Typing indicators ("Alice is thinking...")
- Emoji reactions to votes/stories (👍 👎 😂 🤔)
- Quick polls (yes/no questions)
- Room chat (simple text messages)
- Shareable room QR code
- Deep links to specific stories

### Success Criteria
- Avatars load quickly
- Reactions sync in real-time
- Chat doesn't interfere with voting
- QR codes work on mobile

---

## Phase 17: Analytics & Reporting
**Priority:** LOW
**Dependencies:** Phase 12
**Status:** Pending

### Features
- Team velocity tracking (estimates over time)
- Average voting time per story
- Consensus trends (improving or degrading?)
- Most active participants
- Estimate accuracy (if tracking actuals)
- Export reports to PDF
- Dashboard for team admins
- Charts and visualizations

### Success Criteria
- Reports accurate and insightful
- Visualizations clear
- Export works reliably
- Dashboard loads quickly

---

## Implementation Strategy

### Sprint 1: Core UX Improvements
- Phase 5: Dark Mode
- Phase 5B: Vote Scales
- Phase 5C: Enhanced Voting UX
- Phase 5D: Connection Resilience
- Phase 6C: Cloudflare Analytics

**Goal:** Immediate UX wins, better for international users

### Sprint 2: Foundation & Monitoring
- Phase 6: Local Session Management
- Phase 6B: Statistics
- Phase 10: Error Tracking

**Goal:** Solid foundation before auth

### Sprint 3: Productivity Features
- Phase 7: Timer
- Phase 7B: Keyboard Shortcuts
- Phase 7C: SEO & Sharing

**Goal:** Power user features, better discoverability

### Sprint 4: Authentication & Access Control
- Phase 8: Auth Infrastructure
- Phase 9: Room Access Control

**Goal:** Enable authenticated features

### Sprint 5: Advanced Features
- Phase 11: Multiple Stories
- Phase 12: Cloud Persistence

**Goal:** Full-featured voting sessions

### Sprint 6: Integrations
- Phase 13: Issue Tracker Integration
- Phase 14: GA4 + Cookie Banner

**Goal:** Workflow integration

### Sprint 7+: Polish & Advanced
- Phase 15: Advanced Facilitator Features
- Phase 16: Collaboration
- Phase 17: Analytics & Reporting

**Goal:** Nice-to-have features, long-term value

---

## Technical Guidelines

### General Principles
1. **No Backward Compatibility Required** - Zero production users
2. **Breaking Changes OK** - Can refactor freely
3. **Privacy First** - Start with Cloudflare Analytics (no cookies)
4. **International Support** - Prioritize connection resilience
5. **Progressive Enhancement** - Features work without auth when possible

### Database
- Use D1 migrations for schema evolution
- Index frequently queried fields
- Implement soft deletes for important data
- Regular backups to Cloudflare R2

### WebSocket Protocol
- Add protocol versioning for future compatibility
- Graceful degradation for older clients
- Message size limits and compression
- Heartbeat improvements for slow connections

### Testing
- E2E tests for each major phase before merging
- Unit tests for business logic
- Integration tests for D1 operations
- Performance tests for high-latency scenarios

### Security
- Input validation on all user inputs
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize outputs)
- Rate limiting on all endpoints
- CSRF protection on state-changing operations

### Performance
- Lazy load non-critical components
- Image optimization (if avatars/OG images added)
- Code splitting for auth features
- CDN caching for static assets
- Connection pooling for D1

---

## Success Metrics

### Technical Excellence
- Zero security vulnerabilities
- Error rate < 0.1%
- p99 latency < 200ms (international users)
- Test coverage > 80%
- Lighthouse score > 90

### User Experience
- Dark mode adoption > 30%
- Authenticated users > 20% within 2 weeks
- Private room creation > 15%
- Issue tracker usage > 10%
- Mobile usability score > 85%

### Reliability
- Uptime > 99.9%
- Connection success rate > 95% (high-latency)
- Reconnection success rate > 98%
- Data loss incidents: 0

### Growth (Future)
- Active users growth
- Rooms created per day
- Average session duration
- Feature engagement rates
- User retention rate

---

## Resources

- **Production URL:** https://planning-poker.tombaker.workers.dev
- **Repository:** https://github.com/tombakerjr/planning-poker
- **Cloudflare Docs:** https://developers.cloudflare.com/
- **D1 Database:** https://developers.cloudflare.com/d1/
- **Durable Objects:** https://developers.cloudflare.com/durable-objects/
- **WebSocket Hibernation:** https://developers.cloudflare.com/durable-objects/api/websockets/

---

## Change Log

**2025-10-27:** Created comprehensive feature enhancement plan
- Defined 17 phases of development
- Prioritized UX improvements and connection resilience
- Added analytics (Cloudflare first, GA4 later)
- Included error tracking, keyboard shortcuts, SEO
- Planned authentication and access control
- Outlined issue tracker integration
- Set clear success metrics and technical guidelines
