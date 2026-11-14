# P0 Remediation Plan — Tenant Isolation, Active Context, QR/TTE & Platform Owner

- **Project:** UDU / Proyek Cair
- **Status:** Remediation design; belum merupakan persetujuan eksekusi migrasi produksi
- **Tanggal:** 2026-11-14
- **Baseline SSOT:** [USERS_SSOT.md v3.1](./USERS_SSOT.md)
- **Tujuan:** Menutup risiko keamanan P0 sebelum tenant cutover dan sebelum perubahan database produksi.

> **Batas dokumen.** Dokumen ini adalah rencana teknis dan matriks pengujian. Pembuatan dokumen ini tidak menjalankan perubahan pada aplikasi, Supabase, storage, maupun deployment. Temuan audit adalah snapshot dan wajib diverifikasi ulang terhadap branch, migration, schema, policy, function grants, dan data terkini tepat sebelum implementasi.

## 1. Executive summary

Prioritas P0 yang harus diselesaikan:

1. **QR/TTE dan dokumen privat:** hentikan akses anonim ke dokumen, metadata sensitif, tanda tangan, dan file privat. Desain lama pada implementation plan yang mengusulkan halaman verifikasi publik tidak boleh mengesampingkan SSOT v3.1. Verifikasi harus permission-bound dan tenant/scope-aware.
2. **Active Context Resolver (ACR):** jangan memperlakukan pilihan workspace di localStorage sebagai bukti otorisasi. Backend harus menyelesaikan dan memvalidasi identitas, membership, workspace, project scope, permission, serta statusnya pada setiap operasi.
3. **Tenant/project isolation:** ganti kebijakan RLS permisif dengan kebijakan berdasarkan membership, project scope, dan permission; cegah akses lintas tenant melalui REST, RPC, dan Storage.
4. **Platform Owner:** kewenangan platform harus bersumber dari registrasi platform-admin yang stabil dan dapat diaudit, bukan semata-mata `profiles.role = 'admin'` atau alamat email.
5. **SECURITY DEFINER dan offline sync:** audit hak EXECUTE dan validasi konteks di server; setiap item antrean offline harus divalidasi ulang saat sinkronisasi.

SSOT v3.1 adalah sumber kebenaran untuk identity, company/tenant, membership, persona, role, permission, authority, dan project scope. Rencana implementasi lama menjelaskan kebutuhan operasional proyek (BOQ, inventory, progress, cash, safety, dokumen, dan offline cache), tetapi keputusan lama mengenai verifikasi QR publik bertentangan dengan aturan keamanan dokumen privat pada SSOT dan karenanya tidak digunakan.

## 2. Prinsip arsitektur wajib

- RLS adalah batas keamanan data di database; UI hiding dan localStorage bukan kontrol akses.
- Setiap record operasional harus dapat ditautkan ke tenant/workspace dan project scope yang benar. Untuk proyek UDU, tenant pemilik adalah CV Menara Megah; PT IMK adalah client dan bukan tenant. Proyek Cair adalah nama platform.
- Server selalu memvalidasi ulang akses; jangan mempercayai `workspace_id`, `project_id`, role, persona, atau permission yang dikirim client tanpa pemeriksaan.
- Project Membership/Scope adalah batas keamanan tersendiri dan tidak boleh disimpulkan hanya dari Company Membership.
- Personal Workspace tidak otomatis memberi Company Membership.
- Company Workspace dimiliki satu tenant; Company Super Admin tenant mengatur hak view/read, CRUD, workflow/review/approval, TTE/QR signing, dan QR scan/verification per anggota, modul, dokumen, dan project scope.
- Dalam konteks UDU: CV Menara Megah adalah tenant; UDU adalah project; PT IMK adalah client. Atribut item tanggungan/pasokan IMK tidak mengubah tenant scope.
- Platform Owner tidak otomatis menjadi anggota tenant dan tidak boleh memperoleh akses data tenant hanya karena status platform.
- Hindari backfill atau pemetaan otomatis atas data historis tanpa bukti kepemilikan yang dapat diverifikasi.
- Untuk Supabase, jangan mengandalkan session variable PostgreSQL yang diasumsikan menetap lintas request. Kirim scope pada setiap RPC dan validasi terhadap auth.uid() serta data membership; RLS tetap memeriksa setiap row.
- Kebijakan RLS permissive yang saling tumpang tindih digabung dengan logika OR. Menambahkan policy yang lebih ketat tanpa menghapus policy permisif lama tidak menutup akses.
- Semua perubahan harus dapat diaudit, diuji, dan memiliki rencana rollback yang tidak mengembalikan akses global yang tidak aman.

