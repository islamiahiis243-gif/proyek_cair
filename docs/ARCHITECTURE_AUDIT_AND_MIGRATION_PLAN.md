# Architecture Audit & Migration Plan — Personal / Company Workspace

- **Tanggal audit:** 2026-11-13
- **Repository:** `islamiahiis243-gif/proyek_cair`
- **Supabase project:** `sjwheagxwpnqckmqxyme`
- **Status:** Audit selesai; fase fondasi additive diterapkan; migrasi operasional multi-tenant belum selesai.
- **Prinsip keselamatan:** Tidak mengubah atau memindahkan data operasional lama secara massal sebelum project ownership dan tenant boundary disepakati serta diuji.

## Business naming and ownership clarification — 14 November 2026
- Proyek Cair is the platform name.
- UDU is an operational project within the Company Workspace owned by tenant CV Menara Megah.
- PT IMK is the client of CV Menara Megah on project UDU, not a tenant. Item-level IMK supply/responsibility labels are commercial attributes, not tenant ownership.
- Company Super Admin for CV Menara Megah configures view/read, CRUD, workflow/approval, TTE/QR signing, and QR scan/verification permissions in the Proyek Cair Console.
- This business decision does not imply Company, Company Workspace, memberships, or project registry are already provisioned in the database; historical records have not been moved.

## 1. Executive summary

Aplikasi saat ini adalah Vite + React + TypeScript dengan Supabase Auth/Postgres. Alur autentikasi sudah mendukung email/password dan Google OAuth. Profil pengguna masih menggunakan satu tabel `profiles` dengan role global sederhana. Modul BOQ, inventory, cash, documents, progress, safety, media, dan personnel masih merupakan domain operasional proyek lama yang belum memiliki workspace/tenant scope.

Database memiliki 1 Auth user, 1 profile, 280 BOQ items, 39 BOQ sections, 1,107 audit logs, dan 13 project_personnel records. Ledger inventory/cash, documents/signatures, progress, safety, dan project media masih 0 baris pada saat audit. Data BOQ dan audit adalah data existing yang harus dipertahankan.

Fase pertama telah menambahkan fondasi tabel Company, Workspace, Company Membership, auto-provision Personal Workspace, profile linkage, dan RLS baca minimum. Semua perubahan bersifat additive. Tidak ada tabel operasional lama yang diubah atau di-backfill ke personal/company workspace.

## 2. Temuan arsitektur aplikasi

### 2.1 Frontend dan autentikasi
- Entry point `src/App.tsx` membungkus aplikasi di `AuthGate`, lalu `AppProvider`.
- `AuthGate` menggunakan Supabase Auth `signInWithPassword`, `signUp`, dan Google OAuth.
- Sesudah autentikasi, aplikasi membaca `profiles(id, full_name, role, is_active)`; role database dipetakan ke role UI.
- Profil yang tidak ditemukan diperlakukan sebagai `viewer` di frontend, tetapi tidak ada mekanisme workspace selection.
- `AppContext` memuat modul operasional langsung dari tabel global `boq_items`, `inventory_transactions`, `cash_transactions`, `documents`, `progress_logs`, `safety_reports`, dan tabel terkait.
- Offline queue untuk mutasi stok/kas menyimpan `user_id` dan hanya mengirim queue milik user yang sedang login. Queue tetap per-browser/per-device.
- Header sebelumnya menampilkan identitas operasional statis; belum ada context switcher Personal/Company.

### 2.2 Dampak terhadap target multi-workspace
- Signup mandiri sudah ada, tetapi sebelum migrasi tidak otomatis membuat Personal Workspace.
- Tidak ada Company Workspace atau Company Membership.
- Tidak ada RFIN-A/RFIN-B Engine.
- Tidak ada pemisahan active workspace di frontend.
- Modul lama tidak boleh langsung dianggap sebagai Personal Workspace hanya karena pengguna login. Modul tersebut tetap merupakan data proyek legacy sampai project ownership dipetakan secara sah.

## 3. Temuan Supabase

### 3.1 Struktur dan data
Snapshot saat audit:
| Entitas | Jumlah |
|---|---:|
| auth.users | 1 |
| profiles | 1 |
| project_personnel | 13 |
| boq_items | 280 |
| boq_sections | 39 |
| audit_logs | 1,107 |
| inventory_transactions | 0 |
| cash_transactions | 0 |
| documents | 0 |
| document_signatures | 0 |
| progress_logs | 0 |
| safety_reports | 0 |
| project_media | 0 |

