# Project Ownership Mapping & Schema Gap Specification

- **Project:** UDU / Proyek Cair
- **Tanggal snapshot:** 2026-11-14
- **Status:** Discovery & mapping specification — *belum disetujui untuk migration SQL*
- **Baseline otoritatif:** [USERS_SSOT.md v3.1](./USERS_SSOT.md)
- **Rencana remediasi:** [P0_REMEDIATION_PLAN.md](./P0_REMEDIATION_PLAN.md)
- **Audit arsitektur sebelumnya:** [ARCHITECTURE_AUDIT_AND_MIGRATION_PLAN.md](./ARCHITECTURE_AUDIT_AND_MIGRATION_PLAN.md)
- **Tujuan:** Memetakan setiap tabel legacy ke workspace, project, dan permission serta mengidentifikasi schema gap sebelum migration SQL multi-tenant pertama ditulis.

> **Penting — bukan migration.** Dokumen ini tidak menambah/mengubah kolom, policy, data, function, storage, atau deployment. Mapping yang belum didukung bukti ditandai **UNRESOLVED** dan tidak boleh diubah menjadi backfill otomatis. Semua angka adalah snapshot read-only 2026-11-14 dan wajib diambil ulang sebelum implementasi.

## 1. Executive decision

**Keputusan bisnis: Proyek Cair adalah nama platform; UDU adalah proyek operasional di dalam Company Workspace tenant CV Menara Megah; PT IMK adalah client, bukan tenant.** Target business ownership data proyek UDU adalah Company Workspace milik CV Menara Megah. Snapshot database 2026-11-14 belum memiliki Company/Company Workspace/Membership dan tabel project registry, sehingga keputusan bisnis ini belum berarti record tersebut sudah ada atau boleh langsung di-backfill tanpa mapping ledger.

Bukti yang tersedia:
- `public.project_control` memiliki satu row dengan label lama `Proyek Cair`. Berdasarkan konfirmasi terbaru, ini adalah label platform/legacy, bukan nama project; proyek operasional yang dimaksud adalah **UDU**. Jangan menganggap nilai lama tersebut sebagai canonical project name/ID.
- BOQ berisi 280 item dan 39 section; audit trail berisi 1.107 row.
- Semua 1.106 audit event bertipe `boq_items`; satu event bertipe `profile`.
- Roster `project_personnel` berisi 13 orang: 8 berlabel CV Menara Megah dan 5 berlabel PT IMK. Label IMK adalah relasi client/komersial atau roster proyek, bukan tenant.
- Konfirmasi terbaru menetapkan CV Menara Megah sebagai tenant pemilik Company Workspace proyek UDU; PT IMK adalah client dan bukan tenant.
- Snapshot memiliki 3 Personal Workspace, tetapi tidak ada Company, Company Workspace, atau Company Membership. Company Workspace Menara Megah belum terbukti diprovisioning di database.
- Tidak ada tabel `projects` pada inventory schema publik yang diperiksa. `personal_projects` adalah daftar project milik Personal Workspace dan bukan bukti bahwa proyek legacy sudah menjadi Personal Project.

Karena itu:
1. Gunakan **Platform = Proyek Cair**, **Tenant/Company = CV Menara Megah**, **Company Workspace = workspace milik CV Menara Megah**, **Project = UDU**, dan **Client = PT IMK** sebagai pemetaan bisnis otoritatif.
2. Workspace owner tidak lagi unresolved secara bisnis. Namun pada snapshot, Company/Workspace/Membership belum ada; jangan mengarang UUID atau mengisi `workspace_id` sebelum provisioning Company Workspace yang sah.
3. Jangan membuat tenant/Company Workspace untuk PT IMK atau Company Membership PT IMK hanya karena roster/label IMK atau item BOQ tanggungan client.
4. `owner_type`, label IMK/Kontraktor, dan tanggungan/pasokan item adalah atribut komersial/material; bukan tenant selector atau permission grant.
5. Jangan menulis migration SQL pertama yang melakukan backfill atau enforce `NOT NULL` sampai Company Workspace Menara Megah diprovisioning, canonical Project UDU dan mapping ledger disetujui, serta gerbang pada bagian 10 lulus.

## 2. Sumber dan tingkat keyakinan

| Sumber | Fakta yang dipakai | Batas interpretasi |
|---|---|---|
| Live Supabase schema inventory, project `sjwheagxwpnqckmqxyme`, 2026-11-14 | Nama tabel, kolom, PK/FK, RLS enabled, row counts | Snapshot bisa berubah; bukan pengganti recheck sebelum migration |
| Live read-only count/group queries, 2026-11-14 | Row counts dan distribusi `audit_logs`, `project_personnel`, `boq_items` | Tidak membuktikan tenant owner |
| `docs/ARCHITECTURE_AUDIT_AND_MIGRATION_PLAN.md` | Tidak ada pemindahan data operasional; BOQ/audit harus dipertahankan; legacy project masih belum ditetapkan workspace-nya | Snapshot dokumen 2026-11-13; beberapa jumlah sudah berubah |
| `docs/WORKSPACE_PHASE_2_3_IMPLEMENTATION.md` | Personal/Company foundation, RFIN, dan batas data legacy; klarifikasi 2026-11-14 menetapkan CV Menara Megah sebagai tenant UDU dan PT IMK sebagai client | Snapshot implementasi belum membuktikan Company Workspace sudah diprovisioning |
| `docs/USERS_SSOT.md` v3.1 | Tenant, membership, project scope, permission model, permission baseline per modul | Menentukan target authorization, bukan bukti data historis |
| `implementation_plan.md` yang diunggah | Kebutuhan domain: BOQ, barang, progres, kas, K3, dokumen, roster, offline cache | Beberapa konsepnya adalah target produk, bukan nama/kolom schema aktual; keputusan QR publik bertentangan dengan SSOT dan tidak diikuti |

