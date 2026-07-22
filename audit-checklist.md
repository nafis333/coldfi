# Full-Stack Audit Checklist

## How to Use
Each section below lists frontend files, backend files, stores, and specific **checkpoints** to verify. Mark `[ ]` as you audit. Each checkpoint targets a specific bug class: missing state updates, incorrect API contracts, stale data, error handling gaps, null-safety, security, race conditions, UI consistency.

---

## Phase 1: Auth & Onboarding

### 1.1 Login
**Files:** `pages/LoginPage.tsx` · `stores/authStore.ts` (login) · `routes/auth.ts` (POST /login) · `services/authService.ts` (loginUser) · `services/tokenService.ts` (generateTokens)

**Checkpoints:**
- [ ] `authStore.login` — on 2FA path (`requires2FA: true`), set() includes `userId`, `personalSalt`, `tempToken`, `email` but NOT `accessToken` — verify2FA must fill it.
- [ ] `authStore.login` — on non-2FA path, `set()` includes all fields: `userId`, `email`, `displayName`, `accessToken`, `pek`, `personalSalt`, `encryptedPek`, `role`, `isAuthenticated`, `isGoogleUser`.
- [ ] `authStore.login` — error re-throw is original error (not wrapped). LoginPage catches `'2FA_REQUIRED'` via `err.message` — works if `err instanceof Error`, but what if `err` is non-Error (network abort)?
- [ ] `authStore.login` — `computeAuthKeyHash(passphrase, email)` — does the frontend and backend agree on the hash format? Backend stores bcrypt of hex string.
- [ ] Backend `loginUser` — lockout check: `config.LOGIN_WINDOW_MINUTES` and `config.MAX_LOGIN_ATTEMPTS` — hardcoded or configurable? If config keys missing, what default?
- [ ] Backend `loginUser` — `two_factor_enabled` check returns `tempToken` stored in Redis with 300s TTL — who cleans up stale tokens on expiry?
- [ ] Backend `loginUser` — for non-2FA users, response includes `rawPek` (decrypted from `server_encrypted_pek`) — if decryption fails (wrong SERVER_ENCRYPTION_KEY), error is logged but no `rawPek` returned → frontend falls back to stored PEK.
- [ ] `authStore.verify2FA` — `set()` now includes all fields (was fixed earlier to include `accessToken`, `displayName`, `role`, `isGoogleUser`). Verify set is complete.
- [ ] `authStore.verify2FA` — calls `broadcastLogin`. Verify.
- [ ] `authStore.verify2FA` — does NOT clear `tempToken` after success. Should it?
- [ ] `services/twoFactorService.ts` — `verify2FALogin` calls `generateTokens(userId)` which returns full token pair — no `rawPek` in response. Frontend gets `encryptedPek` and derives PEK via `deriveAndStorePek(passphrase, personalSalt, encryptedPek)`. This requires `personalSalt` to still be in store from initial login call.
- [ ] LoginPage state: `errors` (local validation) vs `error` (store error) vs `localError` (caught from store throw) — all three displayed correctly? Race between `error` and `localError`?
- [ ] `LoginPage` catch: `if (err instanceof Error && err.message === '2FA_REQUIRED')` — uses `setNeed2FA(true)`. What if the 2FA step fails and user clicks "Go back"? Does `clearError()` fire? Does `tempToken` get cleared?
- [ ] Login form: `autoComplete="current-password"`, `autoFocus` on email — accessible.
- [ ] Password visibility toggle (eye icon) — already fixed.

### 1.2 Register
**Files:** `pages/RegisterPage.tsx` · `stores/authStore.ts` (register) · `routes/auth.ts` (POST /register) · `services/authService.ts` (registerUser) · `services/cryptoUtils.ts` (encryptServerKey, generateRecoveryCode)

**Checkpoints:**
- [ ] `authStore.register` — generates `personalSalt` locally, sends to server. Server echoes it back — frontend ignores server value and uses local. If server transforms it (unlikely), mismatch.
- [ ] `authStore.register` — `saveAuthToStorage` called with local `displayName` (form value), not server response. OK since server stores whatever was sent.
- [ ] `authStore.register` — `rawPek` sent to server (for `server_encrypted_pek`) — this is the base64 of raw PEK bytes. Server encrypts with `SERVER_ENCRYPTION_KEY`. This means the raw PEK exits the client in the HTTP request body — necessary for recovery flow but is an exposure surface. Is HTTPS enforced?
- [ ] Backend `registerUser` — INSERT sets `password_hash = hashedAuthKey` AND `auth_key_hash = hashedAuthKey`. Two columns for the same value? Check if `password_hash` is used anywhere else or is dead column.
- [ ] Backend `registerUser` — `personal_data_enc = Buffer.from('')`, `personal_vc = '[]'` (stringified array). Is the default vector clock format compatible with sync logic?
- [ ] Backend `registerUser` — `recovery_code_hash` is set via a separate UPDATE (line 88-91 in authService.ts) instead of the main INSERT. Why? Partial update could fail.
- [ ] Backend `registerUser` — `server_encrypted_pek` is set via a separate UPDATE (line 83-85). Same concern.
- [ ] Backend register — response sends `displayName: tokens.displayName` which comes from `generateTokens` (queries DB). Newly created user's `display_name` in DB is set to the input value. Should match.
- [ ] Register validation: password must include uppercase, lowercase, number — checked client-side only. Server only checks `authKeyHash.length >= 32`. Server relies on client to enforce password policy. If client sends weak hash, server accepts it.
- [ ] `PasswordStrengthMeter` — does it have all edge cases (empty, short, common patterns)?
- [ ] `RecoveryCodeDisplay` — does it copy to clipboard? Is it shown only once?
- [ ] Google Sign-In button on register page — verify CSP allows it (fixed in previous round).