Project aktif, PostgreSQL 17.11.0.019, region `ap-southeast-2`. Tidak ada Supabase Edge Functions pada saat audit.

### 3.2 RLS dan otorisasi lama
RLS aktif pada tabel public yang diaudit, tetapi banyak policy read memakai `USING (true)` untuk role `authenticated`. Contoh: BOQ items/sections, inventory ledger, progress, safety, project media, personnel, documents, attachments. Beberapa tabel memiliki role-based write policies berbasis `profiles.role` dan `current_user_role()`.

Artinya, sistem lama pada dasarnya adalah satu ruang operasional bersama untuk semua pengguna terautentikasi, bukan sistem multi-tenant. RLS aktif tidak sama dengan tenant isolation. Kebijakan global tersebut tidak boleh dianggap cukup untuk Company Workspace multi-tenant.

### 3.3 Security advisor
Temuan yang masih ada:
- 6 SECURITY DEFINER functions dapat dipanggil oleh authenticated: `create_boq_addition`, `current_user_role`, `record_cash_mutation`, `record_inventory_mutation`, `record_inventory_mutation_v2`, `reverse_inventory_transaction`.
- Leaked password protection Supabase Auth belum aktif.
- Performance advisor mencatat 12 FK tanpa covering index, 5 RLS initplan warnings, dan beberapa multiple permissive policy warnings.
Temuan ini bukan bagian dari migrasi workspace dan tidak diubah pada fase ini untuk menghindari perubahan perilaku modul lama.

## 4. Fondasi yang sudah diterapkan

Dua migrasi additive diterapkan pada Supabase dan disimpan di repository:
- `20261113131630_personal_company_workspace_foundation`
- `20261113131642_ensure_personal_workspace_profile_link`

Perubahan:
1. Tabel `companies` dengan status registrasi/verifikasi.
2. Tabel `workspaces` dengan tipe PERSONAL atau COMPANY dan constraint ownership.
3. Tabel `company_memberships` dengan status membership dan flag Company Super Admin.
4. Unique partial index memastikan maksimal satu membership Company Super Admin aktif per company.
5. Trigger membuat Personal Workspace otomatis setelah Auth user dibuat.
6. Backfill Personal Workspace untuk Auth identities yang sudah ada.
7. Kolom `profiles.personal_workspace_id`.
8. RLS read untuk pemilik Personal Workspace dan anggota aktif Company Workspace.
9. Tidak ada authenticated write policy untuk membuat company/workspace/membership; provisioning harus server-controlled.
10. Trigger validasi memastikan membership merujuk ke Company Workspace yang sesuai.

Profil existing sudah tertaut ke Personal Workspace. Belum ada Company row, Company Workspace, atau Company Membership yang dibuat.

## 5. Keputusan penting untuk menjaga modul legacy

**Jangan mengubah seluruh tabel operasional menjadi personal-owned atau company-owned secara otomatis.**

Alasan:
- Satu proyek UDU berada dalam tenant CV Menara Megah; PT IMK adalah client. Client-side item responsibility tidak membuat PT IMK menjadi tenant.
- `project_personnel` berisi 13 orang, bukan 13 akun Auth.
- BOQ 280 items dan audit 1,107 baris merupakan data operasional historis.
- Tidak ada transaksi stok/kas atau laporan operasional yang perlu dipindahkan pada snapshot saat ini, tetapi relasi dan kepemilikan BOQ/project tetap perlu keputusan eksplisit.

Untuk sementara, aplikasi mempertahankan modul operasional legacy dan tidak menampilkan seolah-olah data proyek tersebut sudah menjadi data Personal Workspace.

## 6. Rencana migrasi bertahap

### Fase 0 — Audit & baseline (selesai)
- Audit source code, Supabase tables, migrations, RLS policies, advisor, Auth users, dan row counts.
- Catat baseline BOQ, sections, audit logs, dan data operasional.
- Tidak melakukan destructive change.

### Fase 1 — Identity dan Personal Workspace foundation (diterapkan)
- Auto-provision satu Personal Workspace per User Identity.
- Hubungkan profile ke Personal Workspace.
- Tambahkan model Company, Company Workspace, dan Company Membership.
- Batasi read access dengan RLS.
- Company/workspace/membership creation tetap server-controlled.

### Fase 2 — UI konteks dan personal domain (berikutnya)
- Muat Personal Workspace dan membership list dari database.
- Tambahkan context selector yang hanya menampilkan konteks yang benar-benar dimiliki/diikuti user.
- Bangun project domain personal baru dengan `workspace_id` wajib dan RLS owner-only.
- Jangan gunakan tabel BOQ/progress/cash legacy sebagai data personal tanpa model project dan ownership yang disepakati.
- Uji signup email dan Google pada user uji, termasuk email confirmation, duplicate login, trigger retry, and profile linkage.