### 2.1 Perbedaan angka antar snapshot

Audit architecture 2026-11-13 mencatat 32 `boq_sections`, sedangkan live count 2026-11-14 menunjukkan **39**. Dokumen audit lama juga mencatat 1 Auth user; live workspace audit berikutnya memiliki 3 Auth users/profiles/workspaces. Untuk mapping ini, gunakan snapshot live 2026-11-14 sebagai baseline sementara dan ulangi seluruh count saat migration preparation.

## 3. Workspace and project target model

### 3.1 Workspace target

Target workspace mengikuti SSOT:
- **PERSONAL:** hanya untuk data personal milik satu identity; tidak otomatis menjadi owner data operasional legacy.
- **COMPANY:** tenant perusahaan yang sudah melewati approval/provisioning dan memiliki membership aktif.
- **AWAITING_PROVISIONING:** status dokumenter untuk row legacy yang target tenant/project bisnisnya telah diputuskan tetapi Company Workspace ID dan/atau canonical Project ID belum tersedia. Bukan tipe workspace baru dan bukan nilai yang boleh diisi ke database.

### 3.2 Project target

| Atribut | Nilai mapping sementara | Status |
|---|---|---|
| Platform name | Proyek Cair | Confirmed business decision |
| Canonical operational project name | UDU | Confirmed business decision; canonical project UUID/table still pending |
| Tenant / Company | CV Menara Megah | Confirmed business decision; Company/Workspace provisioning not present in snapshot |
| Company Workspace owner | CV Menara Megah | Confirmed business decision; target DB UUID pending provisioning |
| Client | PT IMK | Confirmed business decision; not a tenant |
| Source anchor | Satu row `public.project_control` | Supported as source anchor only |
| Project registry table / canonical project UUID | Belum ditemukan pada schema inventory publik | UNRESOLVED |
| Workspace owner | CV Menara Megah (business decision) | Confirmed; DB workspace ID pending provisioning |
| Client / pemberi kerja | PT IMK | Confirmed; client relationship only, not tenant |
| Tenant / contractor | CV Menara Megah | Confirmed tenant and Company Workspace owner for UDU |
| Site | Muro / Murung Cahu, Kalimantan Tengah | Project context |
| Project membership roster | 13 `project_personnel` records | Roster only; bukan auth membership |
| Authenticated project membership | Belum ada model Project Membership pada schema inventory | Schema gap |

**Jangan menggunakan `project_control.id` langsung sebagai canonical `project_id` tanpa keputusan arsitektur.** Tabel tersebut saat ini berisi konfigurasi proyek tunggal, bukan project registry yang memiliki tenant FK, lifecycle, membership, atau scope. ID row-nya dapat dipakai sebagai source anchor saat membuat mapping ledger sementara, tetapi tidak otomatis menjadi project master ID.

### 3.3 Pemisahan tenant, project, client, dan commercial responsibility

- Nama perusahaan pada `project_personnel.company` hanya atribut roster.
- `project_personnel.linked_user_id` (jika terisi) harus diverifikasi terhadap Auth identity; bukan otomatis Company Membership.
- `inventory_transactions.owner_type` (KONTRAKTOR/IMK), label item IMK, atau catatan item tanggungan client menunjukkan tanggung jawab/pasokan komersial, bukan tenant owner.
- Label `company_name`, `signer_role`, `signer_email`, `company`, `created_by`, atau `updated_by` tidak menetapkan workspace.
- Data BOQ dapat memuat item tanggungan client, tetapi hal itu tidak mengubah tenant owner: CV Menara Megah tetap pemilik Company Workspace proyek UDU; PT IMK tetap client.
- Jumlah Personal Workspace dan akun Auth tidak menentukan ownership proyek.

## 4. Live schema inventory and legacy row baseline

### 4.1 Operational legacy tables

