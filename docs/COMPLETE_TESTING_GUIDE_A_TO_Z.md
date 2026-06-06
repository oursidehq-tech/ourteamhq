# GreenSports Complete Testing Guide (A to Z)

Last updated: 2026-03-14
Owner: QA + Product + Engineering
Scope: Mobile app (Expo), Firebase backend, club multi-tenant behavior, role permissions, and free-mode constraints.

## 1. Purpose

This document is the complete end-to-end testing guide for GreenSports.
Use it for:

- pre-release validation
- regression checks after feature updates
- final sign-off before production rollout

Success means:

- no blocking runtime or data issues
- no cross-club data leakage
- core user journeys work for all supported roles
- backend rules and indexes support all active queries

## 2. Test Strategy

Test in this order:

1. Environment and configuration baseline.
2. Authentication and onboarding paths.
3. Club membership and multi-club isolation.
4. Feature modules (feed, teams, calendar, tasks, rosters, trades, shop, notifications).
5. Security and permission regression.
6. Non-functional checks (stability, performance, recoverability).
7. Final two-club sign-off run.

## 3. Test Environments

Run all tests in at least these environments:

- Android real device through Expo Go.
- Optional web sanity via Expo web.

Recommended matrix:

- Device A: Owner/Admin user
- Device B: Player/Member user
- Device C (optional): Public/non-member perspective

## 4. Prerequisites and Setup

## 4.1 Local Setup

- Install dependencies with npm install.
- Start app with cache clear at least once before full cycle.
- Confirm .env values exist for all EXPO*PUBLIC_FIREBASE*\* variables.

## 4.2 Firebase Setup

- Email/Password provider enabled in Firebase Authentication.
- Firestore rules deployed.
- Firestore indexes deployed and enabled.
- Storage rules deployed.

## 4.3 Seed Data Requirements

Create two clubs and at least these records:

- Club A and Club B
- at least 1 owner/admin in each club
- at least 2 member users in Club A
- at least 1 member user in Club B
- 2 teams in Club A, 1 team in Club B
- 3 events in Club A (one recurring), 2 in Club B
- 3 tasks in Club A (one recurring), 1 in Club B
- 1 roster template in Club A
- 2 trades/suppliers in Club A
- 2 products in Club A shop

## 5. Roles and Permission Matrix

Validate each flow with these personas:

- Owner
- Admin
- Coach
- Player/Member
- Parent (if represented in role model)
- Public/Unauthenticated

Expected high-level access:

- Owner/Admin: full management actions inside their club.
- Coach: limited management based on app rules.
- Player/Member: member views and own interactions only.
- Public: public pages only, no private club data.

## 6. Execution Workflow

For every test case below:

1. Capture preconditions.
2. Execute exact steps.
3. Verify expected result in UI and backend.
4. Record result as Pass/Fail/Blocked.
5. Attach screenshot or video for failures.
6. Log device, app build time, and tester identity.

## 6.1 Very Small Quick Check (Page by Page)

Use this when you want fast validation like Signup-page style checks for all screens.

Mark each as Pass/Fail.

- Splash: app opens, no red screen, routes to auth or home correctly.
- Login: valid login works, invalid login shows message, password eye toggle works.
- Signup: new account works, duplicate email blocked, password eye toggle works.
- Join Club: invite code works, invalid code shows safe error, joins correct club.
- Club Onboarding: owner can create club, club is set active, next screen loads.
- Home: current club content loads, create post works, refresh does not crash.
- Teams: list is club-scoped, My Teams filter is correct, unauthorized RSVP is blocked.
- Calendar: events load, recurring items appear on future dates, no crash on load.
- Tasks: create task works, assignment visible to assignee, due date visible.
- Rostering: template list opens, signup/cancel works, no JSX/render issues.
- Trades: call/email actions work, template email opens mail app, service log saves.
- Club Info: info edit saves, logo/banner fallback does not block flow, public fields display correctly.
- Shop: products load, cart quantity update works, checkout saves orderRef.
- Cart: order place works, success message appears, confirmation notification created.
- Notifications: list opens, body/message payload renders, mark-read persists.
- Public Club Page: about/posts/events/shop preview visible, follow/unfollow works, private data hidden.
- More Screen: navigation links open expected screens, logout works, no broken route.

