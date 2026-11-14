# UDU Tenant / Project Cutover Readiness

**Snapshot:** Supabase project sjwheagxwpnqckmqxyme, updated 2026-11-14 20:11 WIB
**Business baseline:** USERS_SSOT.md v3.1  
**Status:** ONBOARDING + PROJECT REGISTRY + GUARDED OPERATIONAL RLS FOUNDATION APPLIED; TENANT PROVISIONING, BACKFILL, AND RLS ACTIVATION PENDING

## 1. Confirmed business model

- Platform: Proyek Cair.
- Tenant / Company Workspace owner: CV Menara Megah.
- Operational project: UDU.
- Client: PT IMK, not a tenant.
- IMK responsibility on individual BOQ/material items is a commercial/supply attribute only.
- Company Super Admin Menara Megah configures view/read, CRUD, workflow/review/approval, TTE/QR signing, and QR scan/verification permissions through Proyek Cair Console.

## 2. Live database facts

| Object | Snapshot result | Interpretation |
|---|---:|---|
| companies | 0 rows | Menara Megah tenant has not been provisioned |
| workspaces | 3 rows | All three remain Personal Workspaces |
| company_memberships | 0 rows | No Company Super Admin/member seat claimed |
| company_registration_requests | 0 rows | No company application submitted |
| company_admin_seats | 0 rows | No unclaimed seat until an application is accepted |
| projects | 0 rows | Canonical registry is ready but no tenant/project has been provisioned |
| project_memberships | 0 rows | No project memberships |
| project_control | 1 row | Legacy singleton named “Proyek Cair”; map it to UDU settings after canonical project creation |
| boq_sections | 39 rows | Legacy BOQ hierarchy |
| boq_items | 280 rows | Legacy UDU BOQ items |
| project_personnel | 13 rows | Operational roster only; not Auth identity or Company Membership |
| audit_logs | 1,107 rows | 1,106 BOQ events + 1 profile event; preserve provenance |
| inventory_transactions | 0 rows | No legacy transactions to map in snapshot |
| boq_additions | 0 rows | Empty |
| item_schedules | 0 rows | Empty |
| inventory_locations | 0 rows | Empty |
| inventory_transaction_reversals | 0 rows | Empty |
| cash_transactions | 0 rows | Empty |
| progress_logs | 0 rows | Empty |
| safety_reports | 0 rows | Empty |
| project_media | 0 rows | Empty |
| documents | 0 rows | Empty |
| document_signatures | 0 rows | Empty |
| transaction_attachments | 0 rows | Empty |

The row-level source-to-target proposal is recorded in UDU_LEGACY_MAPPING_LEDGER_2026-11-14.csv. It contains 1,440 source rows: 280 BOQ items, 39 BOQ sections, 13 roster rows, 1 project_control row, and 1,107 audit events. All target workspace/project IDs remain blank by design.

BOQ remarks classify 44 rows with an IMK label, 235 with a contractor label, and 1 as unclassified. These are commercial responsibility hints only, not tenant ownership evidence.

## 3. Company Registration and claim lifecycle remediation — applied

The following production migrations were applied directly; no Supabase staging branch was created:

- `20261114120103_company_npwp_claim_and_project_registry`
- `20261114120137_company_super_admin_designation_and_sensitive_column_acl`
- `20261114120248_harden_company_and_project_rpc_wrappers`
- `20261114120315_enforce_company_project_workspace_integrity`
- `20261114120617_fix_company_review_and_claim_semantics`
- `20261114120901_complete_npwp_constraints_and_project_client_writes`
- `20261114121050_add_project_permission_catalog`
- `20261114121141_enforce_explicit_project_permissions`
- `20261114125949_add_guarded_operational_project_rls`
- `20261114130212_lock_down_scope_control_table_rls`
- `20261114130400_separate_roster_management_permission`

Implemented:
- Registration RPC requires NPWP and a separately designated Company Super Admin email.
- NPWP is normalized server-side, encrypted using AES-256 PGP with a master key held in Supabase Vault, and indexed for keyed HMAC-SHA256 duplicate detection.
- Ciphertext/fingerprint columns are not selectable by the authenticated API role; review UI displays only the final four digits.
- Application lifecycle is `PENDING → ACCEPTED | REJECTED`.
- Acceptance creates Company + Company Workspace in `CLAIM_PENDING` and one reserved `UNCLAIMED` Company Super Admin seat.
- RFIN-A is bound to the designated claimant email. Redemption atomically activates the membership, claims the seat, and activates Company/Workspace.
- Platform acceptance is not legal/KYC verification; legacy verified timestamp/actor fields remain unset by the claim flow.
- Public PostgREST RPC wrappers use `SECURITY INVOKER`; privileged implementations are kept in the non-exposed `private` schema.

