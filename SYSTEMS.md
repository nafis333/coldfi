
> **ColdFi** — Zero-knowledge encrypted personal & group finance tracking app
> Monorepo: `packages/shared`, `packages/backend`, `packages/web` — Node.js 20, TypeScript 5, Fastify 4, React 18, PostgreSQL, Redis, Socket.IO

---

# System Reference — Full Codebase Division

Use the **system number** when asking me to look at, debug, fix, or improve a specific part:

> *"Look at **System 7** — the settlement engine has a bug"*
> *"Check **System 46** for UI issues in the admin panel"*
> *"Review **System 21** for auth vulnerabilities"*

---

## INFRASTRUCTURE & DEVOPS

### 1. Project Configuration & Scripts
**Files:** `package.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`, `.dockerignore`, `opencode.json`, `README.md`
**What it does:** Root monorepo config — npm workspaces (`shared`, `backend`, `web`), shared TypeScript strict settings, environment template, project readme
**Key points:**
- Build order: `shared` → `backend` → `web`
- Scripts: `dev:all`, `build`, `test`, `lint`, `migrate`, `seed`
- `concurrently` runs backend + frontend in dev mode
**Common bugs:** Missing or stale env vars cause silent failures at startup (mitigated by backend Zod validation in config.ts — exits with code 1 on invalid config)
**Note:** `packages/shared/vitest.config.ts` exists with globals + node environment — tests go in `src/**/__tests__/**/*.test.ts`