Quick backend checks after UI pass:

- Firestore: no permission-denied for valid role actions.
- Indexes: no repeated failed-precondition crash loops.
- Auth: no configuration-not-found during signup/login.

## 7. Detailed Test Cases

## 7.1 App Launch and Baseline

### TC-BASE-001 Launch with clean cache

- Preconditions: dependencies installed.
- Steps:

1. Start app with cache clear.
2. Open app on device.

- Expected:

1. No red screen.
2. No transform syntax errors.
3. No unresolved import errors.

### TC-BASE-002 Firebase initialization

- Steps:

1. Navigate to login and signup screens.
2. Attempt normal auth calls.

- Expected:

1. No configuration-not-found error.
2. Firebase services respond normally.

### TC-BASE-003 Index/runtime warnings

- Steps:

1. Open home, calendar, notifications.
2. Observe terminal logs for snapshot listeners.

- Expected:

1. No uncaught failed-precondition index crash loops.
2. If fallback warning appears, UI still works and data loads.

## 7.2 Authentication

### TC-AUTH-001 Signup success

- Steps:

1. Sign up with new valid email/password.
2. Complete post-signup flow.

- Expected:

1. User account created.
2. User profile doc exists in users collection.
3. accountType and membership fields populated.

### TC-AUTH-002 Signup duplicate email

- Steps:

1. Sign up with existing email.

- Expected:

1. Safe user-facing error shown.
2. App does not crash.

### TC-AUTH-003 Login success/failure

- Steps:

1. Login with valid credentials.
2. Login with invalid credentials.

- Expected:

1. Success path navigates correctly.
2. Failure path shows clear error text.

### TC-AUTH-004 Password visibility toggle

- Steps:

1. Tap eye icon on signup/login password fields.

- Expected:

1. Password visibility toggles reliably.

### TC-AUTH-005 Logout

- Steps:

1. Logout from authenticated session.

- Expected:

1. Return to login route.
2. Protected screens inaccessible until login.

## 7.3 Onboarding and Club Membership

### TC-CLUB-001 Owner onboarding

- Steps:

1. Sign in as owner without club.
2. Create a club.

- Expected:

1. Club created and linked to owner.
2. Active club set automatically.

### TC-CLUB-002 Member invite join

- Steps:

1. Sign in as member without club.
2. Join club using invite code.

- Expected:

1. Membership created.
2. Club-scoped data appears.

### TC-CLUB-003 Multi-club switching persistence

- Steps:

1. Join user to Club A and Club B.
2. Switch clubs.
3. Restart app.

- Expected:

1. Previously selected active club restores.
2. Invalid stored club id auto-recovers safely.

### TC-CLUB-004 Isolation guard

- Steps:

1. Create content in Club A.
2. Switch to Club B.

- Expected:

1. Club A private data never appears in Club B context.

## 7.4 Feed and Public Club Page

### TC-FEED-001 Post creation and visibility

- Steps:

1. Create post in each visibility mode.
2. Check by role and membership.

- Expected:

1. Public/network/club/team visibility enforced correctly.

### TC-FEED-002 Network follow/unfollow

- Steps:

1. Follow another club.
2. Verify network feed content.
3. Unfollow and verify removal.

- Expected:

1. Only allowed public/network posts appear.

### TC-PUBLIC-001 Public club page sections

- Steps:

1. Open public club page for target club.

- Expected:

1. About section visible.
2. Public posts/events/shop preview load.
3. Private fields not exposed.

## 7.5 Teams

### TC-TEAM-001 Team list scoping

- Steps:

1. Open teams in Club A and Club B.

- Expected:

