# Varello: two cleanup rounds

25 November 2026 (Pacific/Auckland). Follow-up to the four-round audit at `c5bcdd8469c99bae8f411db944bd9038d2dfa4e5`, on `codex/varello-four-round-qa`.

Local preview: http://127.0.0.1:3003. No deployment, real messages, payments, production data edits or hosted test site. Production backup logs were inspected read-only; no backup or private database was downloaded.

## Changes

- Replaced the unfinished privacy placeholder and false blanket “no messages” claim with factual information about booking/account data, enabled providers, private links, support, retained records and access/correction requests. Reused the private support form. This is a product disclosure correction, not a legal compliance certification or an invented retention policy.
- Corrected operator copy: missing overview telemetry is not evidence that the email provider is disconnected. Backup and restore status stays Unknown where the overview cannot verify it.
- Replaced the obsolete staging-only operator test with an isolated local shop and separate operator/owner/staff sessions. It tests actual booking conflicts, preview reminder failures, access denials, redaction, review/reopen auditing, retained audit records and phone layout. Review actions do not change appointments or send messages. Added it to the default local suite.
- Connected `npm test` to the existing guarded QA runner and added typecheck/lint commands. Installed Next’s ESLint configuration and the official TypeScript 6 compatibility API alongside the unchanged TypeScript 7 compiler.
- Replaced nine plain internal anchors with Next links in checkout, reports and customer empty/draft states. Destinations, permissions and booking steps are unchanged.
- Reused the existing guest and staff tests with an optional WebKit launcher. No parallel browser test suite.

## Two rounds and evidence

Round 1 checked privacy/support and the formerly blocked operator workflow. The support test opens the form by keyboard, simulates a failed save, retains the draft, retries, and verifies exactly one redacted report in the private queue. The operator fixture initially needed its database restarted on the dedicated port, deletion ordering corrected, and a timestamp-aware audit selector. Those failures were test setup/selector issues; evidence is retained.

Round 2 reruns those checks plus customer booking/move/cancel, staff invitation/access/leave, checkout, daily close, walk-ins and whānau. The first guest Back-step run failed; its isolated rerun passed with unchanged assertions. The failed attempt is retained and is not counted as a pass. WebKit passed guest booking/move/cancel and the staff invitation/leave/role/recovery journey. Its first staff attempt used a forced page navigation that collided with Calendar’s URL update; using the visible Clients link passed. Build and final TypeScript checks passed.

Evidence is under ignored `artifacts/qa-20261125/`: `suite-cleanup-*.json`, matching per-script logs and screenshots, `cleanup-lint.json`, `backup-log-evidence.json`, and final build/typecheck logs. Fixture credentials are kept in ignored `.env.qa`, never this report.

## Final results

| Check | Outcome |
| --- | --- |
| Privacy, Founder cap and support failure/retry | Passed locally on desktop and 390px; exactly one private redacted report |
| Operator access, incidents, review/reopen and missing telemetry | Passed locally with separate sessions; no booking mutation or reminder resend |
| Guest service selection, Back, book, move and cancel | Passed Chrome isolated rerun and WebKit; failed first Chrome attempt retained |
| Staff invite, role/location isolation, own leave and removal | Passed Chrome and WebKit; Calendar/Clients failure recovery and unsaved drafts included |
| Checkout and daily close | Passed locally; simulated payment fixture only; no charge |
| Walk-ins | Passed busy queue, pause, call/seat, duplicate action, leave uncertainty and recovery |
| Whānau | Passed creation, competing slots, moving together and cancelling whole visit |
| Build / TypeScript | Passed |
| ESLint | Zero errors; 96 existing warnings explicitly retained |

Eight focused scripts passed on their final Chrome runs; two of those same journey scripts also passed in WebKit. No failed assertion was weakened to obtain a pass. The browser/selector/setup issues above are documented separately from product defects.

Self-review of changed copy and the captured desktop/390px screens (not a new independent critic): Privacy wording **9**, ease **8.5**, clutter **8.5**; operator status wording **9**, ease **8.5**, clutter **8.5**. Existing layout and controls were retained. These scores are for the changed surfaces, not certification of every page.

## Backup evidence

The existing Railway backup job logged successful encrypted upload/download plus restoration into a temporary PostgreSQL instance on 22, 23 and 24 November at about 14:00 UTC. The latest observed success was **25 November, 03:00:37 NZDT**. Inspection used the existing backup service deployment `520e8cb9-ed98-473b-9766-44c73adaf278`.

The checked script compares the downloaded archive, restores it with `pg_restore --exit-on-error`, and queries `schema_migrations`. This proves those job runs completed those checks. It does not prove application-level disaster recovery, off-platform recovery-key custody, an agreed retention period or external failure alerts. No production configuration was changed.

## Remaining limits

- Existing lint debt remains visible: 96 warnings, zero errors at the cleanup check. React Compiler is not enabled; its effect/ref/purity migration checks are warnings, along with dependency and image warnings. They were not silently suppressed or represented as fixed. Broader effect refactoring is outside this focused cleanup.
- Real Resend/WebSMS/Stripe/Google delivery and provider behavior were not retested. Local provider-related checks remain simulations.
- WebKit on Windows is emulation, not a physical iPhone/Safari check. Full WCAG, penetration and load certification remain outside these rounds.
- Business retention decisions, independent recovery-key custody, external backup alerts and a full application recovery drill remain operational follow-up.

The privacy content follows the transparency topics described by the [NZ Privacy Commissioner](https://www.privacy.org.nz/responsibilities/poupou-matatapu-doing-privacy-well/transparency/). The tooling uses Microsoft’s documented [TypeScript 6/7 side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).