| Tabel | Row count 2026-11-14 | Workspace/project columns | Existing relationship / note |
|---|---:|---|---|
| `project_control` | 1 | Tidak ada | Satu row dengan label lama “Proyek Cair”; source anchor untuk project UDU, bukan project master |
| `boq_sections` | 39 | Tidak ada | Hierarki self-reference `parent_id`; sumber workbook |
| `boq_items` | 280 | Tidak ada | FK ke `boq_sections`; audit events merujuk ke tabel ini |
| `boq_additions` | 0 | Tidak ada | FK `item_id → boq_items` |
| `item_schedules` | 0 | Tidak ada | PK/FK `item_id → boq_items` |
| `inventory_locations` | 0 | Tidak ada | Lokasi gudang/laydown; dipakai inventory transaction |
| `inventory_transactions` | 0 | Tidak ada | FK ke BOQ item, location, addition, dan reversal |
| `inventory_transaction_reversals` | 0 | Tidak ada | FK ke original dan reversal inventory transaction |
| `cash_transactions` | 0 | Tidak ada | Ledger kas; actor FK ke Auth |
| `progress_logs` | 0 | Tidak ada | Progress period/work package; direferensikan media |
| `safety_reports` | 0 | Tidak ada | K3/HSE; direferensikan media |
| `project_media` | 0 | Tidak ada | FK opsional ke progress/safety |
| `project_personnel` | 13 | Tidak ada | Roster proyek; bukan tabel Auth membership |
| `documents` | 0 | Tidak ada | Dokumen proyek; memiliki verification token dan snapshot |
| `document_signatures` | 0 | Tidak ada | FK `document_id → documents` |
| `transaction_attachments` | 0 | Tidak ada | `transaction_kind + transaction_id` polymorphic reference |
| `audit_logs` | 1,107 | Tidak ada | 1,106 event `boq_items`; 1 event `profile` |

### 4.2 Workspace/platform foundation tables (bukan legacy project data)

Tabel berikut sudah ada pada schema snapshot, tetapi tidak boleh diperlakukan sebagai tabel operasional proyek legacy:

| Tabel | Row count | Scope yang benar | Catatan |
|---|---:|---|---|
| `profiles` | 3 | Identity-level; `personal_workspace_id` menunjuk Personal Workspace | `company/job_title/authority_level/role` lama bukan bukti membership/permission baru |
| `workspaces` | 3 | Workspace owner/company sesuai `workspace_type` | Tiga Personal Workspace; tidak ada Company Workspace pada snapshot |
| `companies` | 0 | Company/tenant registry | Belum ada tenant perusahaan |
| `company_memberships` | 0 | Company + workspace + user identity | Belum ada membership perusahaan |
| `platform_admins` | 1 | Platform scope, bukan project/tenant | Registry Platform Super Admin |
| `personal_projects` | 0 | Personal Workspace + owner identity | Bukan pengganti legacy project registry |
| `company_registration_requests` | 0 | Applicant identity + platform review | Onboarding, bukan project data |
| `rfin_tokens` | 0 | Company/recipient/invitation lifecycle | Credential lifecycle; bukan project scope |
| `rfin_redemption_attempts` | 0 | User identity | Security/rate-limit audit |
| `workspace_context_audit` | 0 | User identity + from/to workspace | Context switch audit; bukan operational project table |

Tabel sistem di atas menggunakan identity/company/workspace scope masing-masing. Tidak perlu menambahkan `project_id` ke tabel-tabel tersebut kecuali ada kebutuhan produk terpisah yang disetujui.

## 5. Per-table ownership mapping and schema gap

Status:
- **PROJECT-CANDIDATE:** bukti cukup untuk menghubungkan row ke legacy project Proyek Cair, tetapi bukan untuk memilih workspace.
- **INHERIT-PARENT:** scope wajib diturunkan dari parent FK dan diverifikasi agar tenant/project parent sama.
- **PROJECT-LEVEL:** scope project langsung; tidak ada parent operasional yang cukup untuk menentukan project.
- **EMPTY-FUTURE:** belum ada row; tidak ada historical backfill, tetapi semua insert baru harus scoped.
- **IDENTITY/PLATFORM:** bukan data project; tetap memakai identity atau platform boundary.

### 5.1 BOQ and project master

| Tabel | Workspace target | Project target | Permission baseline SSOT | Schema gap / mapping rule | Status |
|---|---|---|---|---|---|
| `project_control` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | Project UDU (business identity confirmed; canonical UUID pending) | `project.read`, `project.update`, `project.close` | Tidak ada workspace/project master FK. Putuskan apakah tabel ini tetap project settings atau dinormalisasi ke project registry; jangan menambah FK sebelum model final | PROJECT-CANDIDATE |
| `boq_sections` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU melalui satu legacy BOQ set | `boq.read`, `boq.create`, `boq.update`, `boq.approve`, `boq.revision` | Tambahkan scope pada BOQ root/project, atau relasi eksplisit ke project; parent-child section harus satu project | PROJECT-CANDIDATE |
| `boq_items` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU; 280 row | `boq.read`, `boq.create`, `boq.update`, `boq.approve`, `boq.addition.create`, `boq.revision` | Tidak ada scope column. Validasi `parent_section_id` dalam project yang sama; jangan menyimpulkan tenant dari category, source_sheet, atau owner | PROJECT-CANDIDATE |
| `boq_additions` | Inherit dari BOQ item | Inherit dari `item_id → boq_items` | `boq.addition.create`, `boq.read`, `boq.approve` | Composite tenant/project consistency terhadap BOQ item; saat ini 0 row | INHERIT-PARENT |
| `item_schedules` | Inherit dari BOQ item | Inherit dari `item_id → boq_items` | `procurement.read`, `procurement.update`; permission schedule-specific perlu diputuskan bila diperlukan | Tidak ada scope sendiri; pastikan schedule hanya dapat mengubah item pada project yang sama; saat ini 0 row | INHERIT-PARENT |