1. Only active-club teams shown.

### TC-TEAM-002 My Teams filtering

- Steps:

1. Login as non-admin member assigned to one team.

- Expected:

1. My Teams shows assigned teams only.

### TC-TEAM-003 Team RSVP restrictions

- Steps:

1. Attempt RSVP for non-member team as non-admin.

- Expected:

1. Action blocked with safe message.

## 7.6 Events and Calendar

### TC-EVENT-001 Event create/edit/delete

- Steps:

1. Create event.
2. Update event details.
3. Delete event.

- Expected:

1. Calendar and event listings reflect changes in real time.

### TC-EVENT-002 RSVP Yes/No/Maybe

- Steps:

1. Submit each RSVP state.

- Expected:

1. Stored correctly and shown correctly.

### TC-CAL-001 Recurring expansion

- Steps:

1. Create recurring event/task/roster.
2. Move calendar through future dates.

- Expected:

1. Occurrences render correctly on expected dates.

### TC-CAL-002 Index fallback behavior

- Steps:

1. Observe calendar loading where composite index is absent.

- Expected:

1. Fallback query keeps UI functional.
2. No app crash due to listener errors.

## 7.7 Tasks

### TC-TASK-001 Task create and assign

- Steps:

1. Create task with assignees and due date.

- Expected:

1. Assignees can view task.
2. Due date appears in calendar integrations.

### TC-TASK-002 Recurring task rollover

- Steps:

1. Create recurring task with and without templateId.
2. Trigger rollover conditions.

- Expected:

1. Next tasks generated correctly.

### TC-TASK-003 Permission checks

- Steps:

1. Test create/edit/delete as each role.

- Expected:

1. Unauthorized role actions blocked.

## 7.8 Rostering

### TC-ROST-001 Template management

- Steps:

1. Create and list roster templates.
2. Instantiate roster from template.

- Expected:

1. Generated roster slots match template.

### TC-ROST-002 Volunteer signup and cancellation

- Steps:

1. Signup for open slot.
2. Cancel signup.

- Expected:

1. Slot allocation updates correctly each time.

### TC-ROST-003 Reminder notifications

- Steps:

1. Trigger roster reminders.

- Expected:

1. In-app notifications are created with correct club scope.

### TC-ROST-004 CSV export

- Steps:

1. Export roster CSV.

- Expected:

1. Row count and columns match expected structure.

## 7.9 Trades and Suppliers

### TC-TRD-001 Supplier CRUD scope

- Steps:

1. Add supplier in Club A.
2. Verify not visible in Club B.

- Expected:

1. Strict club scoping.

### TC-TRD-002 Contact actions

- Steps:

1. Use call/email actions with and without values.

- Expected:

1. Valid values open phone/mail handlers.
2. Missing values show safe alerts.

### TC-TRD-003 Email templates

- Steps:

1. Add template.
2. Trigger Send Template Email.

- Expected:

1. Mail app opens with selected template subject/body prefilled.

### TC-TRD-004 Service log entries

- Steps:

1. Add service log with date + note + optional cost.

- Expected:

1. Entry appears in latest logs.
2. Cost formatting is preserved as entered.

## 7.10 Club Info

### TC-INFO-001 Profile updates

- Steps:

1. Update about text, contacts, key people.

- Expected:

1. Changes persist and reload correctly.

### TC-INFO-002 Logo/banner upload in free mode

- Steps:

1. Attempt upload under free-mode constraint.

- Expected:

1. If storage disabled/fails, app continues without blocking onboarding.
2. User receives clear warning or fallback behavior.

## 7.11 Shop, Cart, Orders

### TC-SHOP-001 Product list and cart

- Steps:

1. Browse products.
2. Add/remove items.
3. Change quantity.

- Expected:

1. Cart math and UI remain consistent.

### TC-SHOP-002 Checkout metadata

- Steps:

1. Complete checkout flow.

- Expected:

1. Order saved with orderRef, paymentMethod, paymentStatus.
2. Success dialog includes order reference.