### 1.3 Recovery
**Files:** `pages/RecoveryPage.tsx` · `routes/auth.ts` (POST /recover, /recover/complete) · `services/passwordService.ts` (recoverAccount) · `services/cryptoUtils.ts` (encryptServerKey, decryptServerKey)

**Checkpoints:**
- [ ] RecoveryPage step 1: `POST /api/auth/recover` with `{ email, recoveryCode }` — code is normalized: `.trim().toLowerCase().replace(/-/g, '')` on backend. Frontend sends raw string — normalization mismatch? Frontend should also normalize before sending.
- [ ] RecoveryPage step 1 response: `rawPek` comes from `decryptServerKey(user.server_encrypted_pek)` — if `server_encrypted_pek` is null/empty, route returns `ERR_RECOVERY_FAILED`. Error message is generic (good security).
- [ ] RecoveryPage step 1: `base64ToUint8Array(data.rawPek)` — if `rawPek` is undefined/null, `atob(undefined)` throws. No defensive check.
- [ ] RecoveryPage step 2: `POST /api/auth/recover/complete` — sends `tempToken`, `authKeyHash`, `personalSalt`, `encryptedPek`. Backend re-encrypts `server_encrypted_pek` from `data.rawPek` (stored in Redis tempToken).
- [ ] RecoveryPage step 2: `authKeyHash` computed with `computeAuthKeyHash(newPassword, email)` — uses the email from React state, not the original registered email. Same email, should be fine.
- [ ] RecoveryPage step 2: after success, PEK stored via `storage().setItem(PEK_STORAGE_KEY, ...)` — fixed to use `storage()` (sessionStorage). But user is NOT logged in — they're redirected to /login. The PEK in sessionStorage will be lost when navigating away (sessionStorage is per-tab). User must log in fresh. This is by design.
- [ ] RecoveryPage: zeroes `pekBytes` after use (`zeroBytes(pekBytes)`) — good security practice.
- [ ] Backend `/recover` — rate limiter keyed on email (lin 95): `keyFn: (req) => (req.body as any)?.email || req.ip` — if email missing, falls back to IP. OK.
- [ ] Backend `/recover/complete` — rate limiter keyed on IP only. Good (tempToken already scopes the session).
- [ ] Backend `recoverAccount` — timing-safe comparison of recovery code hash via `crypto.timingSafeEqual`. But if hashes are different lengths, early return (line 107) leaks length info. `hashRecoveryCode` uses SHA-512 so output is always 128 hex chars. Input hash is also 128 chars. No length leak.
- [ ] Backend `/recover/complete` — after updating user, revokes ALL refresh tokens. Good — all sessions invalidated after password reset.

### 1.4 Google Sign-In
**Files:** `components/GoogleSignInSection.tsx` · `stores/authStore.ts` (googleLogin) · `routes/auth.ts` (POST /google) · `services/authService.ts` (googleLogin)

**Checkpoints:**
- [ ] `GoogleSignInSection` — loads GSI script dynamically. CSP updated to allow `https://accounts.google.com`. Verify Vercel env var `VITE_GOOGLE_CLIENT_ID` is set.
- [ ] `GoogleSignInSection` — cleanup effect cancels on unmount (interval for `window.google` polling). No memory leak.
- [ ] `GoogleSignInSection` — renders `h-10` placeholder div while loading. No layout shift.
- [ ] `authStore.googleLogin` — sets `pek: null`, `personalSalt: null`, `encryptedPek: null`, `isGoogleUser: true`. Correct — Google users have no PEK.
- [ ] `authStore.googleLogin` — response includes `googleNewUser` flag. Frontend ignores it. Should it show onboarding for new Google users?
- [ ] Backend `googleLogin` — verifies Google ID token with `OAuth2Client`. Handles missing/tampered tokens.
- [ ] Backend `googleLogin` — checks email first; if existing user without `google_id`, links the Google ID. If existing user WITH `google_id` for a different Google account, what happens? It updates `google_id` to the new one (line 224-227). This could be a security issue — if someone gains access to a different Google account with the same email, they could relink.
- [ ] Backend `googleLogin` — for new users, generates random `internalPass` for `password_hash` and `auth_key_hash`. Creates user with empty `personal_salt`, `encrypted_pek`, and no `server_encrypted_pek`. Recovery via password is impossible for pure Google users.
- [ ] Backend `googleLogin` — rate limiter `loginRateLimiter` is used (line 187). Keyed on `ip:email`. OK.
- [ ] `googleLogin` frontend error handling: `data.message || data.error || 'Google login failed'` — all error surfacing paths covered.

### 1.5 Protected Route / PEK Prompt
**Files:** `components/ProtectedRoute.tsx` · `components/PekPromptModal.tsx` · `stores/authStore.ts` (pekMissing, resolvePekMissing)

**Checkpoints:**
- [ ] `ProtectedRoute` — redirects to `/login` if not authenticated. Uses `isAuthenticated` and `isInitialized` from store. If `isInitialized` is false, shows nothing or loading state?
- [ ] `PekPromptModal` — shown when `pekMissing` is true. User enters passphrase, calls `resolvePekMissing(passphrase)` which calls `derivePek`. Error message "Incorrect passphrase" shown on failure.
- [ ] `PekPromptModal` — can user dismiss it? If yes, what happens to pages that need PEK? If no, it's a forced modal.