### 2. Docker & Deployment
**Files:** `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile` (backend & web), `nginx.prod.conf`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/`
**What it does:** Containerization (Postgres 15, Redis 7, backend, frontend), CI pipeline, deployment, pre-deploy checks, smoke tests
**Key points:**
- Dev compose mounts volumes for hot reload
- Prod compose uses Nginx reverse proxy
- Monitoring stack: `monitoring/docker-compose.monitoring.yml` (Prometheus + Grafana)
**Common bugs:**
- ~~Dockerfiles may have stale build stages~~ (FIXED — multi-stage build with correct paths, build-essential deps, nginx.conf with worker config)
- ~~Nginx config may need route-specific caching rules~~ (FIXED — route-specific Cache-Control: assets immutable 1y, SPA no-cache, API no-store)

### 3. Monitoring & Observability
**Files:** `monitoring/docker-compose.monitoring.yml`, `monitoring/prometheus.yml`, `monitoring/grafana-dashboard.json`, `monitoring/alerts.yml`
**What it does:** Prometheus metrics scraping, Grafana dashboards, alerting rules
**Key points:**
- Separate compose stack from main app
- Backend exposes `/metrics` endpoint (Prometheus format) via `health-enhanced.ts`
**Common bugs:**
- ~~Prometheus targets may not match actual service names/ports~~ (FIXED — `nginx:9113` → `nginx-exporter:9113` in prometheus.yml)
- Grafana dashboard JSON may reference nonexistent metric names from the custom exporter (metrics verified against health-enhanced.ts — all match)

---

## SHARED LAYER (`packages/shared`)

### 4. Shared Types — Enums & Interfaces
**Files:**
- `packages/shared/src/types/enums.ts`
- `packages/shared/src/types/auth.ts`
- `packages/shared/src/types/personal.ts`
- `packages/shared/src/types/group.ts`
- `packages/shared/src/types/settlement.ts`
- `packages/shared/src/types/api.ts`
**What it does:** All shared TypeScript type definitions used by both backend and frontend
**Key exports:**
- **Enums:** `SettlementStatus`, `GroupLogEventType` (18 events), `PaymentMethod`, `ExpenseStatus`, `MemberRole`, `SplitMode`, `BudgetType`, `BudgetStatus`, `NotificationType`
- **Auth types:** `User`, `SessionTokens`, `RegisterRequest/Response`, `LoginRequest/Response`, `TwoFactor*`, `ChangePasswordRequest`
- **Personal types:** `PersonalBlob` (expenses, budgets, categories, recurring bills, income logs, savings targets)
- **Group types:** `GroupBlob` (expenses with splits, categories with ratios, members, settings, recurring bills)
- **Settlement types:** `SettlementProposal` (full lifecycle audit trail), `TransferProposal`, `MemberNetBalance`
- **API types:** `ApiResponse<T>`, `ApiError`, `SyncRequest/Response`, `ConflictResponse`
**Common bugs / improvement areas:**
- `GroupLogEventType` enum additions must match `LOG_TEMPLATES` in engine — enforced by TypeScript (`Record<GroupLogEventType, ...>`) on `LOG_TEMPLATES`
- ~~`PersonalBlob` and `GroupBlob` lack version migration strategy~~ (FIXED — added `blobMigration.ts` with `CURRENT_BLOB_VERSION`, `migrateBlob()`, `registerPersonalMigration()`, `registerGroupMigration()`)
- ~~`ApiResponse.timestamp` is a string~~ — typed as `ISO8601String`; added `timestamp.ts` helpers: `nowISO()`, `createSuccessResponse()`, `createErrorResponse()`

### 5. Shared Utils — Validators, Dates, Currency
**Files:**
- `packages/shared/src/utils/validators.ts`
- `packages/shared/src/utils/dates.ts`
- `packages/shared/src/utils/currency.ts`
**What it does:** Pure stateless utility functions
**Key exports:**
- `isValidEmail`, `isValidPassword` (length 8-128, uppercase, lowercase, digit, special), `isValidAmount` (type guard), `isValidCurrency` (30-currency whitelist), `isValidUUID` (v4)
- `formatDate`, `parseDate`, `getMonthRange`, `isInPeriod`, `daysBetween`
- `formatCurrency`, `parseCurrency`, `convertCurrency`, `getCurrencySymbol`
**Known bugs:**
- ~~**`convertCurrency`** — Hardcoded `EXCHANGE_RATES` will become stale~~ (FIXED — exchange rates loadable via `COILDFI_EXCHANGE_RATES` env var as `USD=1,EUR=0.92,...`; falls back to extended table; `reloadExchangeRates()` available)
- ~~**`parseCurrency`** — Symbol-order-dependent~~ (FIXED — symbols sorted longest-first before matching: `C$` before `$`, `HK$` before `$`, etc.)
- ~~**`formatCurrency` / `parseCurrency`** — JPY/KRW decimal handling~~ (FIXED — `adjustAmountForCurrency` applied in both `parseCurrency` and `convertCurrency`; zero-decimal set expanded to JPY, KRW, VND, IDR)
- ~~**`isInPeriod`** — DST transition edge case~~ (FIXED — uses `Date.UTC()` for day boundaries instead of local `+86400000ms`)
- Password validator blocks sequences (abc, qwerty, 1234) and repeated chars (aaa) — already implemented (original note was stale)
**Improvement areas:**
- ~~Extract exchange rates to a configurable source~~ (FIXED — `COILDFI_EXCHANGE_RATES` env var)
- ~~Add DST-safe date calculations~~ (FIXED — `isInPeriod` uses UTC-based day boundaries)
- ~~Broaden currency whitelist~~ (FIXED — 37 currencies with symbols and rates from USD to HRK; `CURRENCY_SYMBOLS` is the canonical list)

### 6. Business Logic Engines — Budget & Analytics
**Files:**
- `packages/shared/src/engine/budgetTracker.ts`
- `packages/shared/src/engine/analyticsCalculator.ts`
- `packages/shared/src/engine/spendingDetector.ts`
**What it does:** Pure computation engines for personal finance analytics
**Key exports:**
- `computeBudgetStatus` — Category/date-range filtered, projected end-of-period, GREEN (<75%) / YELLOW (75-99%) / RED (>=100%)
- `checkBudgetAlerts` — Threshold, exceeded, projection warnings
- `computeBudgetSummary` — Aggregated totals, over-budget counts
- `computeSpendingByCategory`, `computeDailySpending` (zero-fills all days), `computeSavings`, `computeSpendingTrend`, `computeTopExpenses`
- `detectUnusualSpending` — Current vs historical (3 lookback periods, 30 days each), threshold-severity (1.2x low, 1.5x medium, 2x high)
- `getSpendingTrend` — Direction analysis over N periods (default 4 of 30 days)
**Known bugs:**
- **`budgetTracker`** — `remaining` correctly shows negative when over-budget; `percentUsed` clamped to 0 when `budget.amount === 0` (was `999_999.99`, now fixed)
- **`spendingDetector.getSpendingTrend`** — Now uses average across all historical periods (was only period 0 vs 1, now fixed); `percentOver` uses `999_999.99` instead of `Infinity` (fixed)
- **`analyticsCalculator.computeSpendingTrend`** — First month shows `null` for change (correct, not 0%)
- ~~**`computeSavings`** — Savings rate = 0 when totalIncome = 0; no handling for negative income~~ (FIXED — `savingsRate` is `null` when `totalIncome <= 0`, preventing misleading 0% when spending exceeds income)
**Improvement areas:**
- Lookback periods, thresholds, and projection methods are configurable via options param on `detectUnusualSpending` / `getSpendingTrend`

### 7. Business Logic Engines — Balances, Splits & Settlements
**Files:**
- `packages/shared/src/engine/balanceCalculator.ts`
- `packages/shared/src/engine/splitCalculator.ts`
- `packages/shared/src/engine/settlementEngine.ts`
- `packages/shared/src/engine/minimalTransferAlgorithm.ts`
**What it does:** Group finance computation engines
**Key exports:**
- `computeNetBalances` — Builds pairwise debt matrix from expenses + settlements, nets bidirectional, returns per-user `DetailedBalance`
- `calculateSplits` — Distributes by ratio/fixed/itemized with last-member remainder allocation (avoids floating-point drift)
- `proposeSettlement` / `markAsPaid` (supports partial) / `confirmReceipt` / `rejectPayment` / `cancelProposal` — Full settlement state machine with audit trail
- `getValidTransitions` — State machine query
- `generateMinimalTransfers` — Greedy debt-simplification (largest debtor ↔ largest creditor)
**Known bugs:**
- **`settlementEngine.markAsPaid`** — Partial payment creates a new remainder proposal and returns it as `remainderProposal` in the result (already correct)
- **`balanceCalculator`** — Settlement subtraction now clamps to 0 and creates reverse debt for excess amounts on overpayment (fixed)
- ~~**`balanceCalculator`** — No split vs settlement double-count check~~ (FIXED — added `detectSettlementOverlap()` that cross-references settlement `relatedExpenseIds` with expense `split.isPaid` status, returns structured warnings)
- **`personalLogBuilder`** — `getSplitAmount` consolidated into shared export from `balanceCalculator` (fixed); uses `ExpenseStatus.PENDING_APPROVAL` enum (was already correct)
- ~~**`splitCalculator`** — Auto-scaling silently corrects input errors~~ (FIXED — `calculateSplits()` now returns `{ splits, warnings }` with typed `SplitWarning` when ratios are normalized or fixed/itemized amounts are auto-scaled)
**Improvement areas:**
- ~~Add input validation layer to settlement engine~~ (FIXED — added `findDuplicateProposal()` to detect duplicate PROPOSED settlements between same users)
- `generateMinimalTransfers` produces empty `relatedExpenseIds` — caller must populate

### 8. Business Logic Engines — Audit Log & Personal Ledger
**Files:**
- `packages/shared/src/engine/logManager.ts`
- `packages/shared/src/engine/logTemplates.ts`
- `packages/shared/src/engine/personalLogBuilder.ts`
- `packages/shared/src/engine/types.ts`
**What it does:** Tamper-evident group activity logging and personal financial ledger
**Key exports:**
- `createGroupLogEntry` / `verifyLogChain` — SHA-512 hash-chained immutable log entries (blockchain-like)
- `LOG_TEMPLATES` — 18 human-readable message formatters for all event types
- `resolveLogMessage` — Looks up template by event type
- `buildPersonalLog` — Chronological personal ledger with running balance per member
**Known bugs:**
- ~~**`logManager.computeLogHash`** — Shallow key-sort doesn't handle nested `metadata`~~ (FIXED — `canonicalStringify()` recursively sorts keys at all nesting levels for deterministic hashing)
- **`logManager.verifyLogChain`** — Follows `previousLogHash` chain pointers from detected heads, not timestamps (already correct)
- ~~**`personalLogBuilder`** — Counterparty is raw user IDs, not display names~~ (FIXED — `buildPersonalLog()` accepts optional `displayNames: Record<string, string>` parameter; all counterparty fields use `resolveName()`)
- ~~**`personalLogBuilder`** — Settlement dates may be `undefined`~~ (fallback chain `markedPaidAt || proposedAt || createdAt` always yields a value since `createdAt` is required)
- ~~**`logTemplates`** — `fmt()` helper uses currency code prefix ("USD 15.00"), different from `formatCurrency` in utils which uses symbols ("$15.00")~~ (FIXED)
**Improvement areas:**
- ~~Add canonical JSON serialization for hash computation~~ (FIXED — `canonicalStringify` in `logManager.ts`)

### 9. Shared Errors — Crypto Error Types
**Files:** `packages/shared/src/errors/crypto.ts`
**What it does:** Typed crypto error hierarchy for client-side encryption failures
**Key exports:**
- `CryptoErrorCode` enum (13 codes: KEY_DERIVATION_FAILED, ENCRYPTION_FAILED, DECRYPTION_FAILED, INVALID_KEY, etc.)
- `CryptoError` — Custom Error subclass with `code`, `cause`, `toJSON()`, `fromUnknown()` factory
**Known bugs / improvement areas:**
- `fromUnknown` preserves the original CryptoError code — returns the original error unchanged instead of wrapping (fixed)
- ~~No `Error.captureStackTrace` in non-V8 environments~~ (FIXED — falls back to `this.stack = new Error().stack` when `captureStackTrace` is unavailable)

### 10. Shared Barrel Export
**Files:** `packages/shared/src/index.ts`
**What it does:** Re-exports all public API from shared package
**Notable:**
- `logManager` (`GroupLogEntry`, `createGroupLogEntry`, `verifyLogChain`) **IS** exported from the barrel via `export * from './engine/logManager'` (already correct)
- ~~`engine/types` meta interfaces are re-exported through `logTemplates` but not directly~~ (FIXED — added `export * from './engine/types'` and `export * from './engine/balanceCalculator'` to barrel)

---

## BACKEND CORE (`packages/backend`)

### 11. Backend Entry & App Factory
**Files:**
- `packages/backend/src/index.ts` (entry point)
- `packages/backend/src/app.ts` (app factory)
- `packages/backend/src/config.ts` (env schema)
- `packages/backend/src/types.d.ts` (type augmentations)
- `packages/backend/src/admin-server.ts` (stub)
**What it does:**
- `index.ts` — Boot sequence: logger init → error handlers → Redis connect → DB ping → build Fastify app → start listening → jobs processor → admin server (optional) → graceful shutdown handlers
- `app.ts` — Fastify factory: registers helmet, CORS (comma-separated origins), cookie (signed), rate-limit (100/min global), multipart (5 files, configurable size), JWT; decorates `authenticate`; hooks `requestMetrics`; global error handler (operational vs non-operational); 404 handler; registers all route modules
- `config.ts` — Zod-validated env schema; fails fast with `process.exit(1)` on invalid config
- `types.d.ts` — Augments `@fastify/jwt.FastifyJWT['user']` and Fastify instance/request types
- `admin-server.ts` — Stub returning `null` (separate admin server not implemented)
**Known bugs / improvement areas:**
- **Dynamic import** of admin server is only loaded when `ADMIN_ENABLED=true` — good for lazy loading, but the stub returns `null` and the boot sequence handles it gracefully
- **Cookie secret** — `COOKIE_SECRET` is now required in config schema (no fallback to JWT_SECRET), preventing accidental secret sharing (fixed)
- **`authenticate` decorator** now throws `AuthError` instead of sending 401 directly — consistent with middleware pattern (fixed)
- **Validation errors** from Fastify no longer leak schema details in production (fixed)
- `admin-server.ts` placeholder — no implementation yet
- **Slow-query threshold** configurable via `SLOW_QUERY_THRESHOLD_MS` env (fixed)
- **`VERSION`** constant read from `package.json` (fixed)
- All listed bugs already fixed — System 11 is clean

### 12. Backend Database Layer
**Files:**
- `packages/backend/src/db/pool.ts` (connection pool + helpers)
- `packages/backend/src/db/migrate.ts` (migration runner)
- `packages/backend/src/db/seed.ts` (test data seeder)
- `packages/backend/src/db/migrations/` (.sql migration files)
**What it does:**
- `pool.ts` — `pg.Pool` with `max: 20`, slow-query logging (>500ms), `transaction()` helper, `getClient()` for dedicated connections
- `migrate.ts` — Forward-only migration runner, alphabetical `.sql` files, transactional per migration, creates `_migrations` tracking table
- `seed.ts` — Creates 2 test users + 1 test group (idempotent via `ON CONFLICT`)
**Known bugs / improvement areas:**
- **Slow-query threshold** (500ms) is now configurable via `SLOW_QUERY_THRESHOLD_MS` env (fixed)
- **Pool errors** — `pool.on('error')` already uses structured `logger.error()` (not `console.error`)
- ~~**Migration runner** uses `__dirname` — may break when invoked from different working directory~~ (FIXED — `resolveMigrationsDir()` tries 3 paths: `__dirname/migrations`, `../../src/db/migrations` from dist, and `cwd/packages/backend/src/db/migrations`)
- **Seed data** uses `'encrypted-placeholder'` (Buffer) for encrypted blobs — real encryption setup required
- No migration rollback/down support
- **`pool.ts`** now exports typed `PoolStats` interface + `getPoolStats()` function (fixed)
- **`VERSION`** constant read from `package.json` (fixed)

### 13. Backend Error Hierarchy
**Files:** `packages/backend/src/errors/index.ts`
**What it does:** Complete error class hierarchy with `AppError` base class
**Classes:** `ValidationError` (400), `AuthError` (401, union of 8+ error codes), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429), `GroupError` (403), `SettlementError` (400), `DatabaseError` (500, operational), `ExternalServiceError` (502)
**Key features:**
- `isOperational` flag — distinguishes programmer errors from operational errors; only non-operational errors are captured by `errorCapture`
- `toJSON()` — Respects `NODE_ENV` for stack trace exposure
- `ERROR_CODES` — `as const` lookup table for all error codes with default messages and statuses
**Known bugs / improvement areas:**
- Some subclasses set `this.name` but not via `super()` — works but inconsistent (no runtime impact)
- `DatabaseError` is `isOperational: true` — correct for DB-as-external-resource perspective
- `ERR_RATE_LIMIT` used for 429s globally — no separate `TooManyRequests` class (consistent with global error handler)

### 14. Backend Middleware
**Files:**
- `packages/backend/src/middleware/requestMetrics.ts` — Request ID (UUIDv4), structured logging, hourly API metrics upsert (`api_metrics_hourly`), slow request tracking (>500ms), 5xx capture
- `packages/backend/src/middleware/rateLimiter.ts` — Redis-backed rate limiters: login (5/15min), register (3/1hr), password change (3/15min), 2FA verify (5/10min), refresh (30/15min)
- `packages/backend/src/middleware/requireAdmin.ts` — Role check (`request.user.role === 'owner'`)
- `packages/backend/src/middleware/adminAudit.ts` — Admin action audit logging (fire-and-forget)
- `packages/backend/src/middleware/requireGroupAccess.ts` — (Unused, pending removal) Group membership guard
- `packages/backend/src/middleware/requireGroupAdmin.ts` — (Unused, pending removal) Group admin guard
- `packages/backend/src/middleware/index.ts` — Barrel (exports only `requireAdmin`, `adminAudit`)
**Known bugs / improvement areas:**
- **`requestMetrics`** — `requestId` and `userId` are properly typed via `types.d.ts` augmentation (no `as any` cast); in-memory counters reset on restart; `slow_queries` table logs HTTP requests, not actual DB queries (misleading name)
- **`rateLimiter`** — `incr + expire` race condition on first request (benign, TTL overwritten); `passwordChangeRateLimiter` keys by `req.user?.userId` with IP fallback — if `userId` is missing, falls back to IP (good); **TTL is now refreshed on blocked attempts** (fixed)
- **`adminAudit`** — `target_type` and `target_id` are always `null` (unused fields); uses `console.error` fallback instead of structured logger; **`writeAdminAuditLog` extracted to shared middleware** (fixed)
- **Unused middleware files** (`requireGroupAccess.ts`, `requireGroupAdmin.ts`) — already removed from disk

---

## BACKEND ROUTES

### 15. Auth Routes
**Files:** `packages/backend/src/routes/auth.ts`
**Endpoints (10):**
| Method | Path | Rate Limit | Auth |
|--------|------|-----------|------|
| POST | `/register` | 3/hr | No |
| POST | `/login` | 5/15min | No |
| POST | `/2fa/verify` | 5/10min | No |
| POST | `/refresh` | 30/15min | No |
| POST | `/logout` | — | Yes |
| POST | `/logout-all` | — | Yes |
| POST | `/change-password` | 3/15min | Yes |
| POST | `/2fa/setup` | — | Yes |
| POST | `/2fa/enable` | — | Yes |
| POST | `/2fa/disable` | — | Yes |
**What it does:** Registration, login (with 2FA step-up), JWT token rotation, logout (single/all), password change, 2FA setup/enable/disable
**Known bugs / improvement areas:**
- **`/refresh`** — No longer duplicates DB query for user details; `TokenPair` extended with `displayName`/`personalSalt` (fixed)
- **Schema validation** — Added to `/logout` and `/logout-all` (fixed)
- **Cookie `maxAge`** — Normalized to consistent value across all endpoints (fixed)
- `ConflictError` (duplicate email) is thrown from `registerUser` and caught by global error handler — returns 409 with proper format
- **`/change-password`** now validates oldPassword != newPassword before hitting service (fixed)

### 16. Personal Data Routes
**Files:** `packages/backend/src/routes/personal.ts`
**Endpoints (6):**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/sync` | Yes | Get encrypted personal blob, vector clock, updatedAt |
| PUT | `/sync` | Yes | Store encrypted blob with conflict detection (integer VC, 409 on conflict, FOR UPDATE row lock) |
| POST | `/recovery-key` | Yes | Store encrypted PEK + recovery key hash |
| GET | `/recovery-key` | Yes | Retrieve stored encrypted PEK |
| POST | `/recover` | No | Validate recovery key (timingSafeEqual), return encrypted PEK (null if not found — prevents enumeration) |
| POST | `/recover/complete` | No | Complete recovery — bcrypt hash new auth key, update user, revoke all tokens |
**What it does:** Personal encrypted blob CRUD with vector-clock conflict detection, account recovery flow
**Known bugs / improvement areas:**
- **`personal_salt`** is regenerated on password change but NOT returned from `/change-password` — client may not receive the new salt and will derive wrong PEK. **Potential data loss bug**
- **Recovery flow** uses `Buffer.from` + `timingSafeEqual` for hash comparison — the stored hashes appear to be client-generated SHA-512 (not bcrypt), which is correct for zero-knowledge
- Recovery complete uses `SALT_ROUNDS = 12` — consistent with auth service
- Handlers wrapped in try/catch with manual error codes — consistent pattern
- **Recovery error codes** standardized (`MISSING_FIELDS` → `ERR_VALIDATION`, `RECOVERY_FAILED` → `ERR_INTERNAL`, `INVALID_AUTH_KEY` → `ERR_VALIDATION`) (fixed)
- **Fastify schemas** added to `/recover` and `/recover/complete` (fixed)

