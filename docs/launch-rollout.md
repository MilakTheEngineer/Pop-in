# Controlled owner → employee → customer rollout

This is an operator checklist, not authorization to deploy or send mail. The candidate keeps signup/recovery disabled by default. No production settings or data were changed during implementation.

## Migration and rollout

1. Record the deployed revision, existing pilot shop ID and current configuration privately. Verify the managed PostgreSQL backup/restore procedure; localhost PGlite evidence does not satisfy the production restore gate.
2. Before the candidate starts, run `node scripts/setup.mjs` using the existing production service environment (`npm run db:migrate` is the local `.env` wrapper), including its unchanged `POPIN_PILOT_SHOP_ID`. Do not run with `--seed`. Apply 060 (hashed, expiring owner recovery tokens) and 061 (durable shop launch approvals). The setup runner imports the existing pin into 061 in the same transaction; running the SQL file alone does **not** import the pin. An unknown nonempty pin aborts the transaction. An empty pin approves no shops. Confirm the expected existing shop has source `legacy_pin` before starting the candidate. Do not edit the pin to select a new shop.
3. Deploy only after approval and independent QA. Keep the existing HTTPS origin, encryption key, sender, delivery and verified-restore gates. Preserve encrypted outbox payloads, sessions, invite hashes and guest link hashes. Check the existing pilot's old invite, manage link and pending delivery before approving any additional shop.
4. The configured operator uses `/operator` → **Shop go-live approval** for each verified shop. Ordinary owners cannot approve themselves. Approval does not grant Pro, publish a page, or enable a flag. The owner still completes setup and publishes separately. Regular beta approval remains independent.
5. Enable approved-email signup or owner recovery only under separate authorization. Intake pause blocks new signup without removing durable approvals or disabling existing invite redemption, booking management or queued confirmations. Changing the legacy pin after 061 grants no access. A global delivery/restore gate still deliberately controls new bookings and sends; do not switch those off merely to pause intake.

## Rollback

Migrations 060/061 are additive. Retain their tables and records on rollback; do not delete tokens, approvals, bookings or outbox rows. Retain the original pin and encryption key.

Before any additional shop is approved, reverting to the prior production image with its original pin preserves the original pilot's links and messages. Migration 061 may stay applied; a rerun does not import a different pin. Reverting to the older image removes the new owner recovery route, so avoid issuing recovery links before the candidate is accepted.

After another shop has been approved, **do not roll back to single-pin code**: that would strand its outstanding invites and delivery. Pause new enrolments and operator approvals, and use a forward fix or rollback build retaining `lib/pilot.ts`'s durable approval gate and migration 061 compatibility. Do not repin between shops as a workaround. Existing customer management remains available. Review uncertain provider sends manually instead of reissuing them.

## Email recipient policy

Previously, `POPIN_BOOKING_EMAIL_ALLOWED_RECIPIENTS` was an **override** (allowlisted address OR approved shop), not a strict cap. This candidate removes that bypass from customer booking email enqueue and dispatch. The variable is no longer used for this policy: it neither authorizes a private draft nor restricts recipients of an approved shop. Production-mode localhost QA exercises approval-based enqueue/dispatch with no recipient allowlist and a fake transport; a focused negative test also sets the legacy list and proves a private draft still cannot enqueue.

Do not use that variable as a live smoke-test safety barrier. The production booking route accepts customer-supplied addresses for an approved shop. An unlisted URL reduces discovery but is not access control. Before authorizing any real send, explicitly confirm sender/restore readiness, the exact controlled test inboxes and input procedure, and any needed enforceable recipient restrictions at the provider or test environment. If those constraints cannot be established, stop at the local fake-delivery evidence; do not perform the production send.

## One unlisted production test shop (future authorized check)

- Obtain authorization for one operator-owned shop and controlled real owner/staff/customer inboxes. Use no customer data, payments or SMS. Use only the isolated direct `/book/<test-shop-slug>` route. Keep directory opt-in off and do not distribute the booking URL. Confirm the new draft is absent from directory/search and anonymous booking, queue and whānau routes return 404.
- Approve only the owner's exact email for registration. Use the public beta → setup path; verify the real inbox link, sign in, then test owner recovery and old-password/session rejection if recovery is authorized. Inbox receipt, spam placement and sender authentication require this real check; fake delivery cannot prove them.
- Confirm Free cannot issue a staff link. If employee QA is authorized, give this fictional shop a separately authorized Pro entitlement, never a Founder seat. Operator-approve this shop only. Create one service, a staff profile and limited hours, redeem the private staff invite, sign out/in and check its assigned calendar. Keep another draft unapproved as the isolation check.
- Make the owner setup test booking, then publish. On a signed-out mobile browser, book one controlled slot with the controlled customer inbox. Verify exactly one confirmation with the private fragment manage link and correct shop/time/staff. Move, verify the old slot reopens and staff calendar changes, then cancel and verify the moved slot reopens and the calendar clears. Check actual confirmation/change/cancellation inbox receipt and outbox status without logging tokens or message payloads.
- Revert the test writes: cancel the booking through its manage link (do not delete a live booking or restore an old database snapshot); revoke unused test invites, unpublish the test shop and remove its temporary hours to prevent new bookings. Preserve cancelled booking/outbox/audit records until normal retention. Remove the temporary signup allowlist entry and Pro entitlement only after pending messages are settled and staff access is removed under the existing workflow. Leave directory opt-in off. Do not remove approval rows to clean up: old links and pending messages rely on them.

No unlisted production fixture was created or authorized by the localhost run. The existing local fixtures use fictional `@example.test` addresses and disposable databases only.
