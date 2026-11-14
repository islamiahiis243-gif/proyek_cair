# Changelog

All notable changes to this project are documented in this file.

The project follows the business and security decisions in [USERS_SSOT.md](docs/USERS_SSOT.md).

## [Unreleased] — 2026-11-14

### Added
- Established this changelog as the implementation record for the Proyek Cair platform.
- Recorded the approved implementation sequence for Company Registration, Company claim lifecycle, canonical Project Registry, CV Menara Megah tenant provisioning, Company Super Admin claim, UDU project/client relationship, and legacy-data backfill.
- Recorded the live-environment readiness baseline and explicit release gates in:
  - [UDU Tenant/Project Cutover Readiness](docs/UDU_TENANT_PROJECT_CUTOVER_READINESS.md)
  - [Canonical Project Registry Specification](docs/UDU_CANONICAL_PROJECT_REGISTRY_SPEC.md)
  - [Legacy Mapping Ledger](docs/migration/UDU_LEGACY_MAPPING_LEDGER_2026-11-14.csv)

### Verified
- Live Supabase project `sjwheagxwpnqckmqxyme` is `ACTIVE_HEALTHY` (Postgres 17.11.0.019, region `ap-southeast-2`).
- Live project currently has 0 companies, 0 company memberships, and 0 company registration requests; it has 3 Personal Workspaces and no provisioned Company Workspace.
- Current Company Registration schema has nullable NPWP ciphertext/last-four fields and does not expose a required NPWP submission contract or a deterministic protected duplicate fingerprint.
- Current registration lifecycle still uses the legacy `SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED` statuses. This does not yet implement the SSOT lifecycle `PENDING → ACCEPTED | REJECTED`, followed by tenant `CLAIM_PENDING` and Company Super Admin seat `UNCLAIMED`.
- Existing Company approval/provisioning RPCs require remediation before use; they must not be used to provision CV Menara Megah.
- Operational legacy tables do not yet have canonical `workspace_id` and `project_id` scope columns. The current `project_control` singleton is legacy project settings, not a canonical project registry.
- Supabase branch inventory currently contains only `main`; its branch status reports `MIGRATIONS_FAILED`, while the parent project control-plane status is `ACTIVE_HEALTHY`. No separate staging branch exists.
- Security Advisor currently reports six authenticated-callable `SECURITY DEFINER` functions and leaked-password protection disabled. These are additional security review items; they are not silently modified as part of the onboarding work.
- Supabase quoted the development branch at **USD 0.01344/hour** (approximately **USD 9.81 per 730-hour month** if left running). Branch creation has not been requested because this recurring cost requires explicit approval.

### Not yet implemented — blocked by release gates
The following work is **not claimed as implemented** in this change. No production database schema, data, Auth identity, membership, RLS policy, storage object, or deployment was changed.

1. **Company Registration security**
   - Required: server-side NPWP normalization/validation, encryption, keyed deterministic fingerprint with uniqueness, masked display, restricted access, log redaction, and mandatory NPWP RPC contract.
   - Gate: agree/verify the encryption-key custody and rotation mechanism, then implement and test on a healthy staging database.
2. **Company claim lifecycle**
   - Required: application `PENDING → ACCEPTED | REJECTED`; accepted company in `CLAIM_PENDING`; one distinct Company Super Admin seat in `UNCLAIMED`; activate only after authorized RFIN-A claim.
   - Gate: implement claim-seat storage and atomic, authorized, replay-safe claim flow; test unauthorized review, wrong claimant, expiry, replay, and no pre-claim active tenant.
3. **Canonical Project Registry and authorization**
   - Required: canonical `projects`, client relationship records, tenant/project referential integrity, project membership/scope, permission checks, and RLS for all scoped operational data.
   - Gate: resolve and migrate all legacy-table scope mappings without treating PT IMK commercial labels or roster rows as tenant membership or access grants.
4. **CV Menara Megah provisioning**
   - Blocked until steps 1–3 pass staging acceptance and the authorized company application is accepted. Do not create a tenant or Company Workspace by manual shortcut.
5. **Company Super Admin claim**
   - Blocked until the official accepted-application flow issues RFIN-A and the authorized claimant completes the claim.
6. **UDU and PT IMK relationship**
   - Blocked until the Company Workspace and Project Registry are available. Create UDU under CV Menara Megah; represent PT IMK only as the project's client relationship, never as a tenant from commercial BOQ labels.
7. **Legacy backfill and isolation tests**
   - Blocked until canonical workspace/project IDs exist and the staging schema is ready. Use the mapping ledger; do not infer Auth identities, Company Memberships, project memberships, or permissions from the 13-row operational personnel roster.

### Operational safeguards
- Do not run legacy company approval RPCs to create CV Menara Megah or issue RFIN-A.
- Do not create a PT IMK Company, Workspace, or Membership.
- Do not backfill the ledger with guessed IDs or infer tenant/project access from BOQ owner labels.
- Do not apply DDL or data migrations to production before a healthy staging environment and passing security/isolation tests are available.
- Supabase CLI v3 changes database commands to local-by-default and requires explicit hosted-change confirmation; any future deployment pipeline must deliberately target the intended environment. See the [Supabase CLI v3 breaking-change notice](https://supabase.com/changelog?types=breaking-change).