## 3. P0-A — QR, dokumen privat, tanda tangan, dan file

### 3.1 Target keamanan

- Tidak ada akses anonim ke dokumen privat, file dokumen, detail penandatangan, payload tanda tangan, atau data tenant.
- Token verifikasi bukan bearer credential untuk membaca dokumen.
- QR hanya menjadi locator/identifier verifikasi; akses ke hasil verifikasi tetap memerlukan autentikasi dan permission yang sesuai.
- Verifikasi integritas membandingkan hash konten aktual dari versi dokumen yang tersimpan dengan hash yang dicatat saat penerbitan/penandatanganan.
- Status revoked, superseded, cancelled, expired, atau invalid harus dihormati oleh semua jalur baca.
- Permission untuk melihat dokumen, mengunduh dokumen, menerbitkan tanda tangan, mencabut dokumen, dan memverifikasi tanda tangan harus dibedakan.

### 3.2 Area skema dan perubahan yang direncanakan

| Objek | Tindakan rencana | Kontrol yang wajib |
|---|---|---|
| `documents` | Pastikan relasi tenant/workspace dan project scope tersedia; backfill hanya setelah ownership mapping disetujui | SELECT/INSERT/UPDATE/DELETE berdasarkan membership, project scope, permission, dan lifecycle |
| `document_signatures` | Pastikan relasi ke dokumen, tenant/scope konsisten, identitas signer immutable | Hanya signer/approver aktif yang berwenang; signature record tidak dapat diubah bebas setelah final |
| `public_document_verification` (jika masih ada) | Audit view dan hentikan eksposur anonim; hapus atau batasi sesuai desain akhir | Tidak boleh menjadi jalur bypass RLS atau mengeluarkan detail privat |
| `storage.objects` | Pertahankan bucket privat; revisi policy baca/tulis | Periksa bucket, path, object-to-document relation, tenant, project, permission |
| `audit_logs` | Catat issue, sign, verify, revoke, download, denied access | Actor, tenant, project, target, action, timestamp, outcome, correlation/request ID; redaksi token/secret |

**Catatan audit awal yang harus diverifikasi ulang:** ditemukan route `/verify` dan komponen `PublicDocumentVerify` di luar `AuthGate`; view `public_document_verification` menggunakan `security_invoker=true` dan policy publik yang dibatasi pada status tertentu; ada `verification_token` dan `content_sha256`, tetapi belum ditemukan bukti pemeriksaan ulang hash PDF aktual. Keberadaan dan perilaku semua objek ini wajib dicek ulang sebelum migrasi.

### 3.3 RPC konseptual

Nama berikut adalah kontrak desain, bukan klaim bahwa function sudah ada:

- `resolve_document_access(p_document_id, p_action)`: validasi identitas, tenant, project scope, membership, permission, dan lifecycle.
- `get_document_for_verification(p_document_id)`: mengembalikan hasil verifikasi minimum setelah otorisasi; tidak mengeluarkan dokumen atau metadata privat kepada anonymous.
- `issue_document_verification(p_document_id)`: menerbitkan identitas verifikasi yang aman setelah dokumen final.
- `revoke_document(p_document_id, p_reason)`: mencabut dokumen melalui permission yang sesuai dan membuat audit event.
- `verify_document_integrity(p_document_id, p_version_id)`: menghitung/memeriksa hash terhadap byte konten versi yang benar dan status tanda tangan.