---

## Phase 2: Dashboard

**Files:** `pages/DashboardPage.tsx` · `components/dashboard/*.tsx` · `hooks/useOverview.ts` · `stores/personalStore.ts`

**Checkpoints:**
- [ ] `DashboardPage` — loads data via `useOverview` hook. Does it handle loading/error/empty states?
- [ ] `OverviewCards` — total expenses, income, balance. Currency formatting respects `defaultCurrency`. If all data is zero/null, shows zeros or "-"?
- [ ] `IncomeWidget` — shows recent income logs. If empty, shows empty state? If incomeLogs not present in personalBlob (missing field), crashes?
- [ ] `BudgetHealthWidget` — shows budget vs actual. Handles missing `budgetStatuses` field.
- [ ] `SavingsTargetsWidget` — shows savings targets. Handles missing `savingsTargets` field.
- [ ] `SpendingTrendChart` — recharts integration. Handles empty data array. Handles single data point.
- [ ] `QuickActions` — links to /expenses/new, /groups, /import. All links valid.
- [ ] Backend `GET /personal` (or `GET /sync`) — returns personal blob. If no data exists, `encryptedBlob: null`. Frontend must handle null blob gracefully.

---

## Phase 3: Personal Expenses

### 3.1 Expense List
**Files:** `pages/ExpenseListPage.tsx` · `pages/expenses/*.tsx` · `stores/personalExpenseStore.ts`

**Checkpoints:**
- [ ] `ExpenseListPage` — loads expenses from `personalExpenseStore`. Handles loading/error/empty.
- [ ] `ExpenseFilterPanel` — filter by category, date range, search text. All filters composed correctly?
- [ ] `ExpenseDesktopTable` / `ExpenseMobileCards` — responsive. Sorting works? Pagination correct?
- [ ] `ExpensePagination` — page calculation: `totalPages = Math.ceil(total / limit)`. Handles zero total. Handles invalid page param.
- [ ] `GroupExpenseTab` — shows group expenses alongside personal. Does it properly query group stores? Does it handle absent group data?
- [ ] `personalExpenseStore` — mutations (create/update/delete) call `savePersonalBlob()` to persist. If save fails, does the store revert? Check rollback logic.
- [ ] `personalExpenseStore` — `addExpense` / `updateExpense` / `deleteExpense` — all update the `PersonalBlob` correctly and call save. If save succeeds but another tab's sync overwrites, race condition possible.

### 3.2 Expense Form
**Files:** `pages/ExpenseFormPage.tsx` · `pages/expenses/CategoryPicker.tsx` · `components/ReceiptUpload.tsx`

**Checkpoints:**
- [ ] `ExpenseFormPage` — edit mode: loads expense by ID from route param. If ID invalid, shows error or redirects.
- [ ] `ExpenseFormPage` — create mode: fresh form. Validation: amount > 0, date valid, category selected.
- [ ] `CategoryPicker` — shows user's categories from personalBlob. If categories is empty array, shows default set or add-category prompt?
- [ ] `ReceiptUpload` — file upload, preview. Handles file type validation (image/pdf). Size limit? Cancel upload?
- [ ] `ExpenseFormPage` — on save, calls store method. On success, navigates back to expense list. On error, shows error message, stays on form.
- [ ] `ExpenseFormPage` — unsaved changes warning when navigating away?

### 3.3 Receipt
**Files:** `lib/receipt.ts` · `lib/receiptPDF.ts`

**Checkpoints:**
- [ ] `lib/receipt.ts` — upload to server, get URL back. Parses receipt data (OCR if available).
- [ ] `lib/receiptPDF.ts` — generates PDF from expense data. Fonts, layout, multi-page? Works offline?
- [ ] Backend receipt handling — file upload validation, size limits, storage (local/S3?), cleanup.

---

## Phase 4: Budgets

**Files:** `pages/BudgetViewPage.tsx` · `pages/budget/BudgetFormModal.tsx` · `stores/personalBudgetStore.ts`

**Checkpoints:**
- [ ] `BudgetViewPage` — loads budgets from `personalBudgetStore`. Shows budget vs actual spending. Progress bars, over-budget warnings.
- [ ] `BudgetFormModal` — create/edit budget: category, amount, period (monthly/weekly/yearly). Validation: amount > 0, category required.
- [ ] `BudgetViewPage` — period selector. When changing period, budgets recalculate correctly.
- [ ] `personalBudgetStore` — operations consistent with other personal sub-stores.

---

## Phase 5: Personal Incomes

**Files:** `stores/personalIncomeStore.ts`

**Checkpoints:**
- [ ] `personalIncomeStore` — CRUD operations, blob persistence. Handles missing `incomeLogs` in blob fallback.
- [ ] Income data displayed in Dashboard (`IncomeWidget`) and Analytics. No orphan data.

---

## Phase 6: Groups (Most Complex)

### 6.1 Group List
**Files:** `pages/groups/GroupsPage.tsx` · `components/groups/CreateGroupModal.tsx` · `components/groups/JoinGroupModal.tsx` · `routes/group.ts` (GET /, POST /create, POST /join, GET /invite/:code) · `services/groupService.ts` · `stores/groupStore.ts`