### 5.2 Inventory, cash, progress, safety, media

| Tabel | Workspace target | Project target | Permission baseline SSOT | Schema gap / mapping rule | Status |
|---|---|---|---|---|---|
| `inventory_locations` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU (project-level) | `inventory.read`, `inventory.count`, `inventory.movement.create` | Perlu scope langsung karena tidak memiliki project parent; unique `name` global saat ini mungkin harus menjadi unique per project/workspace | PROJECT-LEVEL / EMPTY-FUTURE |
| `inventory_transactions` | Inherit from BOQ item and location; both must agree | Inherit from `item_id`; source/destination locations must resolve to same project | `inventory.read`, `inventory.movement.create`, `inventory.movement.review`, `inventory.movement.approve`, `inventory.movement.reverse` | Tidak ada scope. Enforce parent scope consistency untuk item, source/destination location, addition, dan reversal; jangan percaya `owner_type` sebagai tenant | INHERIT-PARENT / EMPTY-FUTURE |
| `inventory_transaction_reversals` | Inherit from original transaction | Inherit from original/reversal transaction; both must match | `inventory.movement.reverse`, `inventory.read` | Kedua FK transaksi harus satu project/workspace; append-only/reversal semantics dipertahankan | INHERIT-PARENT / EMPTY-FUTURE |
| `cash_transactions` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU (project-level) | `cash.read`, `cash.transaction.create`, `cash.transaction.submit`, `cash.transaction.review`, `cash.transaction.approve`, `cash.transaction.void`, `cash.transaction.reverse`, `cash.export` | Tidak ada project FK atau scope; setiap row baru harus terikat ke project. Actor `created_by` tidak menentukan tenant | PROJECT-LEVEL / EMPTY-FUTURE |
| `progress_logs` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU (project-level) | `progress.read`, `progress.create`, `progress.update`, `progress.submit`, `progress.review`, `progress.verify`, `progress.approve`, `progress.return` | Tidak ada scope; `work_package/client_key` bukan pengganti project FK | PROJECT-LEVEL / EMPTY-FUTURE |
| `safety_reports` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU (project-level) | `k3.read`, `k3.report.create`, `k3.report.update`, `k3.report.submit`, `k3.report.review`, `k3.report.close`, `k3.incident.manage` | Tidak ada scope; reporter/reviewer bukan tenant membership | PROJECT-LEVEL / EMPTY-FUTURE |
| `project_media` | Inherit from linked progress/safety record; otherwise project-level | Inherit from `linked_progress_id` / `linked_safety_id`; if both null, explicit project scope required | Permission parent + `progress.read` / `k3.read`; upload permission harus diselaraskan | Dua parent reference dapat menyebabkan cross-project link; constraint/check harus memastikan semua parent pada project sama | INHERIT-PARENT / EMPTY-FUTURE |

### 5.3 Personnel, documents, attachments, audit

| Tabel | Workspace target | Project target | Permission baseline SSOT | Schema gap / mapping rule | Status |
|---|---|---|---|---|---|
| `project_personnel` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU roster | `project.read`, `project.assign`; `employee.read/create/update/manage` hanya jika Employee Record dipakai | 13 row adalah roster operasional, bukan User Identity, Company Membership, Persona, Role, atau Project Membership. `linked_user_id` harus diverifikasi satu per satu; jangan membuat Auth user otomatis | PROJECT-CANDIDATE |
| `documents` | TARGET: CV MENARA MEGAH / AWAITING_PROVISIONING | UDU (document scope) | `document.read/create/update/submit/review/approve/issue/sign/void/replace`, `document.qr.scan`, `document.qr.verify` | Tidak ada tenant/project FK. Scope harus mengikuti project/resource yang dokumen wakili; QR/TTE privat sesuai SSOT v3.1 | PROJECT-LEVEL / EMPTY-FUTURE |
| `document_signatures` | Inherit from document | Inherit from `document_id → documents` | `document.read`, `document.sign`, `document.approve` sesuai workflow | Signer identity/authority/appointment harus divalidasi terpisah; signature scope selalu sama dengan parent document | INHERIT-PARENT / EMPTY-FUTURE |
| `transaction_attachments` | Inherit from referenced transaction | Inherit from parent transaction resolved by `transaction_kind + transaction_id` | Permission parent resource + `document.read`/download scope yang sesuai | Polymorphic FK saat ini tidak menjaga referential integrity atau tenant consistency; buat allowlist transaction_kind dan resolver parent yang memvalidasi scope | INHERIT-PARENT / EMPTY-FUTURE |
| `audit_logs` | Inherit from target resource for tenant event; platform/identity event remains separate | Inherit from target project when entity is project-scoped | `audit.read`, `audit.export` | 1,106 `boq_items` events harus resolve melalui `entity_id → boq_items.id`; 1 `profile` event tidak boleh dipaksa ke project. Orphan/unknown entity harus quarantine/review. Audit append-only | MIXED / PARTIAL RESOLUTION |