Semua RPC harus memvalidasi `auth.uid()`, scope dan permission di server, memakai schema-qualified object names, `search_path` yang aman untuk SECURITY DEFINER, serta EXECUTE grants minimum.

### 3.4 Test cases QR/document

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| QR-P01 | Anonymous membuka URL QR dokumen privat | Ditolak; tidak ada metadata privat |
| QR-P02 | User tenant A membaca dokumen tenant B | Ditolak |
| QR-P03 | Member tenant yang tidak punya project scope membaca dokumen proyek | Ditolak |
| QR-P04 | Member dengan `document.read` pada scope yang benar | Berhasil hanya untuk dokumen dalam scope |
| QR-P05 | User mencoba download object Storage tenant lain | Ditolak |
| QR-P06 | User tanpa permission mencoba issue/sign/revoke | Ditolak dan tercatat |
| QR-P07 | Dokumen revoked/superseded/cancelled | Hasil verifikasi menunjukkan status non-valid; tidak dapat dianggap valid |
| QR-P08 | Byte PDF berubah setelah hash dicatat | Integrity verification gagal |
| QR-P09 | Token salah, ditebak, kedaluwarsa, atau dicabut | Ditolak tanpa membocorkan keberadaan dokumen lain |
| QR-P10 | User berwenang memverifikasi dokumen dalam scope | Hasil minimum yang diizinkan dikembalikan dan diaudit |

## 4. P0-B — Active Context Resolver (ACR)

### 4.1 Kontrak resolver

Resolver harus membentuk konteks efektif dari data otoritatif, bukan dari state frontend:

1. Identitas berasal dari `auth.uid()`.
2. Workspace harus dimiliki atau dapat diakses melalui hubungan yang sah.
3. Company Membership harus aktif untuk konteks perusahaan.
4. Project Membership/Scope harus aktif untuk project yang diminta.
5. Persona, role, permission, authority, kondisi, dan resource scope harus sesuai SSOT v3.1.
6. Status membership, assignment, invitation, dan tenant harus dicek ulang saat request.
7. Context switch dicatat; perubahan state client tidak otomatis memberi hak.
8. Jika membership dicabut atau berubah, konteks lama harus gagal pada request berikutnya.

### 4.2 RPC konseptual

- `resolve_active_context(p_workspace_id, p_company_id, p_project_id, p_persona_id)`: validasi seluruh relasi dan mengembalikan context snapshot minimum.
- `get_effective_permissions(p_context_id, p_resource_scope)`: menghitung permission efektif dari membership, persona, role, authority, dan scope.
- `assert_workspace_access(p_workspace_id, p_action)`: validasi akses workspace.
- `assert_project_access(p_project_id, p_action)`: validasi project membership/scope dan permission.
- `record_context_switch(p_previous_context, p_new_context)`: audit pergantian konteks.
- `get_context_version()`: membantu client mendeteksi perubahan membership/policy; bukan pengganti validasi server.

RPC yang mengembalikan context tidak boleh menjadi tiket akses permanen. Setiap operasi mutasi/baca sensitif tetap melakukan pemeriksaan scope dan RLS.

### 4.3 Perubahan aplikasi

- `WorkspaceCenter.tsx`: localStorage `udu_active_workspace` hanya menyimpan preferensi UI; jangan dipakai sebagai authorization state.
- `AppContext.tsx`: hentikan query global ke tabel operasional tanpa filter scope; data harus dimuat setelah context terverifikasi.
- Supabase client/data service: semua operasi membawa identitas resource/scope yang diperlukan; server memvalidasi ulang.
- Offline queue: simpan actor/resource/scope/version dan idempotency key; saat sync, periksa kembali membership, permission, lifecycle, dan konflik. Jangan replay mutasi hanya karena dibuat ketika user pernah memiliki akses.
- Context stale: jika resolver gagal atau versi konteks berubah, hentikan operasi dan minta refresh context.