**Checkpoints:**
- [ ] `GroupsPage` — lists user's groups. Loading/error/empty states. Refresh on focus/navigation.
- [ ] `CreateGroupModal` — form: name, passphrase, currency. Frontend generates `passphraseVerifier` (PBKDF2-hashed passphrase). Sends `{ name, passphraseVerifier, salt, defaultCurrency }`. Server stores verifier, not plaintext.
- [ ] `JoinGroupModal` — form: invite code, passphrase. Lookup invite code via `GET /invite/:code` before joining? Or direct join via `POST /join`? If lookup fails, error displayed.
- [ ] `POST /join` — requires `inviteCode` and `passphraseVerifier`. Passphrase must match the group's stored verifier. Server compares verifiers.
- [ ] Backend `createGroup` — generates invite code. Returns it to creator. Is invite code stored in DB? Can creator share it?
- [ ] Backend `lookupInvite` — returns group info (name, member count) without auth. No salt or verifier exposed.

### 6.2 Group Overview
**Files:** `GroupDetailPage.tsx` · `GroupOverviewTab.tsx` · `GroupOverviewCards.tsx` · `GroupRecentActivity.tsx` · `GroupSpendingCharts.tsx` · `GroupMonthlyTrend.tsx` · `BalanceOverviewSection.tsx` · `SpentByPersonSection.tsx` · `TimeRangeFilter.tsx` · `SettlementSection.tsx` · `routes/group.ts` (GET /:groupId, GET /:groupId/balance-summary) · `services/groupService.ts`

**Checkpoints:**
- [ ] `GroupDetailPage` — layout with tabs (Overview, Expenses, Invoices, Activity, Statement, Members, Settings). Active tab highlighted. Sub-route navigation via `<Outlet>`.
- [ ] `GroupDetailPage` — loads group data on mount via `groupId` from route params. Cleanup does NOT clear `currentGroup` (fixed in previous round).
- [ ] `TimeRangeFilter` — custom date range, preset periods (7d, 30d, 90d, 1y). Parent reset re-mounts via key (fixed).
- [ ] `BalanceOverviewSection` — shows who owes whom. Data from `GET /:groupId/balance-summary`. Handles empty balances.
- [ ] `SpentByPersonSection` — per-person spending breakdown. Handles zero spenders.
- [ ] `SettlementSection` — settlement suggestions. If all settled, shows "All settled" state.
- [ ] `GroupSpendingCharts` / `GroupMonthlyTrend` — recharts. Empty/single-data edge cases.
- [ ] `GroupRecentActivity` — recent activity feed across all members. Handles empty.

### 6.3 Group Expenses
**Files:** `pages/groups/ExpensesTab.tsx` · `pages/groups/GroupExpenseForm.tsx` · `pages/groups/CategoryPicker.tsx` · `stores/groupExpenseStore.ts` · `routes/group.ts` (expense CRUD via sync/blob)

**Checkpoints:**
- [ ] `ExpensesTab` — lists group expenses. Group expenses stored in encrypted blob, not individual DB rows. The entire blob is synced.
- [ ] `GroupExpenseForm` — create/edit group expense: description, amount, paid by (member selector), split type (equal, custom, percentage, shares), date. Validation.
- [ ] `GroupExpenseForm` — when editing, pre-fills form from existing expense data.
- [ ] `groupExpenseStore` — operations update the encrypted blob and trigger sync. Conflict handling on concurrent writes.
- [ ] `groups/CategoryPicker.tsx` — group-specific categories vs personal categories. Distinct?

### 6.4 Group Invoices
**Files:** `pages/groups/GroupInvoicesTab.tsx` · `InvoiceSummaryCards.tsx` · `ItemizedList.tsx` · `ItemRowEditor.tsx`

**Checkpoints:**
- [ ] `GroupInvoicesTab` — shows invoices for the group. Data from encrypted blob? Or separate DB table?
- [ ] `InvoiceSummaryCards` — invoice totals, paid/unpaid counts.
- [ ] `ItemizedList` — line items per invoice. Editable?
- [ ] `ItemRowEditor` — add/edit/remove line items. Validation.

### 6.5 Group Activity
**Files:** `pages/groups/ActivityLogTab.tsx` · `stores/logStore.ts`

**Checkpoints:**
- [ ] `ActivityLogTab` — shows activity log from `logStore`. Filter by action type? Date range?
- [ ] `logStore` — loads activity log from server. Pagination? Cache?
- [ ] Backend activity log — how is it populated? Via `user_activity_log` table or separate group log table?

### 6.6 Group Statement (Personal Log)
**Files:** `pages/groups/PersonalLogTab.tsx`

**Checkpoints:**
- [ ] `PersonalLogTab` — shows the current user's personal log for the group. Per-member encrypted logs.
- [ ] Correct decryption and display of personal log entries.

### 6.7 Group Members
**Files:** `pages/groups/MembersTab.tsx`

**Checkpoints:**
- [ ] `MembersTab` — lists group members, their roles (admin/member), their join date. Current user highlighted.
- [ ] Promote/demote actions for admins? Or only in settings?
- [ ] Leave group action. Confirmation dialog. If last admin, prevent leaving.

### 6.8 Group Settings
**Files:** `pages/groups/GroupSettingsTab.tsx` · `routes/group.ts` (PUT /:groupId, PUT /:groupId/passphrase)