### 17. Group Routes
**Files:** `packages/backend/src/routes/group.ts`
**Endpoints (8):**
| Method | Path | Auth | Guard | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Yes | — | List user's groups (member count, yourBalance=0 hardcoded) |
| GET | `/:groupId` | Yes | — | Get group name + salt (**No membership check!**) |
| POST | `/create` | Yes | — | Create group, admin becomes member_index=0, emit `group-created` WS |
| POST | `/join` | Yes | — | Verify passphrase (timingSafeEqual), assign next member_index, emit `member-joined` WS |
| GET | `/:groupId/members` | Yes | `requireGroupMember` | List members (balance=0 hardcoded) |
| GET | `/:groupId/sync` | Yes | `requireGroupMember` | Get encrypted group blob + vector clock |
| PUT | `/:groupId/sync` | Yes | `requireGroupMember` | Store encrypted blob with distributed VC merge, emit `group-synced` WS |
| POST | `/:groupId/leave` | Yes | `requireGroupMember` | Soft-delete (set left_at), emit `member-left` WS |
**What it does:** Group CRUD, membership management, encrypted blob sync with distributed vector clock (per-user counters), `detectConflict()` and `mergeClocks()` for conflict resolution
**Known bugs / improvement areas:**
- **Security issue: GET `/:groupId`** — Anyone authenticated can read any group's name and salt. No membership check. Leaks group metadata
- **`yourBalance` / `balance`** hardcoded to 0 everywhere — balance computation not implemented
- **`requireGroupMember`** optimized to single JOIN query (group + membership combined) (fixed)
- **Fastify schemas** added to `/create` and `/join` (fixed)
- **Response status codes** inconsistent — some use `reply.status(200)`, others omit (defaults to 200)
- **Group passphrase** uses client-generated verifier stored raw (zero-knowledge design — server never knows actual passphrase)

### 18. Notification Routes
**Files:** `packages/backend/src/routes/notifications.ts`
**Endpoints (7):**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/push/subscribe` | Yes | Register Web Push subscription (validates HTTPS URL, base64 auth/p256dh) |
| DELETE | `/push/unsubscribe` | Yes | Remove push subscription by endpoint |
| GET | `/` | Yes | Get in-app notification feed (last 100, unread count) |
| PATCH | `/:id/read` | Yes | Mark single notification as read |
| POST | `/read-all` | Yes | Mark all as read |
| GET | `/preferences` | Yes | Get notification preferences (returns defaults if none set) |
| PUT | `/preferences` | Yes | Update preferences (validates keys against whitelist) |
**What it does:** In-app notification CRUD, Web Push subscription management, notification preferences with quiet hours support
**Known bugs / improvement areas:**
- **`WebPushService`** instantiated once at route setup time — good for performance
- In-app feed queries notifications AND unread count in **separate queries** — could use `COUNT(*) OVER()`
- `ENDPOINT_URL_REGEX` only checks `https://` prefix — does not validate full URL structure
- Quiet hours validation handles overnight ranges (22:00-07:00)
- All handlers wrapped in try/catch with manual error codes