### 5.4 Identity/platform tables — excluded from legacy project backfill

| Tabel | Workspace/project mapping | Permission / access model | Catatan |
|---|---|---|---|
| `profiles` | Identity-level; optional link ke Personal Workspace; tidak ada project_id | Self profile access; company profile/membership/access assignment terpisah | `role`, `company`, `job_title`, `authority_level` lama bukan grant otorisasi multi-tenant |
| `workspaces` | Root workspace entity; tidak memiliki parent workspace | Owner/member access sesuai tipe PERSONAL/COMPANY | Tidak diisi project_id |
| `companies` | Tenant root; company-linked workspace | Company profile permissions dan Platform approval guardrails | 0 row pada snapshot |
| `company_memberships` | Company + workspace + user identity | `membership.read`, `membership.invite`, `membership.update`, `membership.manage`, revoke/suspend/reactivate | Bukan project membership |
| `platform_admins` | Platform scope saja | Platform admin registry/guardrails | Tidak otomatis memberi tenant data access |
| `personal_projects` | Personal Workspace + owner user | Project permissions dalam Personal Workspace | 0 row; jangan pindahkan legacy Proyek Cair ke sini tanpa keputusan owner |
| `company_registration_requests` | Applicant identity + platform review | Company registration submit/review/approve/reject | Bukan project data |
| `rfin_tokens` | Company/recipient/invitation scope | `invitation.read/create/revoke/resend/preview` dan RFIN-A platform controls | Credential lifecycle; bukan project membership |
| `rfin_redemption_attempts` | User identity/security event | Server-generated security audit / rate-limit control | Bukan project data |
| `workspace_context_audit` | User identity + from/to workspace | `audit.read` sesuai scope dan server-generated context event | Context switch audit; bukan operational project data |

## 6. Permission mapping rules

Permission names di atas mengikuti baseline matriks SSOT v3.1 §18.2. Matriks ini adalah permission catalog baseline; hak efektif tetap memerlukan kombinasi:
- active Company Membership (untuk Company Workspace),
- project membership/scope,
- persona dan role assignment yang sah,
- permission atomik,
- authority/limit bila aksi bisnis memerlukannya,
- resource relationship dan workflow state.

**Tidak ada role yang otomatis mendapat akses hanya karena nama jabatan atau kolom roster.** Misalnya `DIRECTOR_IMK`, `CM_MM`, `SAFETY_MM`, `FINANCE_MM` pada roster tidak dapat dijadikan policy condition tanpa User Identity + active membership + project scope + assignment yang valid.

### 6.1 Permission gaps yang harus diputuskan sebelum policy SQL

SSOT §18.2 menyediakan permission baseline per modul, tetapi belum semua kebutuhan schema legacy memiliki permission atomik eksplisit. Putuskan dan tambahkan ke SSOT/catalog terlebih dahulu bila memang dibutuhkan:
- Schedule: apakah memakai procurement permission atau permission khusus `schedule.read/update`.
- Project roster: apakah `project.assign` cukup, atau perlu `project.members.read/manage` yang eksplisit.
- Inventory location management: perlu `inventory.location.manage` atau dicakup oleh `inventory.count`/movement permissions.
- Media upload/download: perlu permission khusus `project.media.upload/read` atau mengikuti resource parent.
- Attachment upload/download: aksi upload perlu permission terpisah atau diturunkan dari permission transaksi induk.
- Profile self-service: permission profile self-read/update belum dirinci pada matriks modul §18.2.
- Project settings: perlu bedakan `project.update` dari `project.close` dan `project.assign`.

Jangan membuat nama permission baru hanya di SQL policy tanpa memasukkannya ke permission catalog dan Effective Access Preview.

## 7. Relationship integrity and schema gap inventory

### 7.1 Missing scope keys

Seluruh tabel operational legacy pada §4.1 saat ini tidak memiliki `workspace_id` maupun `project_id`. Ini berarti:
- RLS tidak dapat menguji workspace/project scope langsung pada row legacy.
- Ownership harus diselesaikan sebelum scope key diisi.
- Menambah `workspace_id` tanpa project relationship tidak cukup untuk memisahkan beberapa project dalam satu tenant.
- Menambah `project_id` tanpa project registry dan tenant consistency tidak cukup untuk mencegah cross-tenant FK injection.

### 7.2 Parent consistency gaps

| Relationship | Gap saat ini | Target invariant |
|---|---|---|
| `boq_sections.parent_id` | Self-FK tidak menjamin seluruh hierarki satu project | Parent dan child selalu project/workspace sama |
| `boq_items.parent_section_id` | FK tidak menjamin section berada pada workspace/project yang sama | Item dan section scope sama |
| `boq_additions.item_id` | FK parent saja | Addition inherit item scope |
| `item_schedules.item_id` | FK parent saja | Schedule inherit item scope |
| Inventory item/location/addition | FK terpisah tidak menjamin scope konsisten | Item, source/destination location, addition, transaction satu project/workspace |
| Inventory reversal pair | Dua FK tidak menjamin scope sama atau pasangan lifecycle benar | Original dan reversal transaction scope sama; reversal append-only |
| `project_media` linked parents | Dua nullable FK dapat menunjuk progress dan safety berbeda project | Semua parent link satu project; jika tidak ada parent, project scope eksplisit |
| `document_signatures.document_id` | FK parent saja | Signature inherit document scope dan signer authorization |
| `transaction_attachments` | Polymorphic `transaction_kind/transaction_id` tanpa FK kuat | Parent type allowlisted, parent exists, scope inherited |
| `audit_logs.entity_type/entity_id` | Generic reference tanpa FK | Scope resolver berdasarkan entity registry; unknown/orphan di quarantine |