**Checkpoints:**
- [ ] `GroupSettingsTab` — pre-fills name and currency from `currentGroup` (fixed). Save updates group metadata.
- [ ] Change passphrase: requires new passphrase verifier and salt. Must be admin.
- [ ] Invite management: create/revoke invites. Listed with expiry.
- [ ] `GET /:groupId/invites` / `DELETE /:groupId/invites/:inviteId` — requires group admin. OK.
- [ ] Delete group: is there a delete action? Not in current routes. Only leave group.

### 6.9 Group Sync
**Files:** `lib/groupSync.ts` · `routes/sync.ts` · `stores/groupStore.ts` · `stores/groupExpenseStore.ts` · `stores/groupSettlementStore.ts`

**Checkpoints:**
- [ ] `groupSync` — syncs encrypted group blob with server. Vector clock based concurrency control.
- [ ] Conflict detection: 409 response → data has changed since last read. Frontend must re-fetch and retry.
- [ ] After sync success, local stores updated with new blob data.
- [ ] WebSocket events: `group-synced`, `member-joined`, `member-left`, `group-created`, `group-updated`, `passphrase-changed` — all events handled on frontend to update stale data.

---

## Phase 7: Analytics

**Files:** `pages/AnalyticsPage.tsx` · `pages/analytics/*.tsx` · `stores/analyticsStore.ts`

**Checkpoints:**
- [ ] `AnalyticsPage` — source selector (personal / groups / all). When switching source, data refetches.
- [ ] `FilterBar` — period selector, category filter, date range. Filters compose correctly.
- [ ] `StatCards` — total income, expenses, savings, net worth. Currency formatting.
- [ ] `SpendingByCategoryChart` — pie/bar chart of spending by category. Empty categories hidden.
- [ ] `DailySpendingChart` — line chart of daily spending. Empty days gap or zero?
- [ ] `SpendingTrendIndicator` — up/down trend arrows. Calculation correct for edge periods (single day, partial month).
- [ ] `BudgetComparisonSection` — budget vs actual per category. Categories with no budget excluded?
- [ ] `SavingsOverview` — uses personal expenses only (fixed). Income vs personal expenses.
- [ ] `MonthlyRecapSection` — monthly summary text. Generated from analytics engine.
- [ ] `SpendingAlertsSection` — alerts for unusual spending. Data-driven.
- [ ] `TopExpensesList` — top N expenses by amount. N configurable?
- [ ] `analyticsStore` — loads data. Cache invalidation on filter change.
- [ ] Backend analytics — computed server-side in `shared/src/engine/analyticsCalculator.ts` or frontend-only? If frontend, ensure all necessary data is loaded.

---

## Phase 8: Recaps

**Files:** `pages/recaps/RecapsPage.tsx` · `recaps/MonthlyRecapHeader.tsx` · `recaps/RecapSectionList.tsx`

**Checkpoints:**
- [ ] `RecapsPage` — monthly recap of income, expenses, savings, top categories. Scroll through months.
- [ ] `MonthlyRecapHeader` — month/year selector, navigation arrows.
- [ ] `RecapSectionList` — multiple recap cards for different metrics.
- [ ] Data source: personal blob or separate endpoint?
- [ ] Empty month: shows "No data for this month" or zeros?

---

## Phase 9: Recurring Bills

**Files:** `pages/recurring/RecurringBillsPage.tsx` · `recurring/RecurringBillCard.tsx` · `recurring/RecurringBillForm.tsx` · `stores/recurringStore.ts`

**Checkpoints:**
- [ ] `RecurringBillsPage` — lists recurring bills. Active/inactive filter? Next due date calculation.
- [ ] `RecurringBillCard` — bill name, amount, frequency (weekly/monthly/yearly), next due date, status.
- [ ] `RecurringBillForm` — create/edit: name, amount, category, frequency, start date, end date (optional). Validation.
- [ ] `recurringStore` — CRUD operations. If sync-based, follows same pattern as other sub-stores.
- [ ] Backend reminders: `services/reminderService.ts` checks recurring bills and sends notifications. Poll interval set to 300s.

---

## Phase 10: Notifications

### 10.1 Notifications Page
**Files:** `pages/notifications/NotificationsPage.tsx` · `stores/notificationStore.ts` · `routes/notifications.ts` · `services/notificationService.ts`

**Checkpoints:**
- [ ] `NotificationsPage` — list of notifications. Read/unread filter. Mark as read, mark all read.
- [ ] `notificationStore` — pagination, real-time updates via WebSocket.
- [ ] Backend `routes/notifications.ts` — GET list, PUT /read/:id, PUT /read-all. Pagination params.
- [ ] Backend `notificationService.ts` — creates notifications for various events (expense added, settlement, group invite, etc.).

### 10.2 Push Notifications
**Files:** `lib/pushNotifications.ts` · `services/webPush.ts` · `services/reminderService.ts`

**Checkpoints:**
- [ ] `pushNotifications.ts` — subscribe/unsubscribe to push. VAPID keys. Service worker registration.
- [ ] `sw.js` — push event handler. Notification click handler navigates to correct page.
- [ ] `webPush.ts` — sends push notifications via Web Push API. Error handling for expired subscriptions.
- [ ] `reminderService.ts` — BullMQ worker (or setInterval fallback) that checks for due bills and sends reminders.

---

## Phase 11: Settings

### 11.1 Settings Layout
**Files:** `pages/settings/SettingsLayout.tsx`

**Checkpoints:**
- [ ] Settings sidebar with links to all sub-pages. Active link highlighted. Responsive (mobile hamburger?).

