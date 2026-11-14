# UDU Canonical Project Registry & Tenant Provisioning Specification

**Status:** DESIGN SPECIFICATION — NOT APPLIED  
**Date:** 2026-11-14  
**Authority:** USERS_SSOT.md v3.1 and business clarification confirmed 2026-11-14

## 1. Business identity (authoritative)

| Concept | Value | System meaning |
|---|---|---|
| Platform | Proyek Cair | Product/platform name only |
| Tenant / Company | CV Menara Megah | Owns the Company Workspace for UDU |
| Company Workspace | CV Menara Megah workspace | Tenant data boundary |
| Operational project | UDU | Project record inside Menara Megah Company Workspace |
| Client | PT IMK | Client/counterparty to Menara Megah; not a tenant |
| Item responsibility | Menara Megah / IMK | Commercial or supply responsibility only; never tenant ownership or permission |

Do not create a Company, Company Workspace, Company Membership, or Platform tenant for PT IMK on the basis of client references, roster labels, BOQ remarks, or inventory owner_type.

## 2. Canonical entity model

Target relationships:

companies (tenant) 1 — 1 workspaces[COMPANY] 1 — N projects  
projects 1 — N project_client_relationships  
projects 1 — N project-scoped operational records

project_client_relationships is a business relationship, not an identity or tenant relationship. The PT IMK row must not reference companies.id, workspaces.id, or company_memberships.

### 2.1 projects (canonical Project Registry)

Required logical fields:

- id uuid primary key: canonical project UUID, generated only during approved provisioning/migration.
- company_id uuid not null: tenant owner; references companies.id.
- workspace_id uuid not null: Company Workspace; references workspaces.id.
- project_code text not null: stable tenant-scoped code, unique per company.
- name text not null: UDU.
- status: lifecycle value governed by the project lifecycle decision; do not infer from project_control.status without mapping.
- contract_start_date, contract_end_date, actual_start_date, actual_end_date: nullable dates until verified.
- created_by, created_at, updated_at.

Integrity requirements:
- Workspace must have workspace_type='COMPANY' and workspaces.company_id = projects.company_id.
- Project code unique within tenant.
- Project reads/writes require active Company Membership plus the appropriate project-scoped permission and authority. Membership alone must not grant all CRUD/approval/TTE rights.
- RLS is the enforcement boundary. A client-supplied workspace_id or project_id is never trusted without server-side relationship and permission validation.
- Use USING and WITH CHECK for updates; avoid broad permissive policies because policies combine with OR.

### 2.2 project_client_relationships

Required logical fields:
- id uuid primary key
- project_id uuid not null references projects(id)
- relationship_type text not null (for this record: CLIENT)
- display_name text not null (for UDU: PT IMK)
- optional client reference / notes / effective dates, if business-approved.
- created/updated audit metadata.

This relation deliberately has no tenant/workspace membership semantics and does not create a client login. A future client portal, if ever approved, must use a separate explicit identity, tenant, and permission decision.

### 2.3 Legacy project_control

Treat the current singleton row as legacy project settings/configuration, not the canonical project master. During approved migration:
- preserve its primary key and existing values;
- add and map project_id to canonical UDU;
- retain contract/actual dates and operational status as settings only after validating semantics;
- do not treat the current project_name='Proyek Cair' value as the project name. It is a legacy platform label; canonical project name is UDU.

### 2.4 Operational tables

The intended ownership chain is:

company_id → workspace_id → project_id → operational row

For each operational table, decide whether both workspace_id and project_id are stored or whether one is derived through a non-null, immutable FK chain. The selected design must:
- enforce same-tenant parent relationships;
- scope BOQ sections/items, inventory, cash, progress, safety, media, documents, signatures, and attachments;
- scope audit events to the resource/project when known, without rewriting actor/entity provenance;
- preserve referential integrity for BOQ parent sections/items and inventory/document relations;
- include storage object ownership/path validation in a separate Storage migration.

Do not add NOT NULL constraints or perform a bulk backfill until the mapping ledger is approved and tested.

## 3. Commercial responsibility is not tenant ownership

Current boq_items.remarks and inventory_transactions.owner_type carry labels such as “By kontraktor” and “IMK”. Interpret them as commercial/supply responsibility. They must not:
- select a tenant or workspace;
- create an IMK Company/Workspace/Membership;
- grant read, CRUD, approval, TTE, or QR verification permissions;
- override the Company Super Admin's explicit permission configuration.

Keep the source value and add a normalized commercial responsibility attribute only in a separately reviewed migration.

## 4. Company onboarding must be corrected before provisioning

The current database snapshot contains no Company, Company Workspace, Company Membership, or company registration request. The existing onboarding schema/RPC is not yet compliant with SSOT v3.1:

1. company_registration_requests has npwp_ciphertext and npwp_last4, but the fields are nullable and there is no deterministic protected duplicate fingerprint/unique constraint.
2. The current submit_company_registration(p_legal_name, p_business_email, p_notes) RPC does not accept NPWP.
3. companies has no NPWP ciphertext/fingerprint/last-four columns.
4. The current review/approval function creates a VERIFIED company and an ACTIVE Company Workspace immediately on approval.
5. SSOT requires application PENDING → ACCEPTED | REJECTED, accepted tenant CLAIM_PENDING, and Company Super Admin seat UNCLAIMED; tenant and seat become active only after the authorized signup/claim flow.

Required remediation before accepting a real company:
- NPWP normalization and format validation on the server;
- encrypted NPWP storage, deterministic keyed fingerprint for duplicate detection, unique constraint on fingerprint, masked display, restricted access, and log redaction;
- NPWP required on the submission RPC; never log plaintext NPWP;
- explicit application decision lifecycle;
- approval creates the accepted tenant in CLAIM_PENDING and an UNCLAIMED Company Super Admin seat, not an active membership;
- RFIN-A claim is bound to the designated invitee and only then activates the workspace and Company Super Admin membership;
- tests for duplicate NPWP, unauthorized review, wrong claimant, expired/replayed RFIN, and no active tenant before claim.

Do not use the existing review RPC to create the Menara Megah tenant until this gap is remediated and tested.

## 5. Project UDU provisioning sequence

1. Complete and approve the company onboarding/NPWP remediation.
2. Submit the official CV Menara Megah Company application through the authorized applicant identity.
3. Platform Super Admin reviews and accepts the application.
4. Provision the tenant in CLAIM_PENDING and the unclaimed Company Super Admin seat.
5. Issue RFIN-A to the explicitly designated Company Super Admin claimant; verify email binding, expiry, one-time use, and audit.
6. Claim the seat; only then activate the Company Workspace and membership.
7. Create canonical Project Registry row UDU under the Menara Megah Company Workspace.
8. Create the project-client relationship PT IMK with type CLIENT; do not create a PT IMK tenant.
9. Approve the row-level mapping ledger and perform staging backfill with preserved audit history.
10. Run tenant/project isolation, CRUD, approval, TTE/QR, Storage, RPC, and negative cross-tenant tests before production cutover.

## 6. Current implementation gate

No provisioning, canonical project row, or legacy backfill has been executed by this specification. It is intentionally a design document until onboarding lifecycle and NPWP controls, authorization model, mapping ledger, staging rehearsal, backup/restore, and release gates are approved.