**Catatan audit awal yang harus diverifikasi ulang:** ditemukan penggunaan localStorage `udu_active_workspace`, tabel `workspace_context_audit`, dan query langsung dari `AppContext.tsx` ke sejumlah tabel operasional. Ini merupakan indikasi bahwa pemilihan workspace di client belum cukup untuk menjamin authorization; bukan bukti bahwa seluruh jalur aplikasi sudah diperiksa.

### 4.4 Test cases ACR

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| ACR-P01 | User memilih workspace milik/yang sah diakses | Context tervalidasi dan tercatat |
| ACR-P02 | User mengirim workspace ID milik user lain | Ditolak |
| ACR-P03 | Membership nonaktif/revoked | Resolver menolak |
| ACR-P04 | Company member tanpa project membership | Akses project ditolak |
| ACR-P05 | Project member dengan permission baca | Hanya operasi baca sesuai scope yang berhasil |
| ACR-P06 | User mengganti localStorage secara manual | Tidak mengubah hak akses server |
| ACR-P07 | Request memakai context lama setelah membership dicabut | Ditolak pada request berikutnya |
| ACR-P08 | Persona/role tidak memiliki permission yang diminta | Ditolak |
| ACR-P09 | Offline mutation disinkronkan setelah akses dicabut | Ditolak/masuk conflict queue; tidak diterapkan |
| ACR-P10 | Context switch valid | Audit mencatat actor, konteks lama/baru, waktu, outcome |

## 5. P0-C — Tenant/project isolation: matriks tabel

### 5.1 Aturan umum skema

- Setiap tabel operasional harus memiliki jalur relasi yang tidak ambigu ke tenant/workspace dan project scope yang relevan.
- Jika tabel anak memiliki `project_id`, validasi bahwa project tersebut berada di tenant/workspace yang sama dengan parent.
- Jangan menambah `NOT NULL` atau mengisi tenant/project ID historis sebelum ownership mapping diverifikasi.
- Gunakan foreign key dan constraint untuk menjaga konsistensi relasi tenant-parent-project.
- `created_by`/actor tidak menggantikan tenant scope.
- Tabel global platform (misalnya `platform_admins`) tidak boleh dipaksa menjadi data tenant; aksesnya melalui kontrol platform khusus.

### 5.2 Matriks objek

| Tabel/objek | Scope yang wajib dipastikan | Permission contoh (nama konseptual) |
|---|---|---|
| `boq_items` | tenant/workspace + project | `boq.read`, `boq.update` |
| `boq_sections` | tenant/workspace + project/BOQ parent | `boq.read`, `boq.manage` |
| `boq_additions` | tenant/workspace + project + BOQ parent | `boq.addition.create`, `boq.approve` |
| `item_schedules` | tenant/workspace + project + BOQ item | `schedule.read`, `schedule.update` |
| `inventory_locations` | tenant/workspace + project | `inventory.read`, `inventory.manage` |
| `inventory_transactions` | tenant/workspace + project + item/location | `inventory.transaction.create`, `inventory.read` |
| `inventory_transaction_reversals` | scope sama dengan transaksi asal | `inventory.reverse` |
| `cash_transactions` | tenant/workspace + project | `cash.read`, `cash.transaction.create` |
| `progress_logs` | tenant/workspace + project | `progress.read`, `progress.create` |
| `project_control` | tenant/workspace + project | `project.control.read`, `project.control.update` |
| `project_media` | tenant/workspace + project + resource parent | `media.read`, `media.upload` |
| `safety_reports` | tenant/workspace + project | `safety.read`, `safety.report.create` |
| `documents` | tenant/workspace + project + owner/resource scope | `document.read`, `document.issue` |
| `document_signatures` | scope dokumen + signer identity | `document.sign`, `document.signature.read` |
| `transaction_attachments` | scope transaksi parent | permission parent + `attachment.read` |
| `project_personnel` | tenant/workspace + project + user identity | `project.members.read`, `project.members.manage` |
| `audit_logs` | tenant/workspace/project bila event tenant; platform event terpisah | `audit.read` |
| `profiles` | identity-owned; tidak menjadi sumber membership tenant | `profile.self.read/update` |
| `companies` | company/tenant identity | `company.read/manage` |
| `company_memberships` | company + user identity + lifecycle | `membership.read/manage` |
| `workspaces` | owner atau membership workspace | `workspace.read/manage` |
| `platform_admins` | platform scope, bukan tenant scope | `platform.admin.manage` |