### 11.2 Profile Settings
**Files:** `pages/settings/ProfileSettings.tsx` · `routes/auth.ts` (PUT /profile) · `services/authService.ts` (updateProfile)

**Checkpoints:**
- [ ] Editable fields: displayName, defaultCurrency, timezone. Save button. Success/error feedback.
- [ ] Currency dropdown: populated from `shared/src/utils/currency.ts` list.
- [ ] Backend `updateProfile` — dynamic SET clause, only updated fields. Validates input length.

### 11.3 Security Settings
**Files:** `pages/settings/SecuritySettings.tsx` · `routes/auth.ts` (POST /2fa/setup, /2fa/enable, /2fa/disable, GET /2fa/status) · `services/twoFactorService.ts`

**Checkpoints:**
- [ ] 2FA status fetched on mount via `GET /2fa/status` (fixed in previous round).
- [ ] Enable 2FA flow: setup → show QR code → user scans → verify code → enable.
- [ ] Disable 2FA flow: enter current TOTP code → disable. Also require password re-auth?
- [ ] Change password form: old password, new password, confirm. Password strength meter. Validation same as register.
- [ ] `authStore.changePassword` — generates new salt, re-encrypts PEK with new passphrase. Backend updates `auth_key_hash`, `personal_salt`, `encrypted_pek`. Does NOT update `server_encrypted_pek` (correct — raw PEK unchanged).
- [ ] Backend `changePassword` — revokes ALL refresh tokens. Good.

### 11.4 Appearance Settings
**Files:** `pages/settings/AppearanceSettings.tsx`

**Checkpoints:**
- [ ] Dark mode toggle. Persists to localStorage. Applies class to `<html>`. Inline script in `index.html` prevents flash.

### 11.5 Groups Settings
**Files:** `pages/settings/GroupsSettings.tsx`

**Checkpoints:**
- [ ] Lists groups the user belongs to. Leave group action. Redirect to group detail?
- [ ] Probably a simpler version of the GroupsPage.

### 11.6 Notification Preferences
**Files:** `pages/settings/NotificationPreferencesSettings.tsx`

**Checkpoints:**
- [ ] Toggles for different notification types (group activity, bill reminders, etc.). Persisted to server?

### 11.7 Data Export
**Files:** `pages/settings/DataExportSettings.tsx` · `lib/dataExport.ts`

**Checkpoints:**
- [ ] Export buttons: CSV, JSON, PDF. Downloads file with correct MIME type.
- [ ] `dataExport.ts` — transforms personal blob into exportable formats. Date formatting, currency formatting.
- [ ] `DataExportSettings` error handling: safe `.message` access for non-Error throws (fixed).

### 11.8 About Settings
**Files:** `pages/settings/AboutSettings.tsx`

**Checkpoints:**
- [ ] App version, build number, links (privacy, terms, GitHub). Static content.

---

## Phase 12: Import

**Files:** `pages/import/ImportPage.tsx`

**Checkpoints:**
- [ ] File upload (CSV) for importing expenses. Column mapping UI. Preview before import.
- [ ] Duplicate detection (by date, amount, description)? Or always inserts?
- [ ] Progress indicator for large files. Cancel import.
- [ ] Error report: which rows failed and why.

---

## Phase 13: Admin

### 13.1 Admin Layout
**Files:** `pages/AdminPage.tsx` · `components/admin/AdminLayout.tsx` · `stores/adminStore.ts` · `middleware/requireAdmin.ts`

**Checkpoints:**
- [ ] Admin layout with sidebar navigation. Sub-routes render via `<Outlet>`.
- [ ] `requireAdmin` middleware checks user role. If not admin, returns 403.
- [ ] `adminStore` — holds admin data (monitoring, security, etc). Separate stores for users/config/alerts.

### 13.2 Admin Dashboard
**Files:** `AdminDashboardPage.tsx` · `services/monitoringService.ts` (getAggregateStats) · `routes/admin.ts` (GET /admin/stats)

**Checkpoints:**
- [ ] Dashboard shows: total users, active users, registrations today, total groups. Stats from `getAggregateStats`.
- [ ] Registration chart, active user timeline.
- [ ] All admin routes have `adminAudit` preHandler — logs every action to audit log.

### 13.3 User Management
**Files:** `AdminUsersPage.tsx` · `UserTable.tsx` · `UserDetailPanel.tsx` · `UserConfirmDialog.tsx` · `StatusBadge.tsx` · `services/adminUserService.ts` · `stores/adminUserStore.ts`

**Checkpoints:**
- [ ] `AdminUsersPage` — user list with pagination, search, status filter. useEffect deps complete (fixed).
- [ ] `UserTable` — columns: email (anonymized), display name, role, status, created date. Sortable?
- [ ] `UserDetailPanel` — detailed user view: activity log, sessions, linked accounts. Actions: force logout, suspend, ban, restore, delete.
- [ ] Force logout → revokes all refresh tokens.
- [ ] Suspend → sets `locked_until` timestamp. Duration configurable.
- [ ] Ban → marks user as banned. Data deleted after 30 days.
- [ ] Restore → removes suspension/ban.
- [ ] Delete → permanent deletion. Self-deletion prevented (`adminId === userId` check). Last owner deletion prevented.
- [ ] `adminUserStore` — all operations re-throw errors (fixed). Error messages displayed in toast.
- [ ] Backend `getAnonymizedUsers` — email anonymized (e.g., `j***@example.com`). Pagination works.
- [ ] Backend `getUserDetail` — returns full user data (not anonymized) — only for specific user lookup.
- [ ] Backend `deleteUser` — deletes user and all associated data in a transaction. Last-owner check fixed.

