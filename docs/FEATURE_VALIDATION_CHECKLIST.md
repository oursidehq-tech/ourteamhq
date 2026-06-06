# GreenSports Mobile Feature Validation Checklist

Use this checklist after each implementation phase and at final QA.

## 0. Platform Baseline

- [ ] Firebase Authentication enabled with Email/Password provider.
- [ ] Firestore indexes deployed and status is "Enabled".
- [ ] Firestore rules deployed.
- [ ] Storage rules deployed.
- [ ] Expo app starts without red-screen Firebase config errors.
- [ ] No `failed-precondition` index errors in Metro logs.

## 1. Authentication

- [ ] Sign up works with valid email/password.
- [ ] Duplicate email gives safe error message.
- [ ] Login works for existing user.
- [ ] Logout returns to login screen.
- [ ] User profile document exists in `users/{uid}` after signup.
- [ ] Role and club membership fields are present.

## 2. Club Membership and Switching

- [ ] User can join a club by invite code.
- [ ] Owner can create a new club.
- [ ] User with 2+ clubs can switch current club.
- [ ] Switching club updates data across Home, Teams, Calendar, Shop.
- [ ] No data bleed between Club A and Club B.

## 3. Club Feed

- [ ] Feed query only shows posts for current club.
- [ ] Create post works with text and optional image.
- [ ] Visibility modes save correctly: public, network, club, team.
- [ ] Team-only posts are hidden from non-team members.

## 4. Public Club Page and Network

- [ ] Public page shows About section.
- [ ] Public page shows public posts only.
- [ ] Public page shows public events only.
- [ ] Public page shows shop preview for public products.
- [ ] Follow/unfollow updates `followedClubIds`.
- [ ] Network feed shows public/network posts from followed clubs.

## 5. Teams Module

- [ ] Teams list filtered by current club.
- [ ] Team detail loads feed, roster, and schedule.
- [ ] Team feed permissions behave correctly by role.

## 6. Events, RSVP, Calendar

- [ ] Coach/admin can create match/training/event.
- [ ] RSVP writes Yes/No/Maybe under event.
- [ ] Calendar loads only current club events.
- [ ] Recurring entries render for future dates.

## 7. Tasks System

- [ ] Admin can create task and assign users.
- [ ] Assigned users see task in their view.
- [ ] Recurring task rules generate expected tasks.
- [ ] Template and season rollover logic is correct.

## 8. Rostering

- [ ] Roster templates can be created.
- [ ] Volunteers can sign up for open slots.
- [ ] Reminder notifications are generated.
- [ ] CSV export contains expected rows and fields.

## 9. Trades and Suppliers

- [ ] Supplier records are club-scoped.
- [ ] Email template flow opens with supplier details.
- [ ] Service log entries save and load correctly.

## 10. Club Info

- [ ] Logo and banner upload/store URLs correctly.
- [ ] About/bio updates persist.
- [ ] Key people list persists.
- [ ] Contact visibility settings affect public page output.

## 11. Shop, Cart, Checkout

- [ ] Product list is club-scoped.
- [ ] Variant selection and cart quantity work.
- [ ] Checkout session is created by backend.
- [ ] Paid webhook updates order status to `paid`.
- [ ] User receives confirmation notification.

## 12. Notifications and Push

- [ ] In-app notifications list loads and marks read.
- [ ] Notifications are club-scoped.
- [ ] Triggered notifications appear for posts/events/tasks/rosters/orders.
- [ ] FCM push arrives on device for enabled events.

## Security Regression Checks

- [ ] Non-member cannot read private club data.
- [ ] Member of Club A cannot write data into Club B paths.
- [ ] Public views never expose private/member-only fields.

## Final Sign-off (Two-Club Test)

- [ ] Create content in Club A, verify absent in Club B.
- [ ] Create content in Club B, verify absent in Club A.
- [ ] Follow Club B from Club A account and confirm network feed behavior.
- [ ] End-to-end order + webhook verified in test mode.