Nama permission di atas hanya contoh kontrak untuk perancangan dan harus diselaraskan dengan permission catalog SSOT sebelum implementasi.

### 5.3 Policy RLS

Pola konseptual (bukan SQL siap produksi):

```sql
-- Contoh pola; helper, relasi, dan nama permission harus diverifikasi
USING (
  private.has_project_permission(project_id, 'boq.read')
)
WITH CHECK (
  private.has_project_permission(project_id, 'boq.update')
);
```

Untuk setiap tabel:
- SELECT memakai permission baca yang sesuai.
- INSERT memakai `WITH CHECK` untuk memastikan tenant/project row baru berada dalam scope caller.
- UPDATE memakai `USING` untuk row lama dan `WITH CHECK` untuk row baru.
- DELETE dibatasi pada permission khusus; hindari mengandalkan permission update.
- Tabel anak memvalidasi scope parent agar attacker tidak dapat memasangkan foreign key lintas tenant.
- Aktifkan RLS dan uji grants serta policy gabungan; RLS saja tidak menggantikan hak SQL GRANT/REVOKE.

### 5.4 Policy permisif yang harus diaudit dan diganti

Snapshot audit sebelumnya melaporkan policy luas dengan `USING (true)` pada:

- `boq_items`
- `inventory_transactions`
- `documents`
- `progress_logs`
- `safety_reports`
- `project_media`
- `project_personnel`
- `transaction_attachments`
- `boq_additions`
- `boq_sections`
- `project_control`
- `inventory_locations`
- `inventory_transaction_reversals`
- `document_signatures`

Semua nama policy dan command (SELECT/INSERT/UPDATE/DELETE) harus diambil ulang dari katalog database sebelum perubahan. Jangan hanya menambahkan policy baru; identifikasi dan hapus/restrict policy permisif lama setelah policy pengganti diuji.

### 5.5 Storage

- Bucket bukti proyek harus tetap private.
- Path yang disarankan: `{workspace_id}/{project_id}/{resource_type}/{resource_id}/{filename}`.
- Path bukan bukti otorisasi; policy harus memeriksa relasi object ke resource di database dan permission user.
- SELECT, INSERT, UPDATE, DELETE harus dibatasi secara terpisah.
- Audit awal sebelumnya mencatat policy read authenticated yang luas pada bucket `project-evidence`; verifikasi ulang dan ganti dengan pemeriksaan tenant/project/resource.
- Uji akses melalui signed URL, direct object URL, list bucket, overwrite, dan delete.

### 5.6 Test cases tenant isolation

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| TEN-P01 | User tenant A SELECT data tenant A dalam scope | Berhasil sesuai permission |
| TEN-P02 | User tenant A SELECT data tenant B via REST | 0 row/ditolak |
| TEN-P03 | User tenant A INSERT row dengan tenant/project B | Ditolak oleh WITH CHECK |
| TEN-P04 | User mengubah FK parent menjadi resource tenant lain | Ditolak |
| TEN-P05 | User project A membaca project B pada tenant sama | Ditolak jika tidak punya scope B |
| TEN-P06 | User tanpa permission mencoba UPDATE/DELETE | Ditolak |
| TEN-P07 | Anonymous membaca tabel operasional | Ditolak |
| TEN-P08 | Authenticated user mencoba akses Storage tenant lain | Ditolak |
| TEN-P09 | User membuat object dengan path palsu namun metadata scope lain | Ditolak |
| TEN-P10 | Query join/view/RPC melintasi tenant | Tidak membocorkan row lintas tenant |
| TEN-P11 | Policy permissive lama masih ada | Test harus gagal; release diblokir |
| TEN-P12 | User mengakses data personal workspace sendiri | Berhasil hanya dalam workspace personal dan permission yang sesuai |