### 13.4 Monitoring
**Files:** `AdminMonitoringPage.tsx` · `services/monitoringService.ts`

**Checkpoints:**
- [ ] Endpoint metrics: request count, avg duration, error rate per endpoint. Time range selector.
- [ ] Error rate overview: chart of errors over time.
- [ ] Slow queries: list of slow database queries.
- [ ] Database health: active connections, total connections, pool status.
- [ ] Redis stats: hit rate, memory usage, connected clients.
- [ ] `getDatabaseStatsHistory` / `getHealthHistory` — fixed duplicate (previous round).

### 13.5 Admin Jobs
**Files:** `AdminJobsPage.tsx` · `routes/admin.ts` (GET /admin/jobs/queues, etc.)

**Checkpoints:**
- [ ] Job queue page — currently returns `{ queues: [] }` (BullMQ not configured). Placeholder UI handles this gracefully.
- [ ] If BullMQ becomes available, triggers queue listing, job detail, retry failed jobs.

### 13.6 Debug
**Files:** `AdminDebugPage.tsx` · `services/adminLogService.ts` · `services/adminSecurityService.ts`

**Checkpoints:**
- [ ] System logs: level filter, module filter, search, date range, pagination.
- [ ] Error events: list of captured errors, resolve action.
- [ ] Request trace: trace specific request ID through the system.
- [ ] Cache inspector: view Redis keys by pattern, clear cache.

### 13.7 Security
**Files:** `AdminSecurityPage.tsx` · `services/adminSecurityService.ts`

**Checkpoints:**
- [ ] Failed login stats: recent failed attempts, top failing users/ips.
- [ ] Suspicious IPs: IPs exceeding threshold of failed attempts.
- [ ] Rate limit hits: rate limiter activity.
- [ ] Security score: composite score based on various security metrics.
- [ ] Block IP: add IP to blocklist. Validates IP format.
- [ ] IP blocklist checked in `ipBlocker.ts` middleware.

### 13.8 Alerts (Admin)
**Files:** `AdminAlertsPage.tsx` · `services/adminAlertService.ts` · `services/alertService.ts`

**Checkpoints:**
- [ ] Alert rules list: name, metric, condition, threshold, enabled status. Create/edit/delete rules.
- [ ] `adminAlertService` — dynamic SET for UPDATE (fixed), correct snake_case column names (fixed).
- [ ] Alert history: triggered alerts, acknowledged/unacknowledged. Acknowledge action.
- [ ] Test alert rule: triggers evaluation for a single rule.
- [ ] Evaluate all rules: triggers `evaluateAlertRules()`.

### 13.9 Config
**Files:** `AdminConfigPage.tsx` · `services/adminConfigService.ts`

**Checkpoints:**
- [ ] View/edit system config keys. Each key has type, value, description. Update with new value.
- [ ] Config history: view changes over time.
- [ ] Maintenance mode toggle: enabled/disabled with optional message.

### 13.10 Audit Log
**Files:** `AdminAuditLogPage.tsx` · `services/adminAuditService.ts`

**Checkpoints:**
- [ ] Audit log: filter by action type, pagination. Timestamp, admin, action, details.
- [ ] `adminAudit` middleware writes to audit log on every admin action. `writeAdminAuditLog` called explicitly for non-middleware actions.

### 13.11 Health
**Files:** `AdminHealthPage.tsx` · `routes/admin.ts` (GET /admin/health, /admin/health/history) · `services/healthService.ts`

**Checkpoints:**
- [ ] System health: database, redis, memory checks. Status: healthy/degraded/critical.
- [ ] Health history: timeline of health status (stored in DB).

---

## Phase 14: Infrastructure & Shared

### 14.1 Tab Sync
**Files:** `lib/tabSync.ts`

**Checkpoints:**
- [ ] Broadcast login/logout to other tabs via `BroadcastChannel`. Channel name collision?
- [ ] On receiving login, re-initialize store. On receiving logout, reset stores.
- [ ] Fallback if BroadcastChannel not available?

### 14.2 Reset Stores
**Files:** `lib/resetStores.ts`

**Checkpoints:**
- [ ] Resets ALL stores to initial state. Must list every store. If a store is missing, state leaks on logout.

### 14.3 Error Boundary
**Files:** `components/ErrorBoundary.tsx`

**Checkpoints:**
- [ ] Catches React render errors. Shows fallback UI. "Reload" button. Logs error to `errorReporter`.

### 14.4 Connection Status
**Files:** `components/ConnectionStatus.tsx`

**Checkpoints:**
- [ ] Shows online/offline indicator. WebSocket connection status. Reconnection status.

### 14.5 Toast
**Files:** `components/ToastContainer.tsx` · `stores/toastStore.ts` · `hooks/useGlobalErrorToast.ts`

**Checkpoints:**
- [ ] Toast container renders toasts. Auto-dismiss after timeout. Stack multiple toasts.
- [ ] `useGlobalErrorToast` watches all stores for errors (fixed to watch 14 stores, deduplicated).

### 14.6 Sidebar / Navigation
**Files:** `components/Sidebar.tsx` · `components/layout/AppLayout.tsx`

