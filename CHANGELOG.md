# Changelog

All notable changes to this project are documented in this file.

The project follows the business and security decisions in [USERS_SSOT.md](docs/USERS_SSOT.md).

## [Unreleased] — 2026-11-14

### Implemented directly on the live Supabase project

No Supabase staging branch was created. The user explicitly requested direct remediation without a staging branch. The following database migrations were applied to project `sjwheagxwpnqckmqxyme` and verified in the live migration history:

- `20261114120103_company_npwp_claim_and_project_registry`
- `20261114120137_company_super_admin_designation_and_sensitive_column_acl`
- `20261114120248_harden_company_and_project_rpc_wrappers`
- `20261114120315_enforce_company_project_workspace_integrity`
- `20261114120617_fix_company_review_and_claim_semantics`

### Added / Changed

1. **Company Registration and NPWP**
   - Company application now requires legal name, NPWP, and a separately designated Company Super Admin email; business email remains optional.
   - Server-side normalization accepts 15- or 16-digit NPWP input and rejects malformed characters/lengths. This is format validation, not tax-authority verification or a checksum/legal verification.
   - NPWP is encrypted with AES-256 PGP encryption. A random master key was generated inside the database and stored in Supabase Vault; purpose-derived keys separate encryption from deterministic duplicate detection.
   - Duplicate detection uses keyed HMAC-SHA256 fingerprints, advisory transaction locking, and unique indexes across application and company records.
   - Authenticated API roles cannot select NPWP ciphertext or fingerprints. The UI only displays the final four digits to Platform Super Admin reviewers.
   - The legacy three-argument registration RPC was removed. The new RPC requires NPWP and the designated Company Super Admin email.

2. **Company lifecycle and Company Super Admin seat**
   - Application lifecycle is now `PENDING → ACCEPTED | REJECTED`.
   - Acceptance creates a Company in `CLAIM_PENDING`, a Company Workspace in `CLAIM_PENDING`, and one reserved `UNCLAIMED` Company Super Admin seat.
   - RFIN-A issuance is restricted to the reserved claimant email and an unclaimed seat.
   - RFIN-A redemption atomically creates the active Company Super Admin membership, claims the seat, and activates the Company and Workspace. It does not mark the company as legally verified; legacy `verified_at` / `verified_by` remain unset.
   - A partial unique index prevents more than one active Company Super Admin membership per Company.
   - Existing RFIN-B activation is limited to already-active Companies.

3. **Canonical Project Registry and permission scope foundation**
   - Added `projects`, `project_client_relationships`, `project_memberships`, and `project_membership_permissions`.
   - Added RLS to all four registry/relationship/membership tables.
   - Project creation and membership assignment use guarded RPCs; exposed PostgREST wrappers are `SECURITY INVOKER`, while privileged implementation functions remain in the non-exposed `private` schema.
   - Composite foreign keys enforce workspace/company membership consistency and project/workspace consistency.
   - Added nullable paired `workspace_id` and `project_id` columns plus indexes and integrity constraints to 16 legacy operational tables: `project_control`, BOQ, schedules, inventory, cash, progress, safety, media, documents/signatures, attachments, and personnel.
   - Existing operational rows were not backfilled. Operational-table RLS cutover remains pending until the canonical project IDs and reviewed ledger mapping are available; this migration does not claim cross-tenant isolation is complete for legacy operational data.

4. **Workspace Center UI**
   - Registration form now collects NPWP and the designated Company Super Admin email.
   - Review queue displays only masked NPWP (last four digits) and uses `PENDING → ACCEPTED/REJECTED`.
   - RFIN-A action uses the reserved seat email instead of accepting an arbitrary recipient.

### Verification

- All five migrations appear in the live Supabase migration history.
- Platform review private implementation is executable only through the guarded Platform Super Admin path; the permission grant and wrapper were verified.
- NPWP encryption/decryption round-trip test passed using synthetic test digits; normalization test returned 15 digits.
- Vault master-key presence verified without exposing the key.
- NPWP ciphertext is not selectable by the `authenticated` role in either applications or companies.
- Unique NPWP fingerprint index exists; all four Project Registry tables have RLS enabled.
- All 16 listed legacy operational tables now have both scope columns.
- Existing production counts remain unchanged: `companies=0`, `company_registration_requests=0`, `company_memberships=0`, `projects=0`. No tenant, user, membership, project, or legacy operational row was created or reassigned.
- Security Advisor no longer flags the three newly added public onboarding/project RPC wrappers as exposed `SECURITY DEFINER` functions. Six pre-existing operational `SECURITY DEFINER` RPC warnings and disabled leaked-password protection remain for separate remediation.
- No staging branch was created and no staging cost was incurred.

### Remaining work / execution gates

4. **Provision CV Menara Megah**
   - Not performed. An authorized applicant must submit the Company Registration form with the real NPWP and designated claimant email; Platform Super Admin must then accept the application. No company or workspace is created manually.

5. **Claim Company Super Admin**
   - Not performed. After acceptance, Platform Super Admin must issue RFIN-A to the designated email and the claimant must redeem it while authenticated with that email.

6. **Create Project UDU and PT IMK client relationship**
   - Not performed because the Company Workspace and claimed Super Admin do not yet exist. Once available, create UDU under CV Menara Megah and record PT IMK only as a project client relationship. PT IMK must not become a tenant or receive membership from BOQ responsibility labels.

7. **Backfill legacy ledger and isolation testing**
   - Not performed. Wait for canonical Company Workspace and Project IDs, review the 1,440-row ledger, then backfill in controlled batches. The 13 personnel roster rows remain roster-only and must not be converted into Auth identities, Company Memberships, project memberships, or permissions.
   - Apply restrictive tenant/project policies to legacy operational tables only as part of the reviewed cutover, with positive and negative cross-tenant tests. The new nullable scope columns alone do not provide complete operational RLS isolation.

### Operational safeguards and follow-up

- Do not use the legacy `APPROVED` company approval path or create a Company/Workspace by manual shortcut.
- Do not create a PT IMK Company, Workspace, or Membership.
- Do not infer tenant/project permissions from BOQ owner labels or project personnel roster rows.
- NPWP encryption master key is stored in Supabase Vault. Establish and document backup/recovery, rotation, and incident-response procedures before collecting real company NPWP at scale.
- Enable Supabase Auth leaked-password protection and review the six remaining pre-existing SECURITY DEFINER findings.
- Supabase Vault documentation: https://supabase.com/docs/guides/database/vault
- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