## 6. P0-D — SECURITY DEFINER dan RPC surface

Snapshot audit sebelumnya melaporkan function berikut dapat dieksekusi oleh role authenticated:

- `create_boq_addition`
- `current_user_role`
- `record_cash_mutation`
- `record_inventory_mutation`
- `record_inventory_mutation_v2`
- `reverse_inventory_transaction`

Daftar ini harus diverifikasi ulang terhadap `pg_proc`, function owner, `prosecdef`, search_path, schema, dan EXECUTE grants.

Persyaratan setiap SECURITY DEFINER:
1. Tetapkan `search_path` aman (idealnya kosong dan seluruh objek di-schema-qualify).
2. Validasi `auth.uid()` dan jangan menerima actor ID dari client sebagai sumber kebenaran.
3. Validasi tenant, project, membership, permission, parent resource, dan lifecycle.
4. Tolak parameter scope yang tidak konsisten dengan resource.
5. Gunakan transaksi atomik untuk mutasi berpasangan/ledger dan idempotency key bila retry mungkin terjadi.
6. Batasi EXECUTE ke role minimum; revoke dari PUBLIC/anon bila tidak diperlukan.
7. Tulis audit event yang tidak dapat dimanipulasi caller.
8. Uji error path, concurrency, replay, dan privilege escalation.

## 7. P0-E — Platform Owner

### Target

- Identitas Platform Owner terikat ke stable `auth.users.id`, bukan email sebagai identifier permanen.
- Status platform admin disimpan pada sumber otoritatif platform (misalnya `platform_admins`) dengan lifecycle, actor pemberi, alasan, waktu, dan audit.
- `profiles.role = 'admin'` tidak boleh sendirian memberi kewenangan Platform Super Admin.
- Platform admin tidak otomatis memperoleh membership atau akses data operasional tenant.
- Bootstrap dan recovery harus eksplisit, terbatas, dan dapat diaudit; tidak boleh ada jalur bootstrap publik atau berdasarkan email yang dapat diklaim.

### RPC konseptual

- `is_platform_super_admin(p_user_id)`
- `grant_platform_admin(p_user_id, p_role, p_reason)`
- `revoke_platform_admin(p_user_id, p_reason)`
- `audit_platform_admin_change(...)`

### Test cases Platform Owner

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| PO-P01 | Stable auth user yang terdaftar sebagai platform super admin | Hak platform sesuai role aktif |
| PO-P02 | User hanya memiliki `profiles.role='admin'` | Tidak mendapat hak Platform Super Admin |
| PO-P03 | Email sama/berubah tanpa stable user ID yang terotorisasi | Tidak memberi hak platform |
| PO-P04 | Tenant admin mencoba grant platform admin | Ditolak |
| PO-P05 | Platform admin dicabut | Akses platform ditolak pada request berikutnya |
| PO-P06 | Platform admin mengakses data tenant tanpa membership/scope | Ditolak |
| PO-P07 | Grant/revoke platform admin | Actor, target, reason, timestamp tercatat |
| PO-P08 | Bootstrap/recovery dijalankan ulang atau oleh caller tidak sah | Idempotent dan ditolak jika tidak memenuhi prosedur |

## 8. Test strategy dan data fixture

Gunakan fixture sintetis di staging, bukan data produksi:

- Tenant A dan Tenant B.
- User A: aktif di tenant A dan project A1.
- User B: aktif di tenant B dan project B1.
- User A-no-project: anggota tenant A tanpa project membership.
- User revoked: membership pernah aktif lalu dicabut.
- User personal: hanya memiliki Personal Workspace.
- Platform Super Admin: terdaftar secara eksplisit pada platform registry.
- Resource fixtures untuk BOQ, inventory, cash, progress, safety, media, document, signature, dan attachment pada masing-masing project.