### 7.3 Unique constraints that may need scope-aware redesign

Jangan mengubah constraint sebelum business rule final:
- `boq_items.boq_code` unique global mungkin harus menjadi unique per project/BOQ set.
- `inventory_locations.name` unique global mungkin harus menjadi unique per project.
- `documents.document_no` unique global mungkin harus menjadi unique per company/project/document series.
- `project_control` saat ini satu row; multi-project memerlukan keputusan apakah table menjadi project-scoped settings atau diganti dengan project master.
- `boq_sections.node_code`/ordering and hierarchy uniqueness perlu dievaluasi per BOQ/project.
- Idempotency keys pada cash/inventory harus tetap unik sesuai domain transaction; jika constraint diubah, replay safety tidak boleh melemah.

## 8. Historical row classification and backfill policy

### 8.1 Row classification

| Dataset | Count | Classification | Backfill rule |
|---|---:|---|---|
| `project_control` | 1 | Legacy project anchor candidate | Gunakan sebagai evidence/reference; jangan otomatis menjadi project master |
| `boq_sections` | 39 | Legacy UDU BOQ hierarchy | Project UDU confirmed; target workspace CV Menara Megah awaiting provisioning |
| `boq_items` | 280 | Legacy UDU BOQ rows | Project UDU confirmed; target workspace CV Menara Megah awaiting provisioning |
| `audit_logs` entity `boq_items` | 1,106 | BOQ target-linked events | Resolve entity_id ke BOQ item lalu inherit project candidate; preserve actor/action/details/timestamp |
| `audit_logs` entity `profile` | 1 | Identity/profile event | Identity-level; jangan paksa masuk project |
| `project_personnel` | 13 | Legacy project roster | Project candidate only; no Auth/Company Membership auto-create |
| Other operational tables | 0 each (snapshot) | Empty domain tables | No historical backfill; new inserts require scope from day one |

### 8.2 No silent reassignment

- Jangan memindahkan 280 BOQ item ke salah satu dari 3 Personal Workspace.
- Jangan membuat Company Workspace untuk PT IMK. Company Workspace CV Menara Megah harus dibuat melalui Company onboarding/provisioning resmi, bukan sebagai efek samping migration.
- Jangan membuat Company Membership dari `project_personnel`.
- Jangan menyalin `company`, `job_title`, `project_role`, `authority_level` menjadi Persona/Role/Authority tanpa review assignment per user.
- Jangan menandai BOQ item sebagai milik IMK/kontraktor berdasarkan `category` atau nama deskripsi. Jika owner/supply responsibility perlu dipertahankan, itu domain attribute tersendiri, bukan tenant.
- Jangan menambahkan scope `NOT NULL` saat masih ada row unresolved.
- Jangan menghapus atau mereset audit history untuk mempermudah backfill.

### 8.3 Proposed mapping ledger (staging artifact)

Sebelum migration, siapkan mapping ledger terkontrol (CSV atau staging table non-production) minimal memuat:
`source_table`, `source_pk`, `legacy_project_key`, `target_project_key`, `target_workspace_id`, `mapping_method`, `evidence_reference`, `confidence`, `reviewed_by`, `reviewed_at`, `status`, `exception_reason`.

Rules:
- `target_workspace_id` tetap NULL sampai Company Workspace Menara Megah diprovisioning dan ID tervalidasi.
- Setiap mapping row harus dapat ditelusuri ke source evidence.
- Parent-derived mapping harus dicek konsistensinya.
- Row tanpa parent yang valid, orphan audit event, unknown entity type, atau conflicting evidence masuk quarantine.
- Mapping ledger bukan production authority; perubahan status memerlukan reviewer/data owner approval.

## 9. Permission and RLS design implications

Setelah mapping selesai, setiap policy harus memeriksa **workspace membership + project membership/scope + permission + resource relationship**. Company Membership saja tidak cukup untuk project data.

Pola konseptual:
```sql
-- Pseudocode only; not production SQL.
USING (
  private.has_project_permission(project_id, 'boq.read')
)
WITH CHECK (
  private.has_project_permission(project_id, 'boq.update')
);
```

Untuk child table yang mewarisi scope, helper harus resolve parent dan memastikan:
1. parent exists;
2. parent workspace/project sama dengan resource context;
3. caller memiliki active membership dan project scope;
4. caller memiliki permission untuk aksi;
5. parent lifecycle mengizinkan aksi.

RLS policy harus dipisah per command (SELECT/INSERT/UPDATE/DELETE) bila permission berbeda. `UPDATE` memerlukan validasi row lama (`USING`) dan row baru (`WITH CHECK`). Hapus/restrict policy permisif lama setelah replacement policy diverifikasi; permissive policies saling OR.

