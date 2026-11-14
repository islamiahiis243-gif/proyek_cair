# Workspace Migration Update — 13 November 2026

## Business naming and ownership clarification — 14 November 2026
- Proyek Cair adalah nama platform, bukan nama tenant atau proyek operasional.
- UDU adalah proyek operasional di dalam Company Workspace tenant CV Menara Megah.
- CV Menara Megah adalah Company/Tenant owner untuk proyek UDU.
- PT IMK adalah client/pemberi kerja CV Menara Megah, bukan tenant kedua. Penyebutan IMK pada BOQ/material hanya menjelaskan tanggungan/supply responsibility item tertentu.
- Company Super Admin CV Menara Megah mengelola akses pengguna melalui Proyek Cair Console: view/read, CRUD, workflow/review/approval, TTE/QR signing, dan QR scan/verification sesuai permission dan scope.
- Klarifikasi ini adalah keputusan bisnis; snapshot database belum menunjukkan Company/Company Workspace/Membership yang diprovisioning dan tidak mengubah data legacy.

## Identity mapping
- `islamiahiis243@gmail.com`: Platform Super Admin, provisioned in `public.platform_admins`.
- `sumarlin.1103@gmail.com`: General User / Option B; normal Supabase Auth identity with Personal Workspace. This identity is not automatically a Company Super Admin and is not assigned a company membership.
- `sumarlin.1103@gmail.com` remains an individual User Identity / General User (Option B) in the historical snapshot. This identity is not itself the Company/Tenant record and is not automatically a Company Super Admin.
- The business entity CV Menara Megah is the intended tenant and Company Workspace owner for project UDU. Company registration, Company Workspace provisioning, and Company Super Admin claim must follow the approved onboarding flow; do not infer that they already exist from this historical individual account.
- In project UDU, PT IMK is the client. Item-level IMK responsibility/supply notes (including zero nominal / not invoiced by Menara Megah) are commercial attributes only; they do not create a PT IMK tenant, Company Workspace, or membership.
- The legacy operational records correspond to project UDU and target the CV Menara Megah Company Workspace. Existing records remain unmigrated until official tenant/workspace provisioning, canonical Project Registry design, row-level mapping, and migration gates are complete. No historical BOQ, stock, cash, progress, K3, or document rows were reassigned.

## Delivered database foundation
- Owner-only `personal_projects` CRUD with RLS.
- Company registration requests; only Platform Super Admin can approve/reject and approval creates Company + Company Workspace.
- RFIN-A issuance restricted to Platform Super Admin; one active Company Super Admin seat per company.
- RFIN-B issuance restricted to active Company Super Admin.
- RFIN codes use 192-bit random entropy, are stored only as SHA-256 hashes, have a bounded expiry, normalized recipient-email binding, single-use redemption, and revocation.
- RFIN-A issuance locks the company row and revokes earlier unredeemed RFIN-A tokens for that company; the single Company Super Admin seat is protected by serialized claim logic and the existing unique partial index.
- RFIN redemption is throttled to 10 attempts per authenticated user per 15 minutes. Attempts are persisted without storing submitted codes.
- Privileged implementations for RFIN issuance/redemption/revocation and company registration review were moved to the non-exposed `private` schema. Public PostgREST RPC entry points are `SECURITY INVOKER` wrappers with execution revoked from `PUBLIC` and `anon`; private implementations require authenticated identity and the appropriate platform/company role.
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
- RFIN redemption binds to the normalized authenticated email. Email verification policy remains dependent on Supabase Auth configuration; the flow does not accept a caller-supplied user ID.
- Rate limiting is per authenticated account, not per IP/device. Additional edge/network throttling may be appropriate before high-volume public launch.
- Existing legacy `SECURITY DEFINER` functions in the public schema remain and are outside this RFIN hardening change. Security Advisor continues to flag six legacy operational functions and leaked-password protection remains disabled; these were not changed to avoid disrupting live modules.
- Company registration and RFIN workflows need browser end-to-end tests with separate Platform Admin, Company Admin, and General User sessions.

## RFIN security verification — 13 November 2026
- Database smoke test confirmed an invalid RFIN returns a generic failure response through the public invoker wrapper.
- Eleven invalid redemption calls in one transaction produced the expected 11th-attempt throttle response; test transaction was rolled back.
- A database integration test created a temporary verified company, issued RFIN-A as Platform Super Admin, redeemed it as the invited General User, issued RFIN-B as the resulting Company Super Admin, and redeemed RFIN-B as the invited Platform account. Both memberships and both token redemptions were visible inside the test transaction; the transaction was rolled back so no test company, membership, or token remains.
- Negative authorization checks rejected RFIN-A issuance by a General User, RFIN-B issuance by a non-Company-Super-Admin, and company registration approval by a non-Platform-Super-Admin.
- Supabase Security Advisor no longer reports the RFIN or company-review functions as exposed SECURITY DEFINER RPCs. Six pre-existing legacy operational SECURITY DEFINER functions remain flagged, plus the existing leaked-password-protection warning.
- Browser end-to-end tests with separate real user sessions have intentionally not been run; they are the user's next verification step after this commit/deploy.