Lapisan pengujian:
1. Unit test helper permission dan resolver.
2. Integration test RPC menggunakan JWT user yang berbeda.
3. RLS test melalui Supabase REST/PostgREST, bukan hanya SQL owner connection.
4. Storage API test untuk list/read/upload/update/delete.
5. Browser test route terautentikasi dan anonymous.
6. Offline queue test untuk stale membership, retry, duplicate idempotency key, dan konflik.
7. Regression test seluruh alur bisnis proyek yang sudah ada.

**Kriteria lulus:** seluruh negative tests gagal tertutup (deny by default), positive tests hanya berhasil dalam scope yang tepat, dan tidak ada policy/grant alternatif yang membuka kembali akses.

## 9. Urutan implementasi dan gerbang persetujuan

| Tahap | Pekerjaan | Gerbang sebelum lanjut |
|---|---|---|
| 0 | Snapshot backup, schema/policy/function/grant inventory, baseline test | Backup teruji dan audit snapshot disetujui |
| 1 | Project/tenant ownership mapping untuk seluruh row historis | Setiap row memiliki bukti mapping atau masuk quarantine |
| 2 | Schema gap specification dan desain constraint/FK | Review arsitektur dan persetujuan data owner |
| 3 | Bangun helper permission dan Active Context Resolver di staging | Unit/integration tests ACR lulus |
| 4 | Tambah kolom/relasi dan backfill terkontrol | Rekonsiliasi jumlah row dan ownership disetujui |
| 5 | Terapkan RLS per tabel; hapus policy permissive lama | Semua TEN negative tests lulus |
| 6 | Kunci RPC/SECURITY DEFINER dan Storage policies | RPC/storage negative tests lulus |
| 7 | Tutup jalur QR anonim; implementasikan verifikasi privat dan integrity check | Semua QR negative tests lulus |
| 8 | Standarkan Platform Owner registry/bootstrap/recovery | Semua PO tests lulus |
| 9 | End-to-end regression, load/concurrency, observability, rollback rehearsal | Security sign-off dan release approval tertulis |

Tidak ada tahap di atas yang boleh langsung dijalankan di produksi hanya berdasarkan dokumen ini.

## 10. Backup, observability, dan rollback

Sebelum setiap migration:
- backup database dan verifikasi restore ke environment terpisah;
- ekspor definisi policy, grants, views, functions, triggers, dan storage policies;
- simpan row counts dan checksum/rekonsiliasi data;
- catat migration version dan deployment commit yang cocok.

Observability minimum:
- log denied access dengan actor/resource/scope/outcome tanpa membocorkan token atau data sensitif;
- alert untuk lonjakan cross-tenant denied attempts, RPC failures, dan sync conflicts;
- audit perubahan membership, project scope, permission, Platform Owner, signature, dan document lifecycle.

Rollback:
- rollback harus memulihkan konsistensi aplikasi dan data tanpa mengaktifkan kembali `USING (true)`, anonymous access, atau global storage read.
- Jika versi aplikasi lama tidak kompatibel dengan RLS baru, gunakan maintenance/feature flag atau rollback aplikasi yang tetap mempertahankan policy aman.
- Jangan menghapus kolom scope atau memundurkan backfill tanpa rekonsiliasi dan persetujuan data owner.

## 11. Acceptance criteria P0

P0 baru dapat dinyatakan selesai bila seluruh kondisi berikut terpenuhi:

- [ ] Anonymous tidak dapat membaca dokumen privat, signature, metadata sensitif, atau storage object.
- [ ] QR verification tidak menjadi bypass authorization dan integrity check memeriksa konten aktual.
- [ ] Semua operasi data tenant/project memakai context dan permission yang tervalidasi server.
- [ ] Tidak ada policy permisif luas yang membuka data operasional.
- [ ] Cross-tenant dan cross-project REST/RPC/Storage tests lulus.
- [ ] SECURITY DEFINER dan EXECUTE grants telah diinventarisasi serta dikunci.
- [ ] Platform Owner berbasis stable user ID dan lifecycle yang diaudit.
- [ ] Offline queue memvalidasi ulang akses saat sync.
- [ ] Legacy data telah dipetakan atau dikarantina; tidak ada asumsi ownership.
- [ ] Backup restore dan rollback rehearsal berhasil.
- [ ] Security review dan persetujuan release terdokumentasi.