Storage object harus mengikuti resource parent, bukan hanya path string. Bucket `project-evidence` tetap private; policy harus resolve object ke project/resource dan permission. Signed URL tidak boleh menjadi bypass permanen atau dapat dibuat oleh user tanpa izin.

## 10. Decisions and evidence required before first migration SQL

Migration SQL pertama yang menyentuh operational legacy data **BLOCKED** sampai seluruh item ini diselesaikan:

| ID | Keputusan/evidence | Owner yang perlu menyetujui | Kondisi lulus |
|---|---|---|---|
| D-01 | Provisioning Company/Tenant dan Company Workspace untuk CV Menara Megah; jangan membuat tenant PT IMK | Platform Super Admin + Company applicant | Business owner confirmed; target tenant/workspace IDs tercatat setelah provisioning resmi |
| D-02 | Tetapkan canonical Project Registry untuk project UDU; putuskan apakah `project_control` menjadi settings child atau project master | Architecture/Data owner | Nama bisnis UDU confirmed; ERD, canonical UUID, lifecycle, FK dan multi-project behavior disepakati |
| D-03 | Tetapkan Project Membership/Scope schema dan lifecycle | Product/Architecture/Security | User hanya dapat mengakses project setelah assignment aktif |
| D-04 | Verifikasi 13 roster entries terhadap Auth identities; putuskan siapa yang benar-benar memerlukan akun/membership | Business owner + Company Admin | Mapping person ↔ auth identity disetujui; no auto-provision |
| D-05 | Pertahankan domain ownership/supply responsibility pada BOQ/material (item tanggungan IMK vs Menara Megah) sebagai atribut komersial terpisah | Commercial/Project owner | Attribute tidak dipakai sebagai tenant selector atau permission grant |
| D-06 | Finalisasi permission catalog untuk schedule, roster, locations, media, attachments, profile | Product/Security | Permission names masuk SSOT/catalog sebelum policy SQL |
| D-07 | Tetapkan unique constraints per project/workspace untuk BOQ code, document number, inventory location, node code | Data owner | Business uniqueness rule terdokumentasi |
| D-08 | Tetapkan mapping untuk audit event orphan/unknown dan retention | Security/Data owner | 1,107 event direkonsiliasi; semua event resolved/quarantined |
| D-09 | Tetapkan storage object ownership/path migration strategy | Security/Operations | Semua object terinventarisasi dan parent-scope validated |
| D-10 | Re-run live schema, row counts, policies, grants, functions, storage inventory, backup/restore | Engineering/DBA | Snapshot bertanggal dan disetujui |

### 10.1 Release gate

Sebelum menulis SQL migration:
- [ ] Company/Tenant CV Menara Megah dan Company Workspace telah diprovisioning secara resmi; target IDs tervalidasi.
- [ ] Canonical project registry telah diputuskan.
- [ ] Semua row legacy telah memiliki mapping atau quarantine status.
- [ ] 13 personnel roster tidak disamakan dengan Auth/Company Membership.
- [ ] Permission catalog telah final.
- [ ] Composite parent-scope invariants telah didesain.
- [ ] Unique/index changes telah dianalisis.
- [ ] Storage dan audit mapping telah direkonsiliasi.
- [ ] Backup restore berhasil pada environment terpisah.
- [ ] Staging test fixtures dan positive/negative RLS tests siap.

## 11. Recommended implementation order after approval

1. **Re-inventory:** ambil ulang schema, exact counts, PK/FK, policies, grants, functions, views, storage objects, dan source code dependencies.
2. **Finalize target ERD:** workspace → project → project membership/scope → resource; putuskan project registry.
3. **Prepare mapping ledger:** buat row-level mapping untuk BOQ, sections, audit, personnel, dan storage.
4. **Review exceptions:** resolve/quarantine setiap missing parent, orphan audit event, duplicate key, dan ownership ambiguity.
5. **Additive schema phase in staging:** tambahkan project registry/scope fields dan composite constraints tanpa menegakkan NOT NULL pada data yang belum resolved.
6. **Backfill staging:** jalankan mapping terkontrol; compare counts, FK consistency, checksums, and audit continuity.
7. **RLS/RPC implementation:** only after scope keys and permission catalog are stable.
8. **Production readiness review:** positive/negative tests, rollback rehearsal, security sign-off, written approval.
9. **Production migration:** separate authorization and execution step; this specification itself does not authorize it.

## 12. Permission-oriented positive/negative test matrix

