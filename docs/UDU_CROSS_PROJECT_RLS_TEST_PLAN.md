# UDU Cross-Project RLS Cutover Test Plan

**Baseline:** USERS_SSOT.md v3.1  
**Status:** Test matrix prepared; live two-Project execution is BLOCKED until CV Menara Megah is onboarded, Project UDU is provisioned, and a second real Project exists.  
**Last updated:** 2026-11-14 20:24 WIB

## Safety rules

- Do not create dummy Companies, Workspaces, Projects, memberships, Auth users, BOQ rows, transactions, documents, signatures, or audit events for these tests.
- Use two real canonical Projects and existing authorized users only. If a required user or second Project does not exist, record the case as BLOCKED rather than fabricating identities.
- Run read-negative tests before any write-negative tests. Use transaction rollback for controlled write attempts.
- Do not enable the operational scope gate until every readiness blocker is zero and the release owner approves the cutover.
- A Company Super Admin seat is tenant administration authority, not a blanket operational permission. Grant test permissions explicitly via the project permission catalog.
- PT IMK remains a CLIENT relationship and must not receive a Company, Workspace, or Membership merely because a BOQ row is marked IMK.

## Required test identities and records

Use:
- One existing, active Company Member assigned to Project A only.
- One existing, active Company Member assigned to Project B only.
- One Company Super Admin who has no project operational permission grant for the tested action.
- PT IMK as a client relationship only, with no Auth identity or membership inferred from the relationship.
- Existing real records in each Project, including at least one BOQ row or another operational record. Do not add records just to make the test possible.

## Cross-project and permission matrix

| ID | Actor / context | Action | Expected result |
|---|---|---|---|
| RLS-01 | Member A, active Project A membership + project.read | Read Project A and its scoped rows | Allowed |
| RLS-02 | Same Member A | Read Project B rows by UUID/filter manipulation | Zero rows / denied |
| RLS-03 | Member B, active Project B membership + project.read | Read Project B rows | Allowed |
| RLS-04 | Same Member B | Read Project A rows | Zero rows / denied |
| RLS-05 | Member A with no boq.read | Read BOQ in Project A | Denied |
| RLS-06 | Member A with boq.read but no boq.update | Update a BOQ draft | Denied |
| RLS-07 | Company Super Admin without boq.read / project.read | Read operational BOQ rows | Denied |
| RLS-08 | Company Super Admin | Manage a project membership and grant an active catalog permission | Allowed subject to guarded RPC and tenant membership |
| RLS-09 | User not assigned to either Project | Read either Project | Denied |
| RLS-10 | PT IMK client relationship only | Read operational Project data as a Project Member | Denied; client relationship is not membership |
| RLS-11 | Anonymous caller | Read private documents, signatures, QR verification data, or project-evidence files | Denied |
| RLS-12 | Member A | Insert a child row whose parent belongs to Project B | Rejected by scope trigger / composite FK |
| RLS-13 | Member A | Attach an inventory/cash attachment whose parent belongs to Project B | Rejected |
| RLS-14 | Member A | Create or update a roster entry | Requires personnel.roster.manage; must not create Auth or Membership rows |
| RLS-15 | Member A | Upload project evidence under Project B's UUID prefix | Denied |
| RLS-16 | Member A | Invoke legacy SECURITY DEFINER mutation RPC without project-aware scope | RPC unavailable or rejected; never bypass scope |
| RLS-17 | Company Super Admin / appointed signatory | Create a document signature | Allowed only after active signatory appointment, document-level authority, and project scope checks are implemented |
| RLS-18 | Project Member with project.read only | Export audit logs | Denied; requires audit.export, distinct from audit.read |\n| RLS-19 | Anonymous caller | SELECT documents, document_signatures, or public_document_verification; call QR RPC | Denied by missing table/view grants and missing RPC EXECUTE; must reveal no document existence |\n| RLS-20 | Authenticated user without document.qr.scan or document.qr.verify | Submit a valid document token to private QR RPC | Generic no-result response; no document metadata is returned; denied scan is appended to audit_logs |\n| RLS-21 | Active member with both QR permissions in matching Project | Submit a valid issued/signed document token | Minimal verification metadata returned and DOCUMENT_QR_VERIFY_SUCCESS audit event appended |

## Private QR verification controls (implemented)

- `/verify` is now wrapped by AuthGate and no longer uses anonymous document access.
- The public verification view is no longer selectable by anon or authenticated; the frontend calls an authenticated invoker RPC.
- The private implementation requires both active `document.qr.scan` and `document.qr.verify` project permissions; it relies on active Company Membership + Project Membership and active catalog entries.
- Success and denial attempts are appended to audit_logs with no raw QR token; unknown tokens do not disclose a document reference.
- Anonymous table privileges were revoked from documents and document_signatures, the old public-verify RLS policy was removed, and the evidence bucket remains private.
- No documents or canonical Projects currently exist, so RLS-19 was checked at privilege level and no-result authenticated RPC behavior was tested, but RLS-21 cannot yet be exercised against real records. RLS-20's denied outcome branch requires a real authenticated user and document; this remains pending.

## Current verification already performed

1. All 16 operational tables have RLS enabled and 80 new restrictive scope policies are installed.
2. With the gate OFF, authenticated reads still return the legacy baseline: BOQ items 280, BOQ sections 39, project_control 1, and project_personnel 13.
3. In a rollback-only transaction, the gate was temporarily set ON and the same unscoped rows became invisible (0 visible rows). The transaction was rolled back; production remains OFF.
4. The live readiness function identifies 280 BOQ items, 39 sections, 1 project_control row, 13 personnel rows, and 1,107 audit rows without canonical scope.
5. Five legacy SECURITY DEFINER mutation RPCs remain executable by authenticated users and are cutover blockers.
6. The current application still creates evidence paths with the user UUID as the first folder segment. Project Evidence must be migrated to a Project UUID first segment before activation.

## Cutover entry criteria

The Platform Super Admin activation RPC must reject cutover until:
- all 16 operational tables have paired, canonical workspace_id/project_id values for every row;
- audit_logs have been resolved to the correct project/workspace or to an explicitly approved non-project scope;
- each operational Project has at least one active membership with an explicit project.read grant;
- Storage objects are project-prefixed and readable only through the project permission check;
- the five legacy SECURITY DEFINER mutation RPCs have been replaced with scoped versions or had authenticated EXECUTE revoked after callers are migrated;
- frontend CRUD and offline synchronization carry the validated active project context;
- document-signature creation checks active signatory appointment, project permission, document state, and authority level;
- RLS-01 through RLS-21 pass using real records and real active identities.

Only after these criteria pass should the Platform Super Admin call public.activate_operational_project_scope(). The switch is one-way through the public endpoint; emergency rollback requires a separately reviewed incident procedure, not a routine user-facing toggle.
