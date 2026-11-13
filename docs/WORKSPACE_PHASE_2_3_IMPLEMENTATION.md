# Workspace Migration Update — 13 November 2026

## Identity mapping
- `islamiahiis243@gmail.com`: Platform Super Admin, provisioned in `public.platform_admins`.
- `sumarlin.1103@gmail.com`: General User / Option B; normal Supabase Auth identity with Personal Workspace. This identity is not automatically a Company Super Admin and is not assigned a company membership.
- “CV Menara Megah” is not auto-created as a tenant from the legacy project label. It can be registered later through the Company registration flow and verified by Platform Super Admin. This prevents accidental conversion of historical project data into a company's private tenant.

## Delivered database foundation
- Owner-only `personal_projects` CRUD with RLS.
- Company registration requests; only Platform Super Admin can approve/reject and approval creates Company + Company Workspace.
- RFIN-A issuance restricted to Platform Super Admin; one active Company Super Admin seat per company.
- RFIN-B issuance restricted to active Company Super Admin.
- RFIN codes are high-entropy, hashed with SHA-256 at rest, expiry-bound, recipient-email-bound, single-use, and revocable.
- Workspace context switching is audited in `workspace_context_audit`.
- Legacy operational tables/data/policies were not changed.

## UI delivered
- Workspace Center entry from sidebar and header.
- Workspace selector with persisted active context and audit event.
- Personal Projects create, rename, archive/unarchive, delete.
- Company registration request, RFIN redemption, platform verification and RFIN-A issuance; Company Workspace member can request RFIN-B.

## Important boundaries
- Workspace selector is real identity/context state, but operational modules are still legacy/global and are not yet tenant-scoped. The UI explicitly warns about this.
- No automatic migration of BOQ, inventory, cash, progress, K3, or documents.
- NPWP is not collected or stored in this first registration UI. The DB has placeholder encrypted/last-four fields, but a managed encryption key workflow and legal verification process must be defined before accepting NPWP.
- RFIN redemption currently binds to the authenticated email. Production hardening still needs explicit rate limiting and security review of privileged RPCs.
- Company registration and RFIN workflows need browser end-to-end tests with separate Platform Admin, Company Admin, and General User sessions.