### 19. Admin Routes
**Files:** `packages/backend/src/routes/admin.ts` (544 lines — largest route file)
**Endpoints (40+):** Dashboard stats, endpoint monitoring, slow queries, DB/Redis health, system logs, error events, request tracing, cache inspection, user management (CRUD + force-logout/suspend/ban/restore/delete), security dashboard (failed logins, suspicious IPs, rate limit hits, security score), alert rules (CRUD + test/evaluate), background jobs (stubs), system config (CRUD + history + maintenance mode), admin audit log, system health
**What it does:** Full admin panel API — 9 sections covering monitoring, user management, security, alerts, config, audit, health, debug tools
**Known bugs / improvement areas:**
- **All job queue endpoints are stubs** — return `BullMQ not configured`
- **User deletion** is destructive and irreversible — anonymizes FK references before deleting user record
- **Security score** is a weighted calculation (2FA 30%, login failures 25%, rate limits 20%, suspicious IPs 25%)
- **`logAdminAction`** was duplicated inline — now uses shared `writeAdminAuditLog` from `adminAudit` middleware (fixed)
- **IP blocking** stores in Redis (`admin:blocked_ips`) and is enforced by `ipBlocker` middleware (global `onRequest` hook) — fixed
- Some endpoints return 404 manually (error detail, user detail), others don't
- `adminAudit` middleware IS applied to `/health` and `/health/history` endpoints (fixed)

### 20. Health Routes
**Files:**
- `packages/backend/src/routes/health.ts` — Basic health (DB ping, Redis ping, liveness, readiness)
- `packages/backend/src/routes/health-enhanced.ts` — Enhanced health (system info, DB pool stats, Redis INFO, request metrics) + Prometheus `/metrics` endpoint
**What it does:** Health check endpoints for orchestration and monitoring
**Known bugs / improvement areas:**
- **`health-enhanced.ts`** — dynamic `require('os')` replaced with static ES module import (fixed)
- **Custom Prometheus exporter** — no `prom-client` library, manually formatted metrics. Works but fragile
- **`getDatabaseInfo`** now uses typed `getPoolStats()` interface instead of casting `pool` to `any` (fixed)
- **`getRedisInfo`** parses Redis `INFO` command output with regex — may break if Redis output format changes
- `activeConnections` in metrics hardcoded to 0

---

## BACKEND SERVICES

### 21. Auth Service
**Files:** `packages/backend/src/services/authService.ts` (480 lines)
**Functions (11):** `registerUser`, `loginUser` (with lockout), `generateTokens`, `refreshAccessToken` (with token reuse detection → cascade revocation), `revokeAllUserTokens`, `logoutUser`, `logoutAllDevices`, `changePassword`, `generate2FASecret` (dynamic import of `qrcode`), `verify2FASetup`, `verify2FALogin`, `disable2FA`
**What it does:** Complete auth business logic — registration, password-based login (bcrypt, 12 rounds), 2FA (TOTP via `otplib`), JWT token generation/rotation/revocation, account lockout (5 attempts, 15min window), token reuse detection
**Key security features:**
- Refresh token rotation with **reuse detection** — using a revoked token revokes ALL sessions
- Account lockout: `config.MAX_LOGIN_ATTEMPTS` failed attempts locks for `config.LOGIN_WINDOW_MINUTES`
- Personal salt regenerated on every password change
- JWT expiry parsed from config string (`15m`, `1h`, etc.) via regex `^(\d+)([smhd])$`
**Known bugs / improvement areas:**
- **Lockout window** is fixed from last failed attempt, NOT a rolling window — if user tries once every 14 minutes, they'll never lock out
- **`changePassword`** now validates oldPassword != newPassword before processing (fixed)
- **`registerUser`** CRITICAL FIX: INSERT was missing `personal_data_enc` column (NOT NULL), causing registration to always fail. Now includes `personal_data_enc`, `personal_vc`, and `default_currency` (fixed)
- **`generateTokens`** computes `expiresIn` in seconds from string — will break if format changes
- **`ISSUER_NAME`** changed from placeholder to `ColdFi` (fixed)
- **QR code** is dynamically imported only when setting up 2FA — good for startup performance
- `isValidEmail` from shared package is the only input validation before DB calls

### 22. Redis Service
**Files:** `packages/backend/src/services/redis.ts`
**Functions:** `setupRedis` (singleton), `getRedis`, `setTempToken` (TTL default 900s), `getTempToken` (one-time read+delete), `deleteTempToken`, `cacheGet<T>`, `cacheSet` (TTL default 3600s), `cacheDelete`, `closeRedis`
**What it does:** ioredis client management, temp token storage (for 2FA flow), generic caching (admin stats)
**Known bugs / improvement areas:**
- **Singleton pattern** with module-level `let redis: Redis | null = null`
- `lazyConnect: true` — connects on first command
- Retry strategy: exponential backoff (200ms-5s), max 10 attempts, then stops
- `getTempToken` is **one-time use** (GET + DEL) — critical for 2FA security token
- No connection pooling or cluster support — single instance
- `closeRedis` sets variable to `null` allowing re-initialization
- Redis used for TWO purposes: temp tokens (one-time) and caching (TTL-based — must be explicit)

### 23. Logger Service
**Files:** `packages/backend/src/services/logger.ts`
**What it does:** DB-backed structured logger with buffered batch flush (every 5 seconds, max 100 entries/batch), sensitive data redaction (16 key patterns), convenience methods (`requestStart`, `requestEnd`, `authEvent`), production suppression of debug level
**Known bugs / improvement areas:**
- **Buffer capped at 1000** — oldest entries silently dropped when full
- **`fatal`** calls `flush()` but doesn't await (fire-and-forget with imminent process exit)
- **On flush failure** — entries are re-buffered to the FRONT of the queue. If flushing consistently fails, this prevents newer entries from being evicted
- **Sanitization** is recursive and checks 16 sensitive key substrings case-insensitively — comprehensive
- Developer mode has ANSI color codes for readability
- `requestEnd` derives log level from status code (500+ = error, 400+ = warn, else info)

### 24. Error Capture Service
**Files:** `packages/backend/src/services/errorCapture.ts`
**Functions:** `captureError` (deduplicates by stack hash), `registerGlobalErrorHandlers` (unhandledRejection + uncaughtException)
**What it does:** Global error capture with stack-hash-based deduplication, occurrence counting, affected user tracking, DB upsert. On uncaught exception, exits process after 2 seconds.
**Known bugs / improvement areas:**
- **Entire `captureError` body is try-caught** — prevents error capture from causing cascading failures
- **Stack hash** is first 16 hex chars of SHA-512 of stack (or message if no stack) — used for dedup
- `errorMessage` truncated to 2000 chars for DB storage
- `affected_users` calculated by querying `system_logs` for matching stack hash with non-null userId
- Node.js deprecated the `promise` parameter of `unhandledRejection` in newer versions
- `registerGlobalErrorHandlers` handler for unhandledRejection does NOT exit (unlike uncaughtException)

### 25. Monitoring Service
**Files:** `packages/backend/src/services/monitoringService.ts` (762 lines — largest service file)
**Functions (27):** Aggregate stats (cached 30s Redis), registration rate, active user timeline, endpoint metrics (p50/p95/p99 approximated — NOT accurate percentiles), error rate overview with spike detection, slow queries, DB health (pg_stat_*), running queries, DB stats history, Redis stats, system logs (paginated, filtered), error events (paginated), error detail (with related logs), resolve error, request trace, anonymized user list (email SHA-256 hash), user detail, user activity, failed login stats, suspicious IPs, rate limit hits, security score (weighted 0-100), IP blocking (Redis), health history, cache inspect/clear
**What it does:** Admin monitoring and statistics — comprehensive PostgreSQL introspection queries
**Known bugs / improvement areas:**
- **Endpoint p50/p95/p99** are approximated as `max_duration * 0.5 / 0.95 / 0.99` — **this is completely wrong**. True percentiles require `percentile_cont` or `percentile_disc` window functions
- **`getAnonymizedUsers`** uses complex JOIN LATERAL with dynamic SQL (string concatenation of `paramIdx`) — error-prone
- **`getUserPersonalDetail`** queried `length(personal_data_enc::text)` — fixed to use `octet_length(personal_data_enc)` (avoids cast overhead)
- **`getRunningQueries`** typed as `RunningQuery[]` instead of `any[]` (fixed)
- **Security score** has `total || 1` division guard but calculation could be more robust
- Many functions accept raw interval strings (`${days} days`) — SQL injection theoretically possible (though parameterized)
- Email hashing uses PostgreSQL native `sha256` + `encode`, not application-level
- Heavy reliance on PostgreSQL system views (`pg_stat_activity`, `pg_statio_user_tables`) — not portable