## 12. Pertanyaan yang wajib diputuskan sebelum migration SQL

1. Apakah model Project dan Project Membership yang ada sekarang dapat dipertahankan, atau perlu diselaraskan dengan model SSOT? Jawab berdasarkan inspeksi schema dan data aktual.
2. Bagaimana bukti ownership untuk setiap row BOQ historis? Jangan mengasumsikan semua 280 row berada pada satu project tanpa verifikasi.
3. Bagaimana pemetaan historis untuk inventory, cash, progress, safety, media, documents, dan attachments?
4. Apakah ada keputusan SSOT baru yang secara eksplisit mengubah verifikasi QR privat menjadi publik? Sampai ada perubahan yang disetujui, ikuti SSOT v3.1.
5. Siapa approver independen untuk recovery/grant Platform Owner dan bagaimana prosedur break-glass diaudit?
6. Apa permission catalog final untuk setiap operasi dan resource scope, diselaraskan dengan SSOT v3.1?

## 13. Catatan baseline audit sebelumnya (wajib revalidate)

Audit read-only sebelumnya melaporkan snapshot berikut. Angka/nama ini bukan jaminan keadaan database saat ini dan harus diambil ulang sebelum tindakan:

- 3 `auth.users`, 3 `profiles`, 3 `workspaces`, 0 `companies`, 0 `company_memberships`.
- 280 `boq_items`, 1.107 `audit_logs`, 0 `documents`.
- Platform admin record teridentifikasi pada `platform_admins` sebagai `PLATFORM_SUPER_ADMIN`, dengan profil admin terkait; validitas dan prosedur bootstrap tetap perlu ditinjau.
- Leaked password protection dilaporkan nonaktif; 27 foreign key missing covering indexes; 5 RLS initplan warnings.
- Daftar broad policies dan SECURITY DEFINER functions ada di bagian terkait di atas.
- Bucket `project-evidence` dilaporkan private, tetapi policy read authenticated terlalu luas.

Temuan tersebut berasal dari audit implementasi terdahulu dan tidak boleh diperlakukan sebagai hasil pemeriksaan live pada saat dokumen ini dibaca.

## 14. Hubungan dengan dokumen sumber

- [USERS_SSOT.md](./USERS_SSOT.md) — otoritas keputusan identity, tenant, membership, persona, role, permission, authority, project scope, workflow, dan audit.
- `implementation_plan.md` yang diberikan sebagai konteks produk — menjelaskan kebutuhan aplikasi kontrol proyek konstruksi (BOQ/logistik, progres/Kurva-S, kas, K3, dokumen QR, Supabase, offline cache, Vercel). Keputusan verifikasi QR publik dalam rencana tersebut tidak berlaku jika bertentangan dengan SSOT v3.1.
- Audit gap read-only terdahulu — sumber snapshot temuan implementasi yang wajib diverifikasi ulang sebelum migrasi.

---

**Keputusan akhir:** dokumen ini dapat dipakai sebagai baseline desain remediation P0 dan bahan review engineering/security. Dokumen ini bukan SQL migration, bukan bukti implementasi, dan bukan otorisasi untuk mengubah database produksi.

## 15. Pre-migration ownership mapping gate

Sebelum migration SQL pertama untuk tenant/project isolation, gunakan [Project Ownership Mapping & Schema Gap Specification](./PROJECT_OWNERSHIP_MAPPING_SCHEMA_GAP.md). Dokumen tersebut memetakan seluruh tabel legacy, parent-scope invariants, permission baseline SSOT, row-count snapshot, keputusan bisnis terbaru (tenant CV Menara Megah, project UDU, client PT IMK), schema gap, dan release gate. **Business ownership telah diputuskan; migration backfill tetap diblokir sampai Company Workspace diprovisioning, canonical project registry/ID dan mapping ledger disetujui.**