| ID | Test | Expected |
|---|---|---|
| MAP-01 | Semua 280 BOQ items resolve ke satu legacy project candidate | Pass; project UDU consistent |
| MAP-02 | Tenant owner CV Menara Megah telah diputuskan tetapi Company Workspace/ID belum diprovisioning | Backfill ditahan sampai provisioning resmi dan target ID tersedia |
| MAP-03 | Attempt map UDU ke sembarang Personal Workspace | Fail/blocked |
| MAP-04 | PT IMK atau label tanggungan item dipakai sebagai tenant selector | Fail/blocked; CV Menara Megah tenant ditetapkan hanya melalui Company provisioning resmi |
| MAP-05 | 13 `project_personnel` rows dipakai untuk membuat memberships otomatis | Fail/blocked |
| MAP-06 | 1,106 audit BOQ events resolve ke existing BOQ item | Pass only if entity_id valid; otherwise quarantine |
| MAP-07 | 1 profile audit event dipaksa masuk project scope | Fail; tetap identity-level |
| MAP-08 | Addition/schedule points to BOQ item from another project | Fail |
| MAP-09 | Inventory transaction item and location belong to different projects | Fail |
| MAP-10 | Media progress parent and safety parent belong to different projects | Fail |
| MAP-11 | Attachment transaction_kind invalid or parent missing | Fail/quarantine |
| MAP-12 | Document signature signer lacks tenant/project/document authority | Fail |
| MAP-13 | Active company member without project membership reads project data | Deny |
| MAP-14 | Project member lacks module permission | Deny |
| MAP-15 | User with correct project membership and exact read permission reads scoped row | Allow |
| MAP-16 | Cross-tenant FK injection on insert/update | Deny |
| MAP-17 | Orphan/unknown audit entity type | Quarantine; no broad fallback access |
| MAP-18 | Unresolved row is subjected to NOT NULL workspace/project migration | Migration gate fails |

## 13. Snapshot findings — 2026-11-14

- Operational rows: 280 `boq_items`, 39 `boq_sections`, 1 `project_control`, 13 `project_personnel`, 1,107 `audit_logs`.
- Operational domain tables currently empty: `boq_additions`, `item_schedules`, `inventory_locations`, `inventory_transactions`, `inventory_transaction_reversals`, `cash_transactions`, `progress_logs`, `safety_reports`, `project_media`, `documents`, `document_signatures`, `transaction_attachments`.
- Workspace foundation: 3 `profiles`, 3 `workspaces`, 0 `companies`, 0 `company_memberships`, 1 `platform_admins`, 0 `personal_projects`.
- No operational legacy table in §4.1 has `workspace_id` or `project_id`.
- No `projects` or `project_memberships` table appeared in the public table inventory.
- `project_personnel` company distribution: 8 CV Menara Megah, 5 PT IMK; role distribution is 13 distinct roster roles.
- `audit_logs`: 1,106 `boq_items` events and 1 `profile` event.

All counts must be refreshed before implementation. The snapshot is descriptive, not an ownership decision.

## 14. Final recommendation

**Do not write the first tenant/project backfill migration yet.** Business ownership is confirmed: CV Menara Megah is the tenant/Company Workspace owner, UDU is its operational project, and PT IMK is the client (not a tenant). Remaining blockers are technical provisioning/IDs, canonical Project Registry design, row-level mapping ledger, parent-scope integrity, and migration tests. Preserve all BOQ and audit history; quarantine unresolved technical mappings rather than manufacturing IDs or memberships.

This specification is the pre-migration gate for [P0_REMEDIATION_PLAN.md](./P0_REMEDIATION_PLAN.md). It is not executable SQL and is not production-change authorization.


## 11. Row-level ledger and updated technical blockers — 2026-11-14

A live row-level proposal is now committed at [UDU_LEGACY_MAPPING_LEDGER_2026-11-14.csv](./migration/UDU_LEGACY_MAPPING_LEDGER_2026-11-14.csv). It contains 1,440 source rows: 280 boq_items, 39 boq_sections, 13 project_personnel roster rows, 1 project_control row, and 1,107 audit_logs events. Target tenant/project names are populated from the confirmed business decision; target workspace_id/project_id remain intentionally blank pending official provisioning and canonical registry creation.

Current BOQ remark classification: 44 items labelled IMK, 235 labelled contractor, and 1 unclassified. This classification is only a commercial responsibility hint. It is not tenant ownership, Company Membership, or an access grant.

Live snapshot confirms companies=0, company_memberships=0, company_registration_requests=0, workspaces=3 (all PERSONAL), project_control=1, BOQ sections=39, BOQ items=280, project_personnel=13, audit_logs=1,107. The operational transaction/report/document tables listed in the ledger readiness report are empty in this snapshot.

A critical onboarding gap is now recorded: company_registration_requests NPWP fields are nullable and lack a unique deterministic duplicate fingerprint; submit_company_registration does not accept NPWP; companies does not retain encrypted/fingerprint NPWP; current review flow directly creates VERIFIED company + ACTIVE workspace. This does not match SSOT v3.1's ACCEPTED → CLAIM_PENDING + UNCLAIMED seat → RFIN-A claim → ACTIVE lifecycle. Do not use the current approval RPC to provision Menara Megah.

Canonical schema and cutover sequence are specified in [UDU_CANONICAL_PROJECT_REGISTRY_SPEC.md](./UDU_CANONICAL_PROJECT_REGISTRY_SPEC.md) and [UDU_TENANT_PROJECT_CUTOVER_READINESS.md](./UDU_TENANT_PROJECT_CUTOVER_READINESS.md). Backfill remains blocked pending onboarding remediation, claimant designation, canonical project registry/RLS contract, mapping review, and staging rehearsal.