### TC-SHOP-003 Confirmation notification

- Steps:

1. Place order.
2. Open notifications.

- Expected:

1. Order confirmation notification exists for purchaser.

### TC-SHOP-004 Production payment readiness

- Steps:

1. Validate Stripe webhook path in integration environment.

- Expected:

1. Paid state transition works in backend.
2. If not integrated yet, record as known gap.

## 7.12 Notifications

### TC-NOTIF-001 In-app list load

- Steps:

1. Open notifications with existing records.

- Expected:

1. List renders without crashes.
2. Empty state visible when no notifications.

### TC-NOTIF-002 Payload compatibility

- Steps:

1. Validate notifications with body and message keys.

- Expected:

1. Both legacy and current payload shapes display properly.

### TC-NOTIF-003 Scope and read status

- Steps:

1. Mark notifications read.
2. Switch clubs.

- Expected:

1. Read state persists.
2. Notifications remain club-scoped.

## 8. Security and Data Isolation Tests

## 8.1 Firestore Rules Validation

Run these checks:

- unauthenticated user cannot read private collections
- authenticated member cannot write to another club path
- role-restricted writes fail for unauthorized roles

## 8.2 Multi-Club Leakage Tests

- same user in two clubs must see fully isolated club data in each context
- user in Club A cannot discover private data from Club B via direct navigation

## 8.3 Public Surface Audit

- public screens expose only explicitly public fields
- no private email/phone/member metadata leaked in public payloads

## 9. Non-Functional Testing

## 9.1 Stability

- Run continuous navigation loop for 20 to 30 minutes.
- Confirm no recurring red screens or fatal crashes.

## 9.2 Performance

- Measure screen open latency on Home, Teams, Calendar, Shop, Notifications.
- Record slow query hotspots and associated index coverage.

## 9.3 Recoverability

- Simulate temporary network loss and restore.
- Confirm subscriptions recover and UI self-heals without restart.

## 10. Logging and Defect Reporting

For each defect, log:

- unique defect id
- environment and device
- user role and club context
- exact reproduction steps
- expected result
- actual result
- screenshot/video
- terminal log snippet
- severity and priority

Severity guide:

- Critical: app crash, auth broken, data leakage
- High: key flow blocked without workaround
- Medium: partial function issue with workaround
- Low: cosmetic or non-blocking inconsistency

## 11. Exit Criteria for Release

All must be true:

- 0 open Critical defects
- 0 open High defects in core flows
- all authentication flows pass
- no club data leakage across two-club regression
- no unresolved runtime syntax/import errors
- all required Firebase rules/indexes deployed
- shop order creation and notification confirmation pass

## 12. Final A to Z Sign-Off Script

Run this in one continuous sequence:

1. Clean start app and login as Owner in Club A.
2. Create post, event, recurring task, roster, supplier update, and product action.
3. Switch to Club B and verify Club A content isolation.
4. Login as Member in Club A, verify limited permissions and team RSVP restrictions.
5. Place test order, capture orderRef, verify notification.
6. Open public club page and verify only public data appears.
7. Follow another club, verify network feed behavior.
8. Logout, login again, verify active club persistence and route correctness.
9. Run a final notifications check for task/roster/order events.
10. Record final test report with pass rate and known gaps.

## 13. Test Report Template

Use this simple format for final report:

- Build date/time:
- Testers:
- Devices:
- Total test cases executed:
- Passed:
- Failed:
- Blocked:
- Critical defects:
- High defects:
- Known accepted gaps:
- Release recommendation: Go / No-Go

## 14. Known Current Risk Areas to Watch

- stale Metro cache can show old syntax errors already fixed in source
- Firestore composite index creation delays may temporarily trigger fallback warnings
- free-mode storage behavior can vary by rules and bucket configuration
- production Stripe webhook path not fully finalized

---

If this guide is used as primary sign-off, link the final execution report beside this file in docs for future regression cycles.
