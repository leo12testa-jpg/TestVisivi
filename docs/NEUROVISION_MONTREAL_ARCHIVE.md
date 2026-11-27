# TestVisivi – NeuroVision, Montreal pilot
Draft only. No Firebase changes or data imported. Public source repository: no real athlete data or private credentials may be committed.

## Delivered
- Athlete page contains a separate NeuroVision section linking to neurovision-archive.html?id=existingAthleteId.
- Authenticated preview reads the existing athlete through dbGetAtleta under the signed-in user. File stays in memory; no uploads, no new Firestore reads beyond the existing athlete record, no writes. Preview clears on sign-out or leaving the page.
- Current parser supports the SEQ-01 JSON contract from the NeuroVision PR #88/#89. Check the actual local build export after deployment; do not assume the release modified by Codex has exactly the same fields.
- Import validates mode, counts, order/orientations, correctness and calibration fields; calculates accuracy and median from attempts. JND/PSE are copied from source, not independently fitted. The original source, participant identity, and clinical validity cannot be verified from an uploaded JSON. Explicit operator association is not automatic verification.
- SHA-256 fingerprint of canonical selected source configuration, timestamps and trials; exact retries deduplicate across selected athletes within one owner. Different/re-exported content may not deduplicate. A trusted source-generated stable session ID is required for automatic sync.
- Separate manual-import schema nv.manual-review.v1. It is not the authenticated nv.result.v1 transfer schema in NeuroVision PR #90. Both should eventually be adapted to a common read model with provenance retained.
- Disabled Firestore adapter with transaction create-or-compare. Nothing in UI calls it. NOT security enforcement by itself.

## Test locally
node --test tests/neurovision-archive.test.mjs
Use synthetic file only for browser test. Try unauthenticated, missing athlete, account switch while reading file, invalid JSON, file over 2 MB, duplicate and standard test/training. 9 preliminary JS checks executed on synthetic data; Node, browser and Firebase emulator tests are pending.

## Release blockers
1. Retrieve actual deployed rules for TestVisivi project and audit owner-specific access. No rules file found at repository root; do not replace deployed rules with a guessed ruleset. Add reviewed, emulator-tested rules for users/{uid}/neurovisionResults/{id}: owner-only reads/writes, schema and athlete existence checks, immutable create-only policy, safe owner-authorized deletion/retention. Deny cross-user, anonymous and unexpected fields. Do not deploy other rule changes.
2. Integrate results listing by athlete, Test/Training filter, comparison by compatible protocol, export and backup. Existing JET readers/normalizers must not ingest this collection. Existing athlete delete and duplicate merge functions must account for NeuroVision results first; define safe deletion/migration and test recovery before enabling writes.
3. Secure authenticated cross-project bridge only after agreed ownership and source data flow. No service account key in public frontend, no anonymous writes, no plan change. Use manual import for initial pilot only after rules review, explicit operator verification and consent/privacy assessment, especially for minors.
4. Verify current app shell/PWA update strategy and actual desktop/iPad/browser behavior. No patient data in offline caches without reviewed device policy.
5. Keep existing TestVisivi live and the NeuroVision SEQ-01 deploy separate. Only merge/publish after local review.

## Local history preview extension
Added js/neurovision-history.mjs and tests/neurovision-history.test.mjs. Multiple operator-confirmed imports may be compared in memory (up to 100). Exact duplicates are ignored; conflicts are rejected. Test/training and different recorded configurations are separated. Descriptive first/last differences are shown only for test sessions with identical recorded protocol and trial count; physical timing/display equivalence is not proven. Nothing persists, and page exit or logout clears the preview. 10 synthetic logic checks passed; browser and Node test suite still pending. Run node --test tests/neurovision-archive.test.mjs tests/neurovision-history.test.mjs.

## 27 November update — device-aware central archive
Supersedes earlier local retest comparison: all old imports without original device metadata are view-only; automatic deltas disabled. New shared js/neurovision-device.mjs and js/neurovision-projected-archive.mjs support strict verified-device grouping, separate modes, reviewed-profile and plan references, corrections and voids, stale-review detection. 10 projected-archive logic checks passed in JS. Actual authorized Firestore reads, event writes and UI integration pending. The central archive is for all participants, not only Montreal. See the private NeuroVision PR #90 architecture document for owner-scoped synchronization and release gates. Do not insert real data or secrets in this public source repository.