Verification passed:
- Synthetic NPWP encryption/decryption round-trip and 15-digit normalization.
- Vault key presence without revealing its value.
- Sensitive-column privilege checks.
- Review implementation execute privilege and invoker wrapper checks.
- Live migration history contains all eight migrations.

Operational note: the operator procedure is documented in [NPWP_KEY_BACKUP_RECOVERY_RUNBOOK.md](NPWP_KEY_BACKUP_RECOVERY_RUNBOOK.md). The external key backup, custody verification, and recovery drill have NOT been performed; this gate remains open and real NPWP intake at scale must remain blocked. Format validation does not constitute tax-authority validation or independent legal verification.

## 4. Canonical Project Registry foundation — applied, operational cutover pending

Added:
- `projects`
- `project_client_relationships`
- `project_memberships`
- `project_membership_permissions`
- `project_permission_catalog` based on USERS_SSOT.md §18.2

RLS is enabled on all four registry tables and the permission catalog. Guarded RPCs require active Company Super Admin authority for project creation and membership assignment; permission assignment is restricted to active catalog codes. Company Super Admin client-relationship CRUD is enabled through its RLS policy. The Super Admin seat is not a blanket grant of operational permissions; project actions require explicit project permission assignments. Composite foreign keys enforce Company Workspace and project/workspace consistency.

Nullable paired `workspace_id` and `project_id` columns, indexes, and integrity constraints were added to 16 operational tables: `project_control`, BOQ sections/items/additions, schedules, inventory, cash, progress, safety, media, documents/signatures, attachments, and project personnel.

### Guarded operational RLS foundation — installed, enforcement OFF

Three additional production migrations were applied:

- `20261114125949_add_guarded_operational_project_rls`
- `20261114130212_lock_down_scope_control_table_rls`
- `20261114130400_separate_roster_management_permission`

Implemented:
- An inaccessible `private.operational_project_scope_control` singleton and Platform Super Admin-only, one-way `public.activate_operational_project_scope()` cutover RPC. Enforcement defaults to OFF; no application user can toggle the private control table.
- Eighty restrictive policies across the 16 operational tables: authenticated SELECT/INSERT/UPDATE/DELETE scope guards plus explicit anonymous deny policies. Existing permissive policies remain in place underneath the restrictive layer.
- When the gate is OFF, the restrictive guard is a compatibility pass-through, preserving the legacy workflow. When ON, every query/write must satisfy an explicit active project membership permission; null project scope is denied.
- Parent-scope derivation and mismatch checks for BOQ items/additions, schedules, inventory movements/reversals, media, document signatures, and transaction attachments. A child row cannot point to a parent in a different project.
- Added two module permissions for media upload and inventory-location management, and a distinct `personnel.roster.manage` permission. Roster management does not create Auth identities or Company/Project Memberships.
- Added paired nullable `workspace_id` / `project_id` columns, FK/check constraints, and an index to `audit_logs`; existing audit events remain unscoped pending audited backfill.
- Added restrictive Storage policies for `project-evidence`; after activation, evidence paths must start with the canonical Project UUID.
- Added a non-mutating readiness report and an activation guard that refuses cutover while operational/audit rows are unscoped, project evidence paths are not Project-prefixed, project.read grants are missing, or legacy SECURITY DEFINER mutation RPCs remain executable by authenticated users.
- Project-signature INSERT is deliberately denied once the gate is enabled until an SSOT-compliant signatory appointment and authority check exists. Read-only access is still project-scoped.

Verification on live Supabase:
- All 16 operational tables have RLS enabled and their new restrictive policies installed (80 policies total).
- The compatibility test with the gate OFF returned the existing 280 BOQ items, 39 sections, 1 project-control row, and 13 roster rows to the authenticated role.
- A rollback-only transaction temporarily enabled the gate and confirmed that the unscoped rows in those four tables became invisible (0 visible rows); the transaction was rolled back and production gate remains OFF.
- The live readiness report currently finds 280 unscoped BOQ items, 39 unscoped sections, 1 unscoped project_control row, 13 unscoped personnel rows, and 1,107 unscoped audit events. The 12 other operational tables are empty.
- Five legacy SECURITY DEFINER mutation RPCs are still executable by authenticated users. They must be replaced with project-aware implementations or revoked only after their callers are migrated.
- No operational row, audit event, user, Company, Workspace, or Project was created, rewritten, or reassigned. No dummy data was used.