### 26. Alert Service
**Files:** `packages/backend/src/services/alertService.ts`
**Functions:** `evaluateAlertRules` (all enabled rules, checks cooldown), `testAlertRule` (single rule evaluation)
**Supported metrics:** `error_rate`, `disk_space` (uses OS free memory — **wrong**, not disk), `memory`, `p99_latency`, `reg_rate`, `queue_depth` (returns 0 — stub), `ssl_expiry` (returns 90 — stub), `db_connections`
**What it does:** Alert rule evaluation engine — fetches metric values, compares against thresholds, creates alert history entries on breach
**Known bugs / improvement areas:**
- **`disk_space`** uses `os.freemem()` — this is available memory, not disk space! Completely wrong metric
- **`queue_depth`** and **`ssl_expiry`** are stubs (return 0/90)
- **Cooldown** uses string concatenation for interval expression: `($2::int || ' minutes')::interval`
- **No notification channels** implemented — alerts are only inserted into `alert_history` and logged to console. No email, webhook, SMS, or push dispatch
- Severity: 1x threshold = info, 1.2x = warning, 2x = critical (relative ratio)

### 27. Web Push Service
**Files:** `packages/backend/src/services/webPush.ts`
**Class:** `WebPushService` — Push subscription management, notification sending, preferences with quiet hours
**Functions:** `subscribe`, `unsubscribe`, `removeAllSubscriptions`, `sendWebPush` (per-subscription, handles 410 Gone), `sendToUsers` (sequential, not parallel), `getPreferences`, `updatePreferences` (dynamic SQL, key-whitelisted)
**Standalone:** `generateVapidKeys()` — generates VAPID keys
**Known bugs / improvement areas:**
- **`sendToUsers`** sends sequentially — slow for many users (could use `Promise.allSettled`)
- **VAPID keys** set globally at module level via `webpush.setVapidDetails()` — if env vars missing, `webpush.sendNotification` will throw
- **Subscription cleanup** — invalid (410) endpoints are cleaned up in batch after sending
- TTL 86400s (24 hours) for push notifications
- **`sendWebPush`** checks preferences (enabled, category-specific, quiet hours) — comprehensive
- `updatePreferences` builds SQL dynamically — safe because keys are whitelisted by route handler
- Push payload includes `icon`, `badge`, `data` for Service Worker

### 28. Reminder Service
**Files:** `packages/backend/src/services/reminderService.ts`
**Class:** `ReminderService` — Recurring bill reminder management
**Functions:** `createReminder`, `getPendingReminders` (scheduled_at <= now(), ordered), `markSent`, `markFailed`, `processReminder` (sends push, fails only on exception — stays pending if 0 sent due to quiet hours), `createSettlementReminders`, `getUserReminders`, `cancelGroupReminders` (marks pending as failed), `cleanupOldReminders` (90 days)
**What it does:** Generates and processes recurring bill reminders via Web Push
**Known bugs / improvement areas:**
- **Smart retry** — if `sendWebPush` returns 0 (quiet hours, disabled), reminder stays pending for next cycle
- Uses `make_interval(days => $1)` — PostgreSQL-specific function
- Cleanup deletes sent/failed reminders older than 90 days (configurable)

### 29. Background Jobs
**Files:**
- `packages/backend/src/jobs/index.ts` — BullMQ job processor setup
- `packages/backend/src/jobs/reminderWorker.ts` — Reminder job worker
**What it does:** BullMQ queue processing for background tasks (reminders)
**Known bugs / improvement areas:**
- **Admin job endpoints are stubs** — `getQueues`, `getQueueDetail`, `getFailedJobs`, `retryJob` all return `BullMQ not configured`
- **`setupJobProcessor`** was a no-op that never wired up the reminder worker. Now properly connects `reminderWorker` to the queue processor (fixed)
- **`reminderWorker`** — all `console.log`/`console.error`/`console.warn` calls replaced with structured `logger.*` calls (fixed)

### 30. Backend WebSocket Plugin
**Files:** `packages/backend/src/plugins/websocket.ts`
**What it does:** Socket.IO server attached to Fastify's HTTP server. JWT auth middleware (`io.use`), group room management (`join-group`, `leave-group`), member online/offline tracking, `emitToGroup` / `emitToUser` / `getGroupConnectionCount` helpers
**Known bugs / improvement areas:**
- **JWT secret duplication** — Socket.IO auth middleware uses `jsonwebtoken` directly (not `@fastify/jwt`). If JWT config changes in one place but not the other, auth breaks. **Maintenance hazard — fixed**: replaced `jwt.verify(token, JWT_SECRET)` with `app.jwt.verify(token)` (delegates to `@fastify/jwt`)
- **Plugin never registered** — `websocketPlugin` exported by never registered in `app.ts`. All `emitToGroup` calls in group routes would crash (`getIO()` throws "Socket.IO not initialised"). **Fixed**: registered `websocketPlugin` in `app.ts` before routes
- **DB query per `join-group`** — validates membership on every socket join. Could be a bottleneck for large groups with frequent reconnections
- **No rate limiting on socket events** — malicious client could spam `join-group`
- **Memory management** — `userSockets` and `socketGroups` maps properly cleaned up on disconnect (no leak risk)
- **Event types emitted:** `expense:created/updated/deleted`, `settlement:proposed/updated`, `member:joined/left/online/offline`, `group:created/updated/synced`, `notification:new`

---

## FRONTEND CORE (`packages/web`)

### 31. Frontend Entry & Routing
**Files:**
- `packages/web/src/main.tsx` — React entry: QueryClient (5min stale time, 1 retry), ErrorBoundary, RouterProvider
- `packages/web/src/router.tsx` — createBrowserRouter with lazy-loaded pages via `React.lazy()`
- `packages/web/src/App.tsx` — **DEAD CODE** (unused, router handles everything)
- `packages/web/index.html` — SPA entry HTML
- `packages/web/public/sw.js` — Service Worker (minimal)
- `packages/web/env/.env.example` — Web-specific env template
- `packages/web/src/vite-env.d.ts` — Vite client type declarations
**Route structure:**
- Public: `/login`, `/register`
- Protected (via `ProtectedRoute` checking `isAuthenticated` + `isLoading`): `/dashboard`, `/expenses/*`, `/budgets`, `/groups/*`, `/analytics`, `/import`, `/recaps`, `/recurring`, `/notifications`, `/settings/*` (6 sub-pages), `/admin/*` (10 sub-pages)
- Catch-all `*` → redirect to `/login`
**Known bugs / improvement areas:**
- **No 404 page** — catch-all redirects to `/login`, which is confusing (should show a "not found" page)
- **Auth initialization** happens synchronously before first render via `useAuthStore.getState().initialize()`
- All pages must be default exports (lazy loading requirement)
- **`App.tsx`** dead code should be removed

### 32. Frontend Auth Store
**Files:** `packages/web/src/stores/authStore.ts`
**State:** `userId`, `email`, `displayName`, `accessToken`, `pek` (CryptoKey — Personal Encryption Key), `personalSalt`, `role`, `isAuthenticated`, `isLoading`, `isInitialized`, `pekMissing`, `pekErrorMessage`, `error`
**Actions:** `login` (derives authKeyHash + PEK, handles 2FA), `register`, `logout` (resetAllStores + broadcast), `initialize` (refresh token), `refreshToken`, `updateProfile` (local only — **no API call**), `clearError`, `setPek`, `derivePek`, `resolvePekMissing`
**Key pattern:** Uses raw `fetch()` targeting `${API_BASE}/api/auth/*` with `credentials: 'include'` for cookies
**Known bugs / improvement areas:**
- **`initialize()` does NOT restore `pek`** — **Fixed**: Added `pekMissing` state, `resolvePekMissing` action, and `PekPromptModal` overlay component. When PEK is null after token refresh, the modal prompts for passphrase and calls `derivePek()`
- **`updateProfile`** no longer calls nonexistent `PATCH /api/auth/profile` endpoint (fixed)
- **`login` now destructures `displayName`** from response (fixed)
- `role` fallback: `role || 'user'` in login/register, `role || null` in initialize — inconsistent
- Initialization swallows all errors (sets `isInitialized: true` regardless)
- PEK is derived from `passphrase + personalSalt` — if salt changes (password change) but client doesn't receive new salt, PEK derivation will produce wrong key

### 33. Frontend Personal & Recurring Stores
**Files:**
- `packages/web/src/stores/personalStore.ts`
- `packages/web/src/stores/recurringStore.ts`
**What it does:** Personal encrypted blob CRUD — fetch/save/add/update/delete expenses, budgets, categories, recurring bills. Uses PEK from authStore for encrypt/decrypt via Web Crypto API. Vector clock timestamp-based conflict detection.
**Known bugs / improvement areas:**
- **`personalStore.addBudget`** no longer uses stale `categories` from top-level state — now reads `personalBlob?.categories` directly (fixed)
- **`generateId()`** uses `Date.now()_random9chars` (Math.random) — not crypto-safe, acceptable for client IDs
- **Vector clock** is `Date.now()` — a simple timestamp, not a proper Lamport clock. Potential conflicts under concurrent edits
- **`personalBlob.version`** field exists but is never incremented or checked
- **`recurringStore.toggleRecurringBill`** now has proper catch block with error state and re-throw (fixed)
- **`recurringStore`** is a thin wrapper around `personalStore` — little added abstraction
- **Duplicate `generateId`** pattern in recurringStore (`rb_` prefix) — should be consolidated