**Checkpoints:**
- [ ] Sidebar links: Dashboard, Expenses, Budgets, Groups, Analytics, Recaps, Recurring, Import, Notifications, Settings, Admin (if admin).
- [ ] Active link highlighting. Collapsible on mobile. User info (avatar, name, logout).

### 14.7 API Client
**Files:** `lib/apiClient.ts`

**Checkpoints:**
- [ ] `apiClient` — adds Bearer token, handles 401 with retry (refresh then retry). If refresh fails, calls `logout()`.
- [ ] `apiClient` — `logout()` awaited (fixed in previous round).
- [ ] What happens if both original request and retry fail? Throws `'Session expired'`.

### 14.8 WebSocket
**Files:** `hooks/useWebSocket.ts` · `plugins/websocket.ts` (backend) · `plugins/admin-websocket.ts` (backend)

**Checkpoints:**
- [ ] Frontend WebSocket connection to backend. Reconnect on disconnect. Handles room subscriptions (personal, groups).
- [ ] Backend `websocket.ts` — Socket.IO server. Rooms for each user (for personal data) and each group. Events emitted on data changes.
- [ ] Admin WebSocket — separate namespace for admin real-time updates (metrics, alerts).
- [ ] Rate limiting on WebSocket events (20 events/10s).
- [ ] Cleanup on disconnect: leave rooms, clean up state.

### 14.9 Crypto
**Files:** `lib/crypto.ts` (frontend) · `services/cryptoUtils.ts` (backend)

**Checkpoints:**
- [ ] Frontend crypto: `deriveKeyBytes` domain separation uses context string prepended to salt. `deriveWrappingKey` has double-context (`coldfi:pek-wrap:coldfi:pek-wrapping` + salt). Verify no overlap with other derivation contexts.
- [ ] `computeAuthKeyHash` uses `SHA-256(email)` as salt → PBKDF2-600k-SHA512 → hex output. Backend bcrypts this. Chain: PBKDF2 → bcrypt. Double hashing is intentional (PBKDF2 for client-side work factor, bcrypt for server-side storage).
- [ ] `encryptPEK` / `decryptPEK` — AES-256-GCM with wrapping key derived from passphrase. IV is random 12 bytes. Auth tag included in ciphertext.
- [ ] Backend `encryptServerKey` / `decryptServerKey` — AES-256-GCM with server encryption key. Format: `iv:tag:ciphertext` (hex). No authentication (server key is static).
- [ ] `generateRecoveryCode` — 12 random bytes → hex → split into groups of 4 with dashes (e.g., `a1b2-c3d4-e5f6-g7h8`). 24 chars + 5 dashes = 29 chars total.
- [ ] `hashRecoveryCode` / `hashToken` — SHA-512 hex. Deterministic.

### 14.10 Backend Middleware
**Files:** `middleware/*`

**Checkpoints:**
- [ ] Rate limiters: login (20/15min), register (20/60min), password change (3/15min), 2FA (5/10min), refresh (30/15min), recover (5/15min), recover-complete (5/15min), profile (10/60s), 2FA-setup (5/15min), backfill-pek (10/3600s). All use Redis. Fallback allows request on Redis failure.
- [ ] `adminRateLimit` — Redis-based, separate from other rate limiters.
- [ ] `requireAdmin` — checks `request.user.role === 'owner'` (not 'admin'). If role check is too strict or too loose based on role values.
- [ ] `requireGroupAccess` — verifies user is member of group. Uses DB query per request.
- [ ] `requireGroupAdmin` — verifies user is group admin. Queries group members table.
- [ ] `adminAudit` — logs all admin requests to audit log.
- [ ] `requestMetrics` — tracks request counts, durations, error rates for monitoring.
- [ ] `ipBlocker` — checks IP against blocklist on every request.

### 14.11 Backend Jobs
**Files:** `jobs/index.ts` · `jobs/reminderWorker.ts`

**Checkpoints:**
- [ ] BullMQ setup. Queue definitions. Worker processing. Error handling.
- [ ] Reminder worker: checks due recurring bills, sends notifications and push alerts.
- [ ] Graceful shutdown on app close.

### 14.12 Redis
**Files:** `services/redis.ts`

**Checkpoints:**
- [ ] Redis client initialization. Connection error handling. Reconnection logic. Fallback if Redis unavailable (graceful degradation).
- [ ] `getRedis()` throws if not initialized. Callers must handle.

### 14.13 Error Capture
**Files:** `lib/errorReporter.ts` (frontend) · `services/errorCapture.ts` (backend)

**Checkpoints:**
- [ ] Frontend: captures unhandled errors and unhandled promise rejections. Sends to backend endpoint.
- [ ] Backend: receives errors, stores in DB for admin debug page. Notification to admins for critical errors.

### 14.14 Database / Migrations
**Files:** `db/pool.ts` · `db/migrate.ts` · `db/seed.ts` · `db/migrations/*.sql`

**Checkpoints:**
- [ ] Connection pool configured with max connections, idle timeout.
- [ ] Migrations run in order. Each migration is idempotent.
- [ ] Seed script populates initial data (admin emails, default config).
- [ ] Cleanup script for expired sessions, old data.

### 14.15 Shared Types & Engine
**Files:** `packages/shared/src/types/*.ts` · `packages/shared/src/engine/*.ts`

**Checkpoints:**
- [ ] Type definitions aligned between frontend, backend, and shared (fixed in previous round).
- [ ] Engine: analytics, balance calculation, settlement, split calculation, budget tracking, log management, spending detection, blob migration. All correctly imported by consuming packages.