**Important:** the project-scope policies are installed but NOT ACTIVE. They do not yet provide cross-tenant isolation while the gate is OFF. Do not enable the gate until canonical Company/Project IDs exist, every row and audit event is backfilled, front-end requests carry active project context, evidence paths are Project-prefixed, legacy SECURITY DEFINER mutation RPCs are fixed, and positive/negative cross-project tests pass.

Client relationships intentionally do not reference `companies` or Company Membership. PT IMK will be recorded as a project client only, not as a tenant.

## 5. Work completed

- Re-read the uploaded implementation plan and retained the clarified ownership model: Proyek Cair is the platform, UDU is the project, CV Menara Megah is the tenant, and PT IMK is the client.
- Re-inspected the live schema, onboarding functions, RLS, and data counts.
- Created the 1,440-row legacy mapping ledger.
- Applied and verified eleven production database migrations without creating a staging branch (eight onboarding/project-registry migrations plus three guarded project-scope/RLS migrations).
- Updated Workspace Center to collect NPWP and the designated claimant email, display masked NPWP in the review queue, use the new application lifecycle, and issue RFIN-A only to the reserved seat email.
- Added docs/NPWP_KEY_BACKUP_RECOVERY_RUNBOOK.md covering the separate Supabase Vault root key and Proyek Cair application master key, secure escrow, restore paths, rotation constraints, and incident response. This documents the procedure only; no key material was exported or backed up.
- Installed the gated operational project-scope RLS foundation, parent-scope triggers, Storage guards, audit-scope columns, readiness report, and one-way activation RPC. Enforcement remains OFF because canonical tenant/project IDs and audited backfill do not exist yet.
- Added SQL guardrail tests in supabase/tests/operational_project_scope_guardrails.sql.
- Updated package.json esbuild devDependency to ^0.28.0 after Vite 8.3.8 dependency resolution exposed a peer mismatch with esbuild 0.25; dependency installation and the production build then passed in an isolated Vercel Sandbox.
- Production build ran TypeScript noEmit plus Vite production bundling and transformed 1,951 modules. Existing >500 kB chunk-size warning remains. The repository did not contain package-lock.json; install was therefore resolved from package.json, and no lockfile was committed.
- Latest Vercel production deployment for main commit 0d520cb447e978deb2bf71610a1c136e41fdd8a6 reports READY.
- Updated CHANGELOG.md with implementation, verification results, and remaining gates.
- Latest Vercel production deployment for the updated main commit reports READY.

## 6. Remaining gates (ordered)

1. Connect an approved external secrets manager or perform the operator-controlled export to a named external secret manager with MFA, access logs, primary + backup custodians, and dual-custody recovery. No external secret-manager connector is currently available in this workspace; no key value was read or exported. Retrieval verification and recovery drill remain pending.
2. Authorized applicant submits CV Menara Megah registration in Workspace Center using its actual NPWP and designated Company Super Admin email.
3. Platform Super Admin reviews and accepts the application.
4. Platform Super Admin issues RFIN-A to the designated email; claimant signs in with that identity and redeems it.
5. Company Super Admin creates canonical Project UDU under CV Menara Megah and records PT IMK as a CLIENT relationship.
6. Review and approve every mapping row, including audit events and parent/child integrity.
7. Backfill legacy operational data using canonical workspace/project IDs; never infer access from BOQ owner labels or roster rows.
8. Complete the operational cutover prerequisites: add active project context to front-end CRUD/offline sync, migrate evidence Storage paths to <project_uuid>/..., replace the five legacy SECURITY DEFINER mutation RPCs with scoped implementations, implement appointed signatory authority checks, and backfill audit_logs scope. The restrictive RLS policies and one-way activation gate are installed but remain OFF.
9. Run positive and negative tests with two real canonical Projects and real active memberships (including Company Super Admin without operational grants, unauthorized users, PT IMK non-membership, anonymous QR access, and cross-parent mismatches). Only then call the Platform-Super-Admin-guarded activation RPC.
10. Verify external key backup/retrieval/recovery and database backup/restore/rollback procedures. No staging branch is required for this execution path; production changes must continue to be additive, explicitly reviewed, and independently verified.

## 7. Release decision

**NOT READY for tenant provisioning and operational cutover.** The Company Registration/claim lifecycle and Project Registry foundation have been applied and verified. CV Menara Megah has not yet been registered or accepted, no Company Super Admin has claimed the seat, UDU/PT IMK canonical records do not yet exist, and legacy data/audit backfill remains incomplete, the RLS enforcement gate remains OFF, front-end active-project context and RPC/storage/signatory cutover remain incomplete, and external NPWP key escrow/recovery is not verified.