### 34. Frontend Group Store
**Files:** `packages/web/src/stores/groupStore.ts`
**What it does:** Group CRUD, encrypted blob sync (GET+PUT with retry on 409, up to 3 attempts), distributed vector clock, group key derivation & caching (Map<string, CryptoKey>), WebSocket member updates
**Key features:**
- `createGroup` generates salt + SHA-256 passphrase verifier
- `joinGroup` fetches group by invite code, hashes passphrase, verifies, caches group key
- `createGroupExpense` / `proposeSettlement` — optimistic sync: GET blob → decrypt → push → encrypt → PUT (retry 3x on 409)
- Exports `getGroupKey` and `cacheGroupKey` for other stores (used by logStore)
**Known bugs / improvement areas:**
- **`myBalance` hardcoded to 0** in `fetchGroupById` — balance is never computed
- **`deriveGroupKey` in groupStore** (PBKDF2 with deterministic salt `coldfi-gk-${groupId}`) is **different from `deriveGroupKey` in crypto.ts** (which uses variable salt). The store version is the one actually used — **duplicate code with different implementation**. If they diverge, group data becomes undecryptable
- **`joinGroup`** uses `inviteCode` parameter for both info endpoint AND group key cache — conflates invite code with group ID
- **Group passphrase** stored in `groupKeyCache` for session duration — once cached, no need to re-enter
- **No encryption for group member data** — members list fetched unencrypted

### 35. Frontend Analytics, Notification, Log, Error Stores
**Files:**
- `packages/web/src/stores/analyticsStore.ts` — Monthly recap computation (client-side from personalStore data)
- `packages/web/src/stores/notificationStore.ts` — In-app notification feed (fetch, mark read, mark all read, add from socket)
- `packages/web/src/stores/logStore.ts` — Group activity log (fetch from encrypted blob), SHA-256 integrity verification
- `packages/web/src/stores/errorStore.ts` — Client-side error aggregation (max 200 entries, crypto.randomUUID for IDs)
**Known bugs / improvement areas:**
- **`logStore.verifyIntegrity`** now returns `{ valid: false, totalChecked: 0 }` on ANY error (network, decryption, no group key, no blob) — no longer falsely reports data as valid when verification fails (fixed)
- **`logStore` hash chain** uses string concatenation (`previousHash|timestamp|...|details`) — if any field contains `|`, the chain breaks. Fragile serialization
- **`notificationStore`** — no `deleteNotification` action; only mark as read
- **`analyticsStore` savings rate** — `(totalBudgeted - totalSpent) / totalBudgeted * 100` with `Math.max(0, ...)` — savings rate is never negative (overspending shown as 0% savings)
- **`analyticsStore`** budget period filtering uses year-month string comparison — edge cases with multi-month budgets
- **`errorStore`** has no way to remove individual errors (only `clearErrors` — all or nothing)
- **Notification store** — `markAsRead`/`markAllAsRead` update local state AFTER API success (not optimistic, no rollback)

### 36. Frontend Admin Store
**Files:** `packages/web/src/stores/adminStore.ts`
**What it does:** 40+ data fetching methods for all admin panel sections — stats, monitoring, users, security, alerts, config, audit, health, jobs, debug
**Key pattern:** All calls go through `authFetch()` which prepends `/api` and attaches Bearer token
**Known bugs / improvement areas:**
- **Entire store is typed `any`** — zero type safety on any API response. **Significant maintenance concern**
- **Loading state only set in `fetchStats`** — all other fetch actions don't set `loading: true/false`. Loading indicator unreliable for most sections
- **Error state only set in `fetchStats` and `fetchUsers`** — most failures go to `console.error` only, no store-level error state
- `resolveError` calls `fetchErrorEvents()` without `await` — fire-and-forget (fixed — now awaited)
- `clearCache` calls `inspectCache(pattern)` without `await` — fire-and-forget (fixed — now awaited)
- `toggleMaintenance` never refreshes config state
- No pagination state preserved — each fetch replaces entire array

