# Final Integration Test - Manual Test Plan

## Prerequisites
- Backend running and accessible
- Web app running (Vite dev server)
- Two browser tabs or windows open
- Two test accounts available

---

## Scenario 1: Register
**Steps:**
1. Open web app in browser
2. Click "Create Account"
3. Enter email and password
4. Confirm password
5. Click "Register"
**Expected:** Registration succeeds, redirected to dashboard

---

## Scenario 2: Login
**Steps:**
1. Open new browser tab
2. Navigate to login page
3. Enter email and password
4. Click "Login"
**Expected:** Dashboard loads, user name displayed

---

## Scenario 3: Add Personal Expense
**Steps:**
1. Navigate to "Expenses" page
2. Click "Add Expense"
3. Enter amount, category, note, date
4. Click "Save"
**Expected:** Expense appears in list, totals update

---

## Scenario 4: Check Budget Status
**Steps:**
1. Navigate to "Budgets" page
2. View current month summary
**Expected:** Budget totals correct, charts render

---

## Scenario 5: Create Group
**Steps:**
1. Navigate to "Groups" page
2. Click "Create Group"
3. Enter name and currency
4. Click "Create"
**Expected:** Group created, invite code shown

---

## Scenario 6: Second User Joins Group
**Steps:**
1. Register/login as second user
2. Navigate to "Groups" page
3. Click "Join Group"
4. Enter invite code
5. Click "Join"
**Expected:** Both users see each other in member list

---

## Scenario 7: Add Group Expense
**Steps:**
1. Open group as User A
2. Click "Add Expense"
3. Enter amount, description, split
4. Click "Save"
**Expected:** Expense shows, balances update

---

## Scenario 8: Generate Settlements
**Steps:**
1. Open group
2. Navigate to "Settlements" tab
**Expected:** Settlement suggestions shown

---

## Scenario 9: Mark Paid + Confirm
**Steps:**
1. As User B, click "Mark as Paid"
2. As User A, click "Confirm Payment"
**Expected:** Settlement marked complete, balance at $0

---

## Scenario 10: Admin Dashboard
**Steps:**
1. Login as admin user (role: owner)
2. Navigate to "/admin"
3. View Users, Groups, Activity sections
**Expected:** All data visible, charts accurate

---

## Sign-off
| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Register | | |
| 2. Login | | |
| 3. Add Expense | | |
| 4. Budget Status | | |
| 5. Create Group | | |
| 6. Join Group | | |
| 7. Group Expense | | |
| 8. Settlements | | |
| 9. Payment Confirm | | |
| 10. Admin Dashboard | | |

**Tester:** ________________
**Date:** ________________
**Result:** PASS / FAIL
