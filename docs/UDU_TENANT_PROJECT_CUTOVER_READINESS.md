# UDU Tenant / Project Cutover Readiness

**Snapshot:** Supabase project sjwheagxwpnqckmqxyme, checked 2026-11-14  
**Business baseline:** USERS_SSOT.md v3.1  
**Status:** BUSINESS OWNERSHIP CONFIRMED; TECHNICAL PROVISIONING AND CUTOVER BLOCKED

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
| workspaces | 3 rows | All three are Personal Workspaces |
| company_memberships | 0 rows | No Company Super Admin/member seat claimed |
| company_registration_requests | 0 rows | No company application submitted |
| personal_projects | 0 rows | No personal project records |
| project_control | 1 row | Legacy singleton named “Proyek Cair”; must become settings for canonical UDU project, not project master |
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

## 3. Critical onboarding mismatch discovered

Existing onboarding database objects are present, but no company has been registered. The current implementation must not be used to provision Menara Megah yet:

- Registration request has optional npwp_ciphertext and npwp_last4, but no duplicate fingerprint or uniqueness guarantee.
- The current submit RPC does not accept NPWP.
- The companies table does not retain the required encrypted/fingerprint NPWP fields.
- Current review RPC creates a VERIFIED company and ACTIVE workspace directly.
- SSOT v3.1 requires accepted application → tenant CLAIM_PENDING + unclaimed Company Super Admin seat → activation only after RFIN-A claim.

This is a release blocker. Do not create Menara Megah company/workspace or issue RFIN-A using the current path.

## 4. Canonical registry design

See UDU_CANONICAL_PROJECT_REGISTRY_SPEC.md. Target structure:
- companies / Company Workspace: tenant boundary.
- projects: canonical project master, UDU belongs to Menara Megah.
- project_client_relationships: PT IMK recorded as client, not tenant.
- project_control: legacy project settings mapped to UDU after canonical project creation.
- Operational rows and audit records mapped to project/workspace through a reviewed row-level ledger.

## 5. Work completed in this stage

- Re-read the uploaded implementation plan. It confirms the original project label “Pembangunan Kantor UDU - PT IMK & CV Menara Megah” and commercial split By Contractor / By IMK, but does not supersede the later business decision that Proyek Cair is platform, UDU is project, Menara Megah is tenant, and IMK is client.
- Re-inspected live schema, onboarding migrations, RLS, and current table contents.
- Created the row-level legacy mapping ledger.
- Prepared canonical project registry and cutover specification.
- No database row, schema, Auth account, RLS policy, storage object, or deployment was changed.

## 6. Remaining gates (ordered)

1. Correct and test Company onboarding NPWP + tenant/seat lifecycle against SSOT v3.1.
2. Confirm the designated Company Super Admin claimant identity for Menara Megah; do not infer from project roster.
3. Complete canonical Project Registry schema and its RLS/permission contract.
4. Provision tenant via the approved Platform Super Admin process.
5. Claim Company Super Admin seat with bound RFIN-A.
6. Create canonical project UDU and client relationship PT IMK.
7. Review and approve every mapping row, including audit events and parent/child integrity.
8. Rehearse migration on staging; verify backup/restore and positive/negative isolation tests.
9. Backfill in controlled phases; only then enforce non-null scope constraints and cut over application queries.

## 7. Release decision

NOT READY for tenant cutover. Business ownership is no longer ambiguous. Remaining blockers are onboarding compliance, canonical registry/RLS implementation, approved claimant, workspace/project IDs, and verified row-level migration.
