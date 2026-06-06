# OurSideHQ Feature Test Plan

## Scope
This document defines practical test cases for the current club operations implementation:
- Settings and Help & Support
- Team selection and Team Feed behavior
- Club Store admin banner editing
- Roster assignment by group or user
- Task assignment by group or user
- Calendar list mode
- Group-based volunteer visibility model from the wireframe brief

## Test Data Prerequisites
Use at least these users in one test club:
- Club Owner (or Admin)
- Coach or Manager
- Committee member
- Executive member
- Parent/Player member
- Optional Super Admin account

Create these groups:
- Team group: U14 Gold
- Team group: U16 Tigers
- Committee group
- Executive group
- Optional open volunteers group

Assign memberships:
- Parent/Player user assigned only to U14 Gold
- Committee user assigned only to Committee
- Executive user assigned only to Executive

## 1. Settings Screen

### 1.1 Open settings from More
Steps:
1. Sign in as any club member.
2. Open More tab.
3. Tap Settings.
Expected:
- Settings screen opens (no "coming soon" alert).

### 1.2 Dark mode toggle persistence
Steps:
1. Toggle Dark Mode on.
2. Back out to More, then re-open Settings.
3. Kill app and relaunch.
Expected:
- Dark mode preference remains on.
- Root/status style reflects dark setting.

### 1.3 Reduce motion behavior
Steps:
1. Toggle Reduce Motion on.
2. Move between bottom tabs.
3. Toggle Reduce Motion off.
4. Move between tabs again.
Expected:
- With on: reduced tab animation motion.
- With off: normal spring motion returns.

### 1.4 Compact layout behavior
Steps:
1. Toggle Compact Layout on.
2. Observe bottom tab bar size/spacing.
3. Toggle off.
Expected:
- Compact layout visibly tightens the tab bar.
- Toggling off restores normal spacing.

### 1.5 Notification permissions action
Steps:
1. Tap Notification Permissions in Settings.
Expected:
- System app settings open for app notification configuration.

## 2. Help & Support Screen

### 2.1 Open from More
Steps:
1. Open More tab.
2. Tap Help & Support.
Expected:
- Help & Support screen opens.

### 2.2 Support actions
Steps:
1. Tap Email Support.
2. Tap WhatsApp Support.
3. Tap Help Center.
4. Tap Report A Bug.
Expected:
- Each action opens external app/link or shows clear fallback alert if unavailable.

## 3. Team Selection and Team Feed

### 3.1 Team list opens team-specific feed
Steps:
1. Open Teams tab.
2. Tap a specific team card.
Expected:
- Navigates to that team's Team Feed.
- Header and summary show the selected team.

### 3.2 Team Feed content scoping
Steps:
1. In Team Feed, switch between Players, All Posts, Matches, Updates, Events.
Expected:
- Only data relevant to the selected team is shown.
- Players tab shows linked players only.

### 3.3 Match RSVP highlighting
Steps:
1. In Team Feed matches, tap Yes, Maybe, No.
Expected:
- Selected option stays highlighted.
- Re-opening feed shows saved RSVP state.

## 4. Club Store Banner (Admin)

### 4.1 Admin banner edit availability
Steps:
1. Sign in as owner/admin.
2. Open Shop tab.
Expected:
- Edit Banner action is visible.

### 4.2 Non-admin restriction
Steps:
1. Sign in as non-admin member.
2. Open Shop tab.
Expected:
- Edit Banner action is not visible.

### 4.3 Banner update flow
Steps:
1. Tap Edit Banner.
2. Pick image and confirm.
Expected:
- Upload succeeds.
- Shop banner updates and persists after refresh.

## 5. Rostering Assignment Logic

### 5.1 Assign shift to group
Steps:
1. Create roster/shift from Create Item.
2. Choose assignment mode group.
3. Assign to U14 Gold.
Expected:
- Shift created with group assignment.
- Only U14 Gold members can see/fill it.

### 5.2 Assign shift to committee/executive
Steps:
1. Create shift assigned to Committee.
2. Create shift assigned to Executive.
Expected:
- Committee shift visible to committee only.
- Executive shift visible to executive only.

### 5.3 Assign shift to user
Steps:
1. Create shift with assignment mode user.
2. Pick a specific user.
Expected:
- Shift appears to assigned user as expected.
- Other unrelated users do not get it.

### 5.4 Open volunteer duty
Steps:
1. Create shift with open-to-all enabled.
Expected:
- Any club member can view and volunteer.

## 6. Tasks Assignment Logic

### 6.1 Assign task to group
Steps:
1. Create task assigned to U14 Gold.
Expected:
- Task visible to U14 Gold group only.

### 6.2 Assign task to user
Steps:
1. Create task with assignment mode user.
2. Select one member.
Expected:
- Task appears for assignee.
- Non-assignees do not see private/direct assignment.

### 6.3 Task completion permissions
Steps:
1. As assignee, toggle task complete.
2. As non-assignee non-admin, try to toggle.
Expected:
- Assignee/admin can update status.
- Unauthorized user is blocked.

## 7. Calendar List Mode

### 7.1 Toggle month/list
Steps:
1. Open Calendar tab.
2. Switch to List mode.
3. Switch back to Month mode.
Expected:
- List mode renders items correctly.
- Month mode renders date grid and filtered items.

### 7.2 Mixed item rendering in list mode
Steps:
1. Ensure at least one event, one task, and one roster entry exist.
2. Open list mode.
Expected:
- All supported item types appear with correct labels and metadata.

## 8. Group-Based Visibility (Wireframe Rules)

### 8.1 Team duty visibility
Steps:
1. Create duty assigned to U14 Gold.
2. View as U14 Gold user and non-U14 user.
Expected:
- U14 user sees duty.
- Non-U14 user does not.

### 8.2 Committee duty visibility
Steps:
1. Create duty assigned to Committee.
2. View as committee and non-committee users.
Expected:
- Committee user sees duty.
- Others do not.

### 8.3 Executive duty visibility
Steps:
1. Create duty assigned to Executive.
2. View as executive and non-executive users.
Expected:
- Executive user sees duty.
- Others do not.

### 8.4 Open duty visibility
Steps:
1. Create duty with openToAll true.
2. View as any club member.
Expected:
- All members can see and volunteer.

## 9. Automatic Match-Day Assignment (Future-Ready Check)
Current expectation:
- Helper methods exist to support scheduled auto-assignment logic.

Manual validation steps:
1. Create fixture set with first and last team on one day.
2. Trigger assignment logic path if available in management flow.
Expected:
- First team receives setup duty.
- Last team receives pack-down duty.

## 10. Admin/Super Admin Routing

### 10.1 Super admin login route
Steps:
1. Log in with super admin credentials.
Expected:
- Opens Super Admin console directly.
- Does not land on club member Home tabs with "No club selected".

### 10.2 Club admin without membership fallback
Steps:
1. Log in with club admin/owner profile with clubId but empty memberships.
Expected:
- Active club resolves from profile clubId fallback.
- More screen should not show Current: None.

## 11. Regression Smoke Checklist
Run after each release:
- Login/logout for Owner, Member, Super Admin
- Open Home, Teams, Calendar, Shop, More
- Open Team Feed and RSVP one match
- Create one task and one shift
- Toggle all settings switches
- Open Help & Support links
- Open Shop cart and checkout flow entry

## 12. Failures to Capture in QA Report
For each failed test, log:
- User account type/role
- Club ID
- Screen and action
- Expected vs actual
- Timestamp
- Screenshot/video
- Console error text if available