### 37. Frontend Crypto Library
**Files:** `packages/web/src/lib/crypto.ts`
**What it does:** Client-side cryptography using Web Crypto API — PBKDF2-SHA-512 (600,000 iterations) key derivation, AES-256-GCM encrypt/decrypt, key import/export, hex/base64 conversion, context-separated key derivations (auth, PEK, group, member log)
**Key functions:** `deriveAuthKey`, `derivePEK`, `deriveGroupKey`, `deriveMemberLogKey`, `encryptData`, `decryptData`, `deriveKey`, `importKey`, `encryptJson`, `decryptJson`
**Known bugs / improvement areas:**
- **`deriveMemberLogKey`** takes an already-derived group key (`Uint8Array`) and uses it as PBKDF2 secret for per-member key — unusual design (typically you'd use the group key directly as AES key)
- **`deriveGroupKey` in crypto.ts** is now the canonical implementation — groupStore imports from crypto.ts (fixed)
- Error messages are generic (`'Encryption failed'`) — no details about what specifically went wrong
- **`aesEncrypt`/`aesDecrypt`** are internal (not exported)
- Uses `TextEncoder` / `TextDecoder` for all encoding — works in all modern browsers

### 38. Frontend API Client & Networking
**Files:**
- `packages/web/src/lib/apiClient.ts` — Typed HTTP client with auto-refresh on 401, 30s timeout, error categorization, query param serialization
- `packages/web/src/lib/tabSync.ts` — BroadcastChannel cross-tab auth sync (login/logout events)
- `packages/web/src/lib/errorReporter.ts` — Global error capture (window.onerror, unhandledrejection, console.error monkey-patch)
- `packages/web/src/lib/resetStores.ts` — Pub/sub logout reset mechanism
**Known bugs / improvement areas:**
- **`apiClient` is NEVER used by any store** — all stores use raw `fetch()` directly. The `apiClient` appears to be **dead code** or an incomplete migration
- **`errorReporter`** — console.error is monkey-patched, capturing ALL errors (including potential reporter self-errors). Messages >2000 chars ignored; messages truncated to 1000 chars. No deduplication
- **`tabSync`** — graceful fallback if BroadcastChannel unsupported; channel name is `coldfi_auth_sync`
- **`resetStores`** — simple pub-sub with error isolation per callback; no deregistration mechanism

### 39. Frontend Data Export, Recovery, Receipt, Push
**Files:**
- `packages/web/src/lib/dataExport.ts` — CSV export (manual construction), encrypted backup (.ftb format with password-derived key), import (direct store mutation)
- `packages/web/src/lib/recovery.ts` — BIP39-style 24-word recovery phrase, PEK recovery bundle, `recoverPEK` decryption
- `packages/web/src/lib/receipt.ts` — Receipt file validation (5MB max, JPEG/PNG/WebP/PDF), read as base64, upload to server
- `packages/web/src/lib/pushNotifications.ts` — Service Worker registration, Web Push subscription, server sync
**Known bugs / improvement areas:**
- **`dataExport.importEncryptedBackup`** — directly mutates store state via `setState`, bypassing ALL API calls and normal store actions. Imported data is set without encryption re-wrapping or server sync. Imported state will be overwritten on next server fetch
- **`dataExport.exportExpensesCSV`** — manual CSV construction with double-quote escaping — proper but fragile
- **`receipt.uploadReceiptToServer`** — constructs Blob directly from base64 via `atob` + `Uint8Array` (no round-trip) (fixed)
- **`recovery.generateRecoveryPhrase`** — **CRITICAL FIX**: entropy buffer increased from 32 to 48 bytes (`RECOVERY_WORD_COUNT * 2`). The 32-byte buffer caused a buffer over-read — indices 32-47 read `undefined`, making the last 8 words always map to word index 0 ("abandon") (fixed)
- **`recovery.generateRecoveryBundle`** — **SECURITY FIX**: `recoveryKeyHash` now computes SHA-512 of the PBKDF2-derived key (256-bit, 600k iterations) instead of the plaintext phrase. Previously, an attacker with DB access could brute-force the phrase offline without paying PBKDF2 cost (fixed)
- **`recovery`** uses NFKD normalization — good practice for mnemonic phrases
- **`pushNotifications.sendSubscriptionToServer`** now uses `useAuthStore.getState()` instead of reading from `localStorage` — more reliable and secure (fixed)
- **`dataExport.fetchGroups()`** no longer fire-and-forget (fixed)
- **`pushNotifications.unsubscribeFromPush`** uses `navigator.serviceWorker.ready` with try/catch fallback (fixed)

### 40. Frontend Hooks
**Files:**
- `packages/web/src/hooks/useWebSocket.ts` — Socket.IO client with manual reconnection (exponential backoff 1-30s, max 10 attempts, jitter), room management (re-joins on reconnect), event handlers that update stores
- `packages/web/src/hooks/useTabSync.ts` — Wraps `tabSync.ts`, calls `initialize()` / `logout()` on cross-tab events
- `packages/web/src/hooks/usePushNotifications.ts` — Push notification permission hook (cancellation flag pattern is incomplete/broken)
**Known bugs / improvement areas:**
- **`useWebSocket`** — deep dependency chain (`connect` → `setupEventHandlers` → `scheduleReconnect`); event data typed as `Record<string, unknown>` — minimal type safety
- **`usePushNotifications`** — cancellation flag pattern uses `useEffect` cleanup (correct pattern) — note was stale (fixed)
- Socket URL from `VITE_WS_URL` env var with fallback to `http://localhost:3001`
- `reconnection: false` in Socket.IO config (manual reconnect implemented)
- `connectionState` union type: `'disconnected' | 'connecting' | 'connected' | 'reconnecting'`

### 41. Frontend Layout & Shared Components
**Files:**
- `packages/web/src/components/layout/AppLayout.tsx` — Main app shell: responsive sidebar (collapsible via `w-60`/`w-16`), top header, mobile bottom nav, initializes `useTabSync` + `useWebSocket`, renders `PekPromptModal`
- `packages/web/src/components/PekPromptModal.tsx` — PEK restoration overlay: prompts for passphrase when `pekMissing` is true after session refresh
- `packages/web/src/components/layout/AdminLayout.tsx` — Admin panel shell with role-gating (`role === 'owner'`), 10-item side nav
- `packages/web/src/components/ErrorBoundary.tsx` — Class-based React error boundary with global error listeners
- `packages/web/src/components/ConnectionStatus.tsx` — WebSocket connection status badge
- `packages/web/src/components/ReceiptUpload.tsx` — Drag-and-drop + click-to-browse receipt upload
**Known bugs / improvement areas:**
- **`AppLayout`** — `NAV_ITEMS` have emoji icons (not empty — note was stale); active link detection using `startsWith` — `/settings` always appears active on all settings sub-pages (intentional or not); **mobile bottom nav now shows all 7 items** (had missing items, fixed)
- **`AdminLayout`** — destructures full `useAuthStore()` (subscribes to ALL changes, not just `role`/`email`) — unnecessary re-renders
- **`ErrorBoundary`** — uses `useErrorStore` inside class component via `.getState()` (correct pattern)
- **`ReceiptUpload`** — clears `inputRef.current.value` after pick to allow re-selection
- **`Sidebar.tsx`** — deleted (dead code, replaced by AppLayout) (fixed)

---

## FRONTEND PAGES

### 42. Auth Pages
**Files:**
- `packages/web/src/pages/LoginPage.tsx` — Login form with client-side validation (email + password), 2FA support
- `packages/web/src/pages/RegisterPage.tsx` — Registration form with password strength validation
**Known bugs / improvement areas:**
- **`LoginPage`** — emails lowercased via `email.trim().toLowerCase()`; password complexity NOT validated on login (only on register)
- **`RegisterPage`** — validates password includes uppercase, lowercase, and number
- Both clear errors on field change: `setErrors((p) => ({ ...p, email: undefined }))`
- Empty catch block after `login`/`register` calls — error is set in store but not handled locally

### 43. Dashboard & Personal Finance Pages
**Files:**
- `packages/web/src/pages/DashboardPage.tsx` — Overview with monthly spent, budget remaining, budget bars, 7-day CSS bar chart, recent 5 expenses
- `packages/web/src/pages/ExpenseListPage.tsx` — Full list with search, filters (category, method, dates, amount range), pagination (20/page), desktop table + mobile cards
- `packages/web/src/pages/ExpenseFormPage.tsx` — Add/Edit expense form with Zod validation, receipt upload, date capped to today
- `packages/web/src/pages/BudgetViewPage.tsx` — Budget management with per-category cards, status badges, progress bars, projection warnings, BudgetFormModal
- `packages/web/src/pages/AnalyticsPage.tsx` — Analytics with recharts (PieChart + BarChart), period selector (Week/Month/Year), summary cards
**Known bugs / improvement areas:**
- **`DashboardPage`** — bar chart is hand-rolled CSS (no library) using `maxDaily` for proportional heights; all amounts hardcoded in `$` (USD)
- **`ExpenseListPage`** — `PAGE_SIZE = 20` constant; amount total computed from filtered results, not all expenses
- **`ExpenseFormPage`** — form state initialized once via `useState` with function reading `existingExpense`. If expenses change while editing, form state does NOT update — stale data. `isRecurring` hardcoded `false`; **receipt upload now stores reference ID, not full base64** in payload (fixed)
- **`BudgetViewPage`** — `getStatusColor`/`getBarColor`/`getStatusLabel` duplicated from DashboardPage (code duplication); **`alertThreshold` now reads existing budget value on edit** instead of always resetting to 80 (fixed)
- **`AnalyticsPage`** — bar chart code path diverges for 'year' vs other periods; `projectedMonthly = dailyAvg * 30` — rough estimate; uses `recharts` (heavy dependency for one page); **`dailyAvg` fixed to use days-in-period, not transaction count** (was projecting wrong values, fixed)

### 44. Group Pages
**Files:**
- `packages/web/src/pages/groups/GroupsPage.tsx` — Group listing with cards, create/join buttons, modals
- `packages/web/src/pages/groups/GroupDetailPage.tsx` — Group detail with header, 4-tab navigation (Expenses/Settlements/Activity Log/Members), clears `currentGroup` on unmount
- `packages/web/src/pages/groups/ExpensesTab.tsx` — **Stub** ("No expenses yet")
- `packages/web/src/pages/groups/SettlementsTab.tsx` — Pending + history settlement list + SettlementDialog
- `packages/web/src/pages/groups/ActivityLogTab.tsx` — Activity log with filter chips, integrity verify button, SHA-256 hash display, "Tampered" badge
- `packages/web/src/pages/groups/MembersTab.tsx` — Member list with balance, admin badge
- `packages/web/src/pages/groups/SettlementDialog.tsx` — Propose settlement modal (who pays/receives, amount, note)
- `packages/web/src/pages/groups/CreateGroupModal.tsx` — Create group form (name + passphrase)
- `packages/web/src/pages/groups/JoinGroupModal.tsx` — Join group form (invite code + passphrase)
- `packages/web/src/pages/groups/ExpenseForm.tsx` — Group expense form with split modes (Equal/Exact/Percentage), itemized items (optional)
**Known bugs / improvement areas:**
- **`ExpensesTab`** is a stub — group expense listing not yet implemented
- **`GroupDetailPage`** tab matching uses `startsWith('/' + tab.path)` — path prefix collisions possible
- **`GroupExpenseForm`** — category list is hardcoded (not from store); no editing mode (create only); members from `currentGroup?.members ?? []`
- **`SettlementDialog`** — backdrop click closes modal (common pattern)
- **ActivityLogTab** — `isValid` check: falsy value triggers "Tampered" badge (not just `undefined`/`false`)
- **Stub pages:** `pages/GroupListPage.tsx` and `pages/GroupDetailPage.tsx` at root level render "Coming soon" — the real pages are in `groups/` subdirectory

### 45. Settings Pages
**Files:**
- `packages/web/src/pages/settings/SettingsLayout.tsx` — Settings sidebar nav + Outlet
- `packages/web/src/pages/settings/ProfileSettings.tsx` — Profile edit (display name, email, currency)
- `packages/web/src/pages/settings/SecuritySettings.tsx` — Change password (stub: "not yet available"), 2FA toggle (local only), recovery key (stub)
- `packages/web/src/pages/settings/AppearanceSettings.tsx` — Dark mode toggle (NOT persisted — resets on refresh)
- `packages/web/src/pages/settings/GroupsSettings.tsx` — Group list with view/leave buttons
- `packages/web/src/pages/settings/DataExportSettings.tsx` — CSV export, encrypted backup export/import
- `packages/web/src/pages/settings/AboutSettings.tsx` — Static about page (version 1.0.0)
- `packages/web/src/pages/settings/TabSyncStatus.tsx` — BroadcastChannel support indicator
- `packages/web/src/pages/SettingsPage.tsx` — **Stub** ("Coming soon") — real settings in subdirectory
**Known bugs / improvement areas:**
- **`ProfileSettings`** calls `updateProfile()` which is CLIENT-SIDE ONLY (no API call). Changes are lost on refresh
- **`SecuritySettings`** — password change explicitly not implemented; 2FA toggle does NOT persist to backend
- **`AppearanceSettings`** — dark mode persists to localStorage (note was stale)
- **`SettingsPage.tsx`** at root level deleted — real settings routed via settings subdirectory (fixed)

### 46. Admin Pages
**Files:** `packages/web/src/pages/admin/` (10 pages)
- `AdminDashboardPage.tsx` — Stats grid, endpoint metrics, top groups
- `AdminUsersPage.tsx` — User list with search/filter, detail panel, actions (force logout, suspend, ban, restore, delete)
- `AdminMonitoringPage.tsx` — DB health, Redis stats, error spikes, slow queries
- `AdminDebugPage.tsx` — Tabbed: logs, errors, trace, cache inspect/clear
- `AdminSecurityPage.tsx` — Security score, failed logins, block IP, suspicious IPs, rate limit hits
- `AdminAlertsPage.tsx` — Alert rules CRUD, alert history, modal form for rules
- `AdminConfigPage.tsx` — System config viewer/editor, maintenance mode toggle, change history
- `AdminAuditLogPage.tsx` — Audit log with action filter and pagination
- `AdminHealthPage.tsx` — Health overview with per-service checks, 24h history
- `AdminJobsPage.tsx` — Job monitoring with auto-refresh (15s interval)
**Known bugs / improvement areas:**
- **All admin pages** use `useAdminStore` which is typed `any` — no type safety
- **AdminUsersPage** uses `prompt()` and `confirm()` dialogs — blocking, no accessibility
- **AdminJobsPage** auto-refreshes every 15s via `setInterval` — no cleanup on unmount? (depends on implementation)
- **AdminDashboardPage** — `formatBytes` utility, `StatCard` helper component (defined inline)
- Alert rules modal form has metric, condition, threshold, window, enabled fields

### 47. Misc Pages
**Files:**
- `packages/web/src/pages/import/ImportPage.tsx` — 4-step CSV import wizard: Upload → Map Columns → Preview → Confirm
- `packages/web/src/pages/notifications/NotificationsPage.tsx` — Notification inbox with type icons, time ago, mark read, navigation to related group
- `packages/web/src/pages/recaps/RecapsPage.tsx` — Monthly spending recap with "Download as Image" button (html2canvas)
- `packages/web/src/pages/recurring/RecurringBillsPage.tsx` — Recurring bills listing, add/edit modal, active toggle
**Known bugs / improvement areas:**
- **`ImportPage`** — no batch API; each expense imported sequentially via `await addExpense()`; no progress indicator for many rows; auto-mapping heuristic is regex-based
- **`NotificationsPage`** — navigation uses segment-based path `/groups/:id/settlements` (note was stale)
- **`RecapsPage`** — `fetchRecap` called on mount via useEffect — works correctly (note was stale)
- **`RecapsPage`** — `html2canvas` dynamically imported only on download click (good for performance)
- **`RecurringBillsPage`** — `BillFormModal` imports `Frequency` type from `personalStore` (cross-store dependency); uses `useEffect` to sync `initialData` into local state

---

## CROSS-CUTTING CONCERNS

### 48. Security & Encryption (Cross-cutting)
**Areas:** Client-side crypto (lib/crypto.ts), server-side auth (authService.ts, auth routes), group store key derivation, recovery flow, error redaction in logger
**What it covers:**
- **Client-side:** PBKDF2-SHA-512 (600,000 iterations) with context-separated keys (auth, PEK, group, member log), AES-256-GCM encrypt/decrypt, BIP39-style 24-word recovery phrase
- **Server-side:** bcrypt (12 rounds), JWT signing/rotation, TOTP 2FA (otplib), timing-safe comparisons (crypto.timingSafeEqual), account lockout (5 attempts, 15min), token reuse detection, HTTP-only signed cookies, Helmet headers, CORS whitelist
- **Logging:** Sanitizer redacts 16+ sensitive key patterns (password, token, secret, key, authKey)
- **Rate limiting:** Redis-backed, per-route and global (100/min)
**Known security issues:**
- **No PEK restoration on page refresh** — `authStore.initialize()` does not re-derive PEK. **Fixed**: Added `pekMissing` state, `resolvePekMissing` action, and `PekPromptModal` component that prompts for passphrase when PEK is null after token refresh
- **`requireGroupAccess`** — middleware files deleted; group routes use their own inline guards (fixed)
- **GET `/:groupId`** has membership check — no longer leaks group data (note was stale)
- **Blocked IPs enforced** by `ipBlocker` middleware (global `onRequest` hook) — checks incoming requests against `admin:blocked_ips` (fixed)
- **Duplicate group key derivation** — `groupStore.ts` and `crypto.ts` have different `deriveGroupKey` implementations. **Fixed**: Consolidated into crypto.ts; groupStore imports from crypto.ts
- **Recovery key hash** now hashes the PBKDF2-derived key (600k iterations), not the plaintext phrase — prevents offline brute-force of recovery phrases (fixed)
- **Recovery phrase entropy** — buffer increased to 48 bytes to fix buffer over-read that caused last 8 words to always be "abandon" (fixed)

### 49. Type Safety & Dead Code
**Areas across whole codebase:**
- **Admin store** is entirely typed `any` — largest type safety gap
- **`apiClient.ts`** — deleted (dead code, never used by any store) (fixed)
- **`App.tsx`** — deleted (dead code, router handles everything) (fixed)
- **`Sidebar.tsx`** — deleted (replaced by `AppLayout.tsx` inline sidebar) (fixed)
- **`requireGroupAccess.ts`**, **`requireGroupAdmin.ts`** — deleted (unused middleware) (fixed)
- **`admin-server.ts`** — deleted (stub returning null; admin routes integrated in main app) (fixed)
- **`SettingsPage.tsx`**, **`GroupListPage.tsx`**, **`GroupDetailPage.tsx`** (root-level) — deleted (stub pages; real implementations in subdirectories) (fixed)
- **`crypto.ts deriveGroupKey`** — function exists but never imported at runtime (used only by tests) (fixed)
- **`requestMetrics`** — `request as any` casts for `requestId`/`userId` (not in type augmentation)

### 50. Documentation
**Files:** `docs/` directory
- MUST-READ: `MASTER.md`, `ARCHITECTURE.md`, `CONTEXT.md`, `RULES.md`, `RULES-SUMMARY.md`
- PHASES/: 120+ phase-by-phase implementation documents
- PLANS/: 19 high-level plan documents
- REFERENCE/: Changelog, stack, design, etc.
- SKILLS/: `context.md`, `verify.md`
- TRACKING/: `CONTEXT-MAP.md`, `PROGRESS.md`, `STRUCTURE.md`
- `docs/SECURITY-AUDIT-CHECKLIST.md` — Standalone security audit checklist
- `README.md` (root) — Project overview readme
**Note:** Documentation is comprehensive but may be out of sync with actual code

---

## TESTS

### 51. Tests & Test Infrastructure
**Files (10 test files total):**
- `packages/shared/src/engine/__tests__/` (8 files):
  - `analyticsCalculator.test.ts` — Tests for analytics engine
  - `balanceCalculator.test.ts` — Tests for balance computation
  - `budgetTracker.test.ts` — Tests for budget tracking
  - `logManager.test.ts` — Tests for hash-chained log system
  - `minimalTransferAlgorithm.test.ts` — Tests for debt simplification
  - `settlementEngine.test.ts` — Tests for settlement state machine
  - `spendingDetector.test.ts` — Tests for unusual spending detection
  - `splitCalculator.test.ts` — Tests for expense split calculation
- `packages/backend/src/services/__tests__/authService.test.ts` — Backend auth service tests (register, login, lockout, 2FA)
- `packages/web/src/lib/__tests__/crypto.test.ts` — Frontend crypto library tests

**What it covers:** Unit tests for core business logic engines, auth service, and crypto library
**Framework:** Vitest (all packages)
**Known gaps / improvement areas:**
- **No frontend store tests** — all Zustand stores (auth, personal, group, admin, etc.) have zero test coverage
- **No backend route tests** — route handlers have no integration or e2e tests
- **No backend middleware tests** — rate limiter, request metrics, admin audit all untested
- **No frontend component tests** — pages, layout components, modals all untested
- **No e2e tests** — no Playwright/Cypress tests for the full user flow
- **`packages/shared/vitest.config.ts`** — exists and works correctly (stale note)
- **Coverage limited to pure functions** — the most testable parts (shared engines) are tested, but nothing with I/O or state dependencies
- **`authService.test.ts`** only covers register and login — password change, 2FA, token refresh, and lockout edge cases are untested

---

## MISCELLANEOUS

### 52. Runtime & Build Artifacts
**Files:**
- `packages/backend/backend.log` — Backend runtime application log
- `packages/backend/backend.err.log` — Backend runtime error log
- `packages/web/frontend.log` — Frontend runtime log
- `packages/web/frontend.err.log` — Frontend runtime error log
**What it does:** Runtime log output files generated during development. Should be added to `.gitignore` to prevent accidental commits.
**Note:** These are runtime artifacts, not source files.

## How To Use This Reference

When reporting bugs or requesting improvements, use the system number:

> **"Fix bug in System 6 — analyticsCalculator computeSpendingTrend first month shows 0% change"**
> **"Check System 32 — authStore initialize() doesn't restore PEK, data undecryptable on page reload"**
> **"Review System 21 — auth service lockout window should be rolling, not fixed"**
> **"System 17 — group route GET /:groupId leaks group metadata without membership check"**
> **"Improve System 37 — crypto.ts deriveGroupKey is dead code, groupStore has its own version"**
> **"System 45 — AppearanceSettings dark mode not persisted across page refresh"**
> **"Bug in System 7 — settlementEngine.markAsPaid partial payment creates remainder proposal but never returns it"**
> **"System 38 — apiClient.ts is unused dead code, all stores use raw fetch()"**
> **"System 47 — NotificationsPage navigation uses query param ?tab=settlements but routing is segment-based"**