### Fase 3 — Company onboarding dan membership
- Tambahkan company verification workflow dan NPWP handling yang aman (identifier/hash/encrypted value sesuai keputusan security; jangan simpan NPWP plaintext tanpa kebijakan).
- Implementasikan RFIN-A terpisah untuk aktivasi satu Company Super Admin.
- Implementasikan RFIN-B terpisah untuk invitation Company Membership.
- Tambahkan server-side redemption dengan token hash, expiry, atomic single-use redemption, revocation, rate limit, dan audit.
- Tambahkan persona/role/permission/authority/scope dan backend enforcement.
- Uji aturan satu Company Super Admin aktif per perusahaan.

### Fase 4 — Migrasi project-operational domain
- Business ownership sudah dikonfirmasi: tenant CV Menara Megah, project UDU, client PT IMK. Implementasikan model terpisah untuk Company/Tenant, Company Workspace, Project, client relationship, commercial item responsibility, dan Project Membership.
- Buat `projects` dan `project_memberships`; jangan menyamakan Company dengan Project.
- Tambahkan `workspace_id` atau `project_id` pada tabel operasional melalui nullable/additive columns.
- Backfill hanya setelah mapping proyek disetujui; untuk record ambigu, biarkan unassigned dan blok akses lintas tenant sampai direkonsiliasi.
- Buat compatibility views/RPC agar UI lama tetap berjalan selama cutover.
- Migrasikan read/write per modul, validasi row counts/checksums/BOQ totals/audit trail, lalu enforce NOT NULL dan RLS tenant-aware secara bertahap.
- Offline queue harus membawa workspace/project context dan server memverifikasi keanggotaan saat sync.

### Fase 5 — Company Readiness dan Company Offer
- Tambahkan indikator Company Readiness sebagai analitik produk, bukan permission.
- Company Offer bersifat sukarela dan tidak membuat Company atau membership.
- Onboarding dan verifikasi tetap terpisah dari offer.
- Pertahankan Personal Workspace setelah pengguna bergabung dengan perusahaan.

### Fase 6 — Cutover dan hardening
- Uji matrix multi-user, multi-company, persona, revocation, direct API/RPC, public verification, offline replay, and cross-tenant negative tests.
- Jalankan security/performance advisors setelah setiap fase.
- Hanya setelah semua test lulus, tutup akses legacy global policies dan aktifkan tenant-aware enforcement.
- Sediakan rollback plan dan observability sebelum produksi.

## 7. Kriteria penerimaan sebelum tenant cutover
- User tanpa membership hanya dapat membaca/menulis Personal Workspace miliknya.
- User perusahaan hanya dapat membaca data company/project scope yang diotorisasi.
- Tidak ada cross-company leakage melalui tabel, view, RPC, storage, search, exports, or offline queue.
- Company Offer dan Company Readiness tidak memberi akses.
- RFIN-A tidak dapat dipakai sebagai RFIN-B dan sebaliknya.
- Hanya satu Company Super Admin aktif per company.
- Data BOQ (280 items), sections (39), dan audit logs (1,107) tetap utuh.
- Ledger, cash, document, progress, safety, and media flows tetap lulus regression tests.
- QR public verification tetap bekerja dengan aturan publik yang eksplisit.
- Backup/restore dan idempotent offline sync tetap lulus uji.

## 8. Batasan hasil fase ini

Sudah diterapkan:
- Database identity/workspace foundation.
- Auto-provision Personal Workspace untuk Auth users.
- Link profile ke Personal Workspace.
- Schema Company Workspace dan Company Membership dengan RLS baca minimum.
- Frontend mengenali ID Personal Workspace pada profile.

Belum diterapkan:
- Workspace switcher interaktif.
- Personal project CRUD/dashboard.
- Company registration/verification.
- RFIN-A/RFIN-B engine.
- Persona/role/permission/authority engine.
- Company Readiness scoring dan Company Offer UI.
- Project/workspace scoping pada BOQ, inventory, cash, documents, progress, K3, media, dan personnel.
- Full tenant isolation untuk tabel operasional legacy.

Dokumen ini mencatat keadaan implementasi yang terverifikasi dan rencana cutover; jangan menganggap fitur yang tercantum sebagai belum diterapkan telah tersedia.
