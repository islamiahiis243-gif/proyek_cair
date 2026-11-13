# USERS_SSOT.md
# UDU / Proyek Cair — Identity, Persona, Membership & Authorization SSOT

- **Status:** Target architecture / Single Source of Truth (SSOT)
- **Versi:** 1.0
- **Tanggal:** 2026-11-13
- **Cakupan:** Identitas pengguna, perusahaan (tenant), keanggotaan, undangan, persona, role, permission, authority, project scope, dan audit.
- **Catatan implementasi:** Dokumen ini menetapkan rancangan dan aturan bisnis yang disepakati. Dokumen ini **bukan bukti bahwa seluruh skema atau alur sudah diterapkan** pada aplikasi atau database saat ini. Implementasi wajib diawali audit terhadap kode, Supabase Auth, skema database, RLS, dan alur aplikasi yang sudah ada.

## 1. Tujuan dan prinsip utama

UDU/Proyek Cair dirancang agar dapat berkembang dari aplikasi internal menjadi platform multi-perusahaan (multi-tenant) yang dapat digunakan banyak organisasi.

Prinsip utamanya:

> **One Identity, Multiple Companies, Multiple Personas, Context-Bound Permissions, Auditable Actions.**

Artinya:
1. Satu orang memiliki satu identitas autentikasi utama dan dapat login menggunakan Google atau email melalui penyedia autentikasi yang didukung.
2. Satu identitas dapat menjadi anggota beberapa perusahaan.
3. Dalam setiap perusahaan, satu identitas dapat memiliki satu atau beberapa persona.
4. Persona aktif menentukan konteks pekerjaan yang sedang dijalankan; persona tidak mengganti identitas asli.
5. Hak akses ditentukan oleh kombinasi role, permission, atribut/kondisi, hubungan keanggotaan, dan cakupan sumber daya.
6. Setiap tindakan penting dapat ditelusuri ke identitas asli, perusahaan, persona, proyek, dan konteks yang digunakan.
7. Tidak ada pendaftaran publik yang otomatis memberikan keanggotaan perusahaan atau hak istimewa.

## 2. Terminologi dan pemisahan konsep

Istilah berikut harus digunakan secara konsisten dalam kode, database, API, UI, dan dokumentasi.

| Istilah | Definisi |
|---|---|
| **User Identity** | Identitas orang yang telah diautentikasi, misalnya melalui Google atau email. Identitas ini tidak sama dengan jabatan atau role. |
| **Authentication** | Proses membuktikan siapa pengguna melalui penyedia autentikasi. |
| **Company / Tenant** | Organisasi yang terdaftar di platform dan menjadi batas isolasi data. |
| **Company Membership** | Hubungan antara satu User Identity dan satu Company, beserta status keanggotaannya. |
| **Persona** | Kapasitas/konteks kerja yang dipilih pengguna dalam suatu perusahaan atau cakupan tertentu, misalnya Finance atau Site Engineer. Persona adalah konteks penggunaan, bukan identitas login. |
| **Role** | Kumpulan izin yang dapat diberikan kepada persona atau keanggotaan. |
| **Permission** | Izin teknis yang spesifik terhadap tindakan/sumber daya, misalnya `cash.transaction.create`. |
| **Authority** | Batas kewenangan bisnis, misalnya limit persetujuan nominal, jenis persetujuan, atau tingkat otorisasi. |
| **Project Membership / Scope** | Hubungan pengguna dengan proyek tertentu yang membatasi data dan tindakan yang dapat diakses. |
| **Invitation** | Undangan yang dibuat oleh pihak berwenang agar identitas dapat bergabung ke perusahaan dan menerima persona/role tertentu. |
| **Platform Super Admin** | Pemilik/pengelola tertinggi platform UDU, dengan otoritas lintas tenant sesuai kebijakan platform. |
| **Company Super Admin** | Administrator tertinggi pada satu perusahaan, terbatas pada tenant perusahaannya sendiri. |
| **Audit Trail** | Catatan append-only atas aktivitas dan perubahan penting yang dapat ditelusuri. |

**Pembedaan wajib:** Persona bukan sinonim Role. Persona menggambarkan kapasitas/konteks yang dipilih; role mengelompokkan izin; permission adalah izin atomik; authority mengatur batas kewenangan bisnis.

## 3. Hierarki otoritas

### 3.1 Platform Super Admin (Platform Owner)

**Platform Owner yang ditetapkan:** `islamiahiis243@gmail.com`

Email di atas adalah identitas login Google/email yang ditetapkan sebagai pemilik utama platform. Saat bootstrap dan setiap autentikasi, sistem wajib mencocokkan identitas provider yang telah diverifikasi dengan alamat email tersebut sebelum memberikan otoritas Platform Super Admin. Alamat email ini adalah penetapan identitas pemilik, bukan password, secret, atau mekanisme autentikasi tersendiri. Perubahan pemilik utama harus melalui prosedur pemulihan/pengalihan kepemilikan platform yang eksplisit, terlindungi, dan tercatat dalam audit trail.

Platform Super Admin adalah pemilik dan otoritas tertinggi platform. Kewenangannya mencakup:
- mengelola konfigurasi dan kebijakan global platform;
- mengelola registrasi dan status perusahaan;
- menetapkan, mengelola, atau mencabut Company Super Admin sesuai prosedur;
- mengelola katalog persona, role, permission, dan kebijakan global;
- melihat audit platform sesuai kebijakan privasi dan operasional;
- melakukan tindakan pemulihan dan administrasi platform.

Aturan:
- Platform Super Admin tidak dapat diperoleh melalui pendaftaran publik, kode undangan perusahaan, atau promosi role oleh Company Super Admin.
- Otoritas Platform Super Admin harus diberikan melalui proses bootstrap/administrasi platform yang terlindungi dan diaudit.
- Platform Owner dapat memiliki persona operasional tambahan di satu atau beberapa perusahaan, termasuk perusahaan yang dikelolanya sendiri.
- Saat menggunakan persona operasional, identitas Platform Owner tetap dipertahankan dan tidak diturunkan atau diganti. Akses platform tingkat tinggi tetap tunduk pada aturan khusus platform; pemilihan persona operasional tidak boleh menjadi jalan untuk menyamarkan identitas atau menghindari audit.
- Sistem sebaiknya mendukung satu pemilik utama yang terlindungi. Administrator platform tambahan dapat ditunjuk dengan kewenangan yang eksplisit dan tidak otomatis setara dengan pemilik utama.

### 3.2 Company Super Admin

Setiap perusahaan dapat memiliki satu atau lebih Company Super Admin. Mereka dapat:
- mengundang pengguna ke perusahaannya;
- menentukan persona/role yang boleh diberikan berdasarkan katalog dan kebijakan platform;
- menetapkan cakupan proyek;
- menetapkan authority bisnis dalam batas yang diizinkan;
- mengubah atau mencabut keanggotaan dan persona pengguna;
- mengelola administrator perusahaan lain jika kebijakan perusahaan mengizinkan;
- melihat audit aktivitas dalam batas tenant perusahaannya.

Batasan:
- Company Super Admin hanya berwenang pada tenant perusahaannya.
- Tidak dapat membaca atau mengelola data tenant lain tanpa hubungan dan izin yang sah.
- Tidak dapat membuat atau menaikkan siapa pun menjadi Platform Super Admin.
- Tidak dapat memberikan permission atau authority di luar batas maksimum yang ditetapkan platform.
- Perubahan hak akses dan administrasi harus masuk audit trail.

### 3.3 Administrator dan pengguna perusahaan

Perusahaan dapat memiliki administrator dengan kewenangan lebih terbatas, misalnya pengelola keanggotaan, pengelola proyek, atau pengelola persona. Kewenangan tersebut harus dapat dikonfigurasi dan tidak disamakan otomatis dengan Company Super Admin.

## 4. Identitas perusahaan dan NPWP

- Setiap Company memiliki identitas internal yang stabil (misalnya UUID) sebagai primary key.
- NPWP merupakan identifier bisnis/legal perusahaan dan dapat digunakan untuk pencarian, registrasi, pencocokan, serta verifikasi perusahaan.
- NPWP **bukan password, secret, atau bukti autentikasi pengguna**.
- Login pengguna tetap menggunakan Google/email melalui authentication provider.
- NPWP harus dinormalisasi dan divalidasi sesuai aturan yang berlaku sebelum disimpan/digunakan sebagai identifier.
- Terapkan unique constraint pada nilai NPWP yang telah dinormalisasi, dengan penanganan yang tepat untuk perubahan format atau data registrasi.
- Simpan data perusahaan seperlunya, lindungi data sensitif, dan catat perubahan identitas legal.
- Status verifikasi perusahaan harus dibedakan dari status keanggotaan pengguna. Pengguna tidak otomatis menjadi anggota hanya karena mengetahui NPWP perusahaan.

## 5. Model multi-perusahaan dan multi-persona

Satu User Identity dapat memiliki Company Membership di beberapa perusahaan secara bersamaan.

Contoh konseptual:

| Identitas | Perusahaan | Persona |
|---|---|---|
| `budi@example.com` | PT A | Project Manager |
| `budi@example.com` | PT A | Procurement |
| `budi@example.com` | PT B | Site Engineer |
| `budi@example.com` | PT C | Finance |

Ketentuan:
- Pengguna login satu kali, lalu memilih perusahaan dan persona aktif dari daftar yang memang dimilikinya.
- Persona harus terikat ke membership dan, bila relevan, ke proyek atau scope tertentu.
- Persona PT A tidak memberi akses ke data PT B.
- Memiliki persona Finance di PT B tidak otomatis memberi akses Finance di PT A.
- Pengguna dapat memiliki beberapa persona dalam satu perusahaan bila diundang atau diberikan oleh administrator yang berwenang.
- Pengguna dapat berpindah perusahaan/persona melalui context switch yang tervalidasi di server.
- UI harus menampilkan perusahaan dan persona aktif dengan jelas agar pengguna tidak salah memasukkan data pada tenant/proyek yang keliru.
- Tidak boleh ada perpindahan konteks hanya dengan mengubah parameter client-side tanpa validasi server.

## 6. Onboarding dan invitation-only membership

### 6.1 Prinsip

Autentikasi berhasil tidak berarti pengguna otomatis memperoleh akses ke data perusahaan. Untuk menjadi anggota tenant, pengguna harus memiliki undangan yang sah atau melalui proses provisioning resmi yang setara.

### 6.2 Alur pengguna

1. Pengguna login menggunakan Google atau email.
2. Server mengenali atau membuat User Identity berdasarkan identitas provider yang tervalidasi.
3. Jika belum memiliki membership aktif, pengguna diarahkan ke halaman redeem invitation atau status menunggu undangan.
4. Pengguna memasukkan kode undangan.
5. Server memvalidasi kode, status, masa berlaku, batas penggunaan, perusahaan tujuan, dan ketentuan email/identitas penerima.
6. Jika valid, server membuat atau mengaktifkan Company Membership dan memberikan persona/role/scope sesuai undangan.
7. Sistem mencatat penerimaan undangan dan perubahan membership ke audit trail.
8. Pengguna memilih perusahaan dan persona aktif untuk memulai pekerjaan.

### 6.3 Aturan invitation

Invitation minimal memiliki:
- identifier internal;
- tenant/perusahaan tujuan;
- kode undangan dalam bentuk hash pada penyimpanan;
- pembuat undangan;
- persona/role yang diberikan;
- project scope bila relevan;
- authority yang diizinkan bila relevan;
- email penerima atau aturan penerima (binding);
- tanggal pembuatan dan kedaluwarsa;
- batas penggunaan;
- status (active, redeemed, revoked, expired);
- waktu dan identitas penerima saat redemption.

Keamanan:
- Kode harus memiliki entropi tinggi, tidak mudah ditebak, dan tidak disimpan sebagai plaintext.
- Kode tidak boleh menjadi kode umum yang dapat dipakai siapa saja tanpa batas.
- Undangan sebaiknya terikat ke email tujuan. Jika undangan tidak terikat email, redemption harus mengikuti kebijakan risiko yang eksplisit dan dicatat.
- Redemption harus atomik agar penggunaan bersamaan tidak melewati batas penggunaan.
- Undangan dapat dicabut dan harus langsung tidak berlaku setelah pencabutan tervalidasi.
- Undangan tidak boleh memberikan hak lebih tinggi daripada kewenangan pembuatnya.
- Invitation tidak dapat memberikan Platform Super Admin.
- Kode kedaluwarsa, sudah dipakai sesuai batas, atau dicabut harus ditolak.

### 6.4 Undangan untuk diri sendiri

Platform Owner atau Company Super Admin dapat memiliki persona operasional tambahan melalui mekanisme pemberian persona/undangan yang sah sesuai kewenangannya. Untuk mendukung kebutuhan pemilik yang juga bekerja sebagai operator/inputter:
- satu identitas dapat memiliki persona administrasi dan persona operasional sekaligus;
- sistem tidak boleh membuat identitas Google/email duplikat hanya untuk memisahkan pekerjaan;
- pemberian persona kepada diri sendiri harus eksplisit, tervalidasi, dan diaudit;
- otoritas tertinggi yang sudah dimiliki tidak boleh hilang ketika persona operasional dipilih;
- tindakan operasional tetap mencatat identitas asli dan persona aktif.

## 7. Model otorisasi: Hybrid RBAC + ABAC + ReBAC

UDU tidak menggunakan RBAC murni sebagai satu-satunya mekanisme. Model yang dituju adalah kombinasi:

### 7.1 RBAC — Role-Based Access Control

Role mengelompokkan permission berdasarkan fungsi. Contoh role awal (katalog dapat berkembang):
- Company Administrator;
- Project Manager;
- Construction Manager;
- Site Engineer;
- Data Inputter;
- Procurement;
- Finance;
- Storekeeper;
- HSE Officer;
- Document Controller;
- Viewer.

Contoh permission:
- `boq.read`
- `boq.update`
- `progress.create`
- `progress.approve`
- `inventory.read`
- `inventory.mutation.create`
- `cash.read`
- `cash.transaction.create`
- `cash.transaction.approve`
- `k3.report.create`
- `document.issue`
- `membership.invite`
- `membership.revoke`

Nama di atas merupakan contoh katalog awal, bukan daftar final permission yang sudah diterapkan.

### 7.2 ABAC — Attribute-Based Access Control

ABAC membatasi keputusan berdasarkan atribut/kondisi seperti:
- company/tenant ID;
- project ID;
- status membership;
- status proyek atau dokumen;
- nilai transaksi dan approval limit;
- status/verifikasi perusahaan;
- pemilik atau pembuat resource;
- waktu atau kondisi operasional jika benar-benar diperlukan.

Contoh: Finance dapat membuat transaksi hanya pada perusahaan dan proyek yang tercakup dalam membership/personanya, serta tidak dapat menyetujui transaksi di atas approval limit miliknya.

### 7.3 ReBAC — Relationship-Based Access Control

ReBAC mengevaluasi hubungan antarentitas, misalnya:
- user adalah anggota perusahaan;
- user ditugaskan ke proyek;
- user merupakan anggota tim proyek;
- user ditunjuk sebagai approver suatu dokumen/transaksi;
- perusahaan menjadi pemilik atau pihak terkait pada suatu resource.

Contoh: Site Engineer hanya dapat mengakses proyek tempat ia terdaftar sebagai anggota proyek, sekalipun role Site Engineer memiliki permission membaca progres.

### 7.4 ACL — pengecualian terkontrol

ACL dapat digunakan untuk kebutuhan khusus pada resource tertentu (misalnya dokumen rahasia yang dibagikan secara terbatas), tetapi bukan fondasi utama otorisasi. Setiap ACL harus memiliki owner, alasan, masa berlaku bila sesuai, dan audit trail.

### 7.5 Urutan keputusan akses

Setiap operasi yang dilindungi harus dievaluasi di server:
1. Identitas autentikasi valid dan tidak diblokir.
2. Membership tenant aktif.
3. Persona aktif benar-benar dimiliki oleh identitas tersebut dan masih aktif.
4. Role persona memiliki permission yang dibutuhkan.
5. Atribut dan kebijakan ABAC terpenuhi.
6. Hubungan ReBAC dan project/resource scope terpenuhi.
7. Authority/approval limit terpenuhi untuk tindakan yang memerlukan kewenangan bisnis.
8. Tidak ada larangan eksplisit atau status resource yang menolak tindakan.

Jika salah satu pemeriksaan wajib gagal, keputusan adalah **DENY** (default deny).

## 8. Persona, role, permission, dan authority

- Persona adalah konteks kerja yang terlihat dan dipilih pengguna.
- Satu persona dapat dipetakan ke satu atau lebih role.
- Role memiliki satu atau lebih permission.
- Permission harus spesifik pada resource dan tindakan, bukan sekadar label menu UI.
- Authority adalah aturan bisnis tambahan; jangan menyamakan permission `approve` dengan kewenangan menyetujui semua nilai transaksi.
- Authority dapat mencakup limit nominal, jenis transaksi, tahapan persetujuan, proyek, atau kategori dokumen.
- Persona/role bawaan adalah template. Company Super Admin dapat mengelola pemberian persona dalam batas katalog dan policy platform.
- Custom persona/role perusahaan dapat dipertimbangkan pada fase lanjutan, tetapi harus tetap tersusun dari permission yang diizinkan platform dan tidak dapat memperluas privilege secara diam-diam.

## 9. Status lifecycle

### 9.1 User Identity
Status identitas (misalnya active, disabled) mengatur apakah pengguna dapat melakukan autentikasi/akses platform. Status ini terpisah dari membership.

### 9.2 Company
Status perusahaan dapat mencakup pending verification, active, suspended, dan closed. Status tenant membatasi seluruh membership dan akses dalam tenant tersebut.

### 9.3 Membership
Status membership minimal:
- `INVITED` — undangan diterbitkan, belum diterima;
- `PENDING` — menunggu proses verifikasi/approval jika kebijakan mensyaratkan;
- `ACTIVE` — keanggotaan aktif;
- `SUSPENDED` — akses sementara ditangguhkan;
- `REVOKED` — keanggotaan dicabut;
- `EXPIRED` — masa keanggotaan berakhir jika diberlakukan.

Hanya membership `ACTIVE` yang dapat digunakan untuk akses tenant.

### 9.4 Persona assignment
Persona assignment harus memiliki status aktif/nonaktif, pemberi, waktu pemberian, dan scope. Pencabutan satu persona tidak harus mencabut seluruh membership jika pengguna masih memiliki persona lain yang sah.

## 10. Data model konseptual

Nama tabel di bawah adalah rekomendasi konseptual. Penamaan final harus diselaraskan dengan skema yang sudah ada setelah audit; jangan membuat tabel duplikat bila entitas setara sudah tersedia.

| Entitas/tabel konseptual | Fungsi dan relasi utama |
|---|---|
| `user_identities` | Profil internal yang terhubung ke ID user dari auth provider; satu identity dapat memiliki banyak membership. |
| `companies` | Registry tenant, termasuk identifier internal, nama legal, NPWP ternormalisasi, status, dan verifikasi. |
| `company_memberships` | Relasi identity-company, status, tanggal bergabung, dan metadata keanggotaan. |
| `personas` | Katalog persona/template kapasitas kerja. |
| `membership_personas` | Persona yang diberikan kepada membership tertentu, termasuk scope dan status. |
| `roles` | Katalog role. |
| `permissions` | Katalog izin teknis atomik. |
| `role_permissions` | Relasi role-permission. |
| `persona_roles` | Relasi persona-role. |
| `membership_role_overrides` (opsional) | Pengecualian role terkontrol jika benar-benar diperlukan dan diaudit. |
| `project_memberships` | Relasi membership/persona dengan proyek dan tanggung jawabnya. |
| `invitations` | Undangan tenant/persona/role/scope dengan hash kode, expiry, limit, dan status. |
| `authority_policies` | Limit dan kebijakan kewenangan/approval. |
| `resource_acl` (opsional) | Pengecualian akses per resource jika diperlukan. |
| `active_contexts` (opsional) | Sesi/konteks perusahaan dan persona aktif; harus divalidasi server dan tidak dipercaya hanya dari client. |
| `audit_logs` | Catatan append-only aktivitas keamanan dan administrasi. |

Gunakan foreign key, unique constraint, check constraint, dan indeks yang sesuai. Semua tabel tenant-scoped harus memiliki tenant/company key yang jelas atau dapat diturunkan melalui relasi yang tidak ambigu.

## 11. Isolasi tenant dan keamanan database

- Tenant isolation wajib ditegakkan di server/database, bukan hanya dengan menyembunyikan menu pada frontend.
- Setiap query/mutasi tenant-scoped harus dibatasi ke company ID yang telah divalidasi dari konteks autentikasi dan membership aktif.
- Terapkan Supabase Row Level Security (RLS) pada tabel yang terekspos ke client.
- RLS policy harus memeriksa identitas, membership, persona/permission, dan scope yang relevan; jangan mengandalkan nilai company ID yang dikirim client tanpa validasi.
- Operasi privileged menggunakan server-side function/RPC yang memvalidasi aktor dan konteks, dengan prinsip least privilege.
- Jangan menaruh service-role key atau secret authorization di browser.
- Semua mutasi penting harus memvalidasi ulang status membership dan kewenangan saat operasi dilakukan.
- Pencabutan akses harus efektif secepat mungkin; jangan mengandalkan role/permission lama yang tertanam permanen di JWT.
- JWT/auth token digunakan untuk autentikasi. Klaim konteks yang ada di token dapat membantu routing, tetapi bukan satu-satunya sumber kebenaran otorisasi.
- Cache keputusan akses harus memiliki strategi invalidasi ketika membership, persona, role, atau policy berubah.
- Security definer functions harus dibatasi, memiliki search_path yang aman, memvalidasi caller, dan hanya dapat dieksekusi oleh role yang tepat.

## 12. Audit trail

Audit log untuk aktivitas sensitif minimal mencatat:
- actor user identity;
- company/tenant;
- persona aktif;
- role/permission context bila relevan;
- project/resource scope;
- action dan target resource;
- hasil (success/denied/failure);
- timestamp;
- sumber permintaan/session/correlation ID bila tersedia;
- alasan perubahan untuk tindakan administrasi.

Peristiwa yang wajib diaudit antara lain:
- pembuatan, pengiriman, redemption, dan pencabutan invitation;
- penambahan/pencabutan membership;
- pemberian/perubahan/pencabutan persona dan role;
- perubahan permission dan authority policy;
- perubahan Company Super Admin;
- perubahan status/verifikasi perusahaan;
- pergantian persona/perusahaan jika relevan untuk jejak keamanan;
- tindakan privileged dan percobaan akses yang ditolak.

Audit log harus append-only bagi pengguna aplikasi biasa. Koreksi administratif harus dilakukan melalui event/koreksi baru, bukan menghapus jejak lama tanpa prosedur khusus.

## 13. UX dan perilaku aplikasi

- Setelah login, tampilkan perusahaan dan persona yang dapat dipilih pengguna.
- Jika hanya ada satu konteks aktif, aplikasi boleh memilihnya otomatis, tetapi tetap menampilkan konteks yang sedang digunakan.
- Jika belum ada membership, tampilkan onboarding undangan; jangan tampilkan data tenant.
- Selalu tampilkan indikator perusahaan/persona aktif pada area UI yang mudah terlihat.
- Context switch harus memuat ulang data dan permission untuk konteks baru serta membersihkan state tenant sebelumnya.
- Menu frontend boleh disesuaikan dengan permission untuk pengalaman pengguna, tetapi backend/database tetap menjadi penegak akses yang sebenarnya.
- Jika persona dicabut saat pengguna sedang aktif, operasi berikutnya harus ditolak setelah validasi ulang dan sesi/konteks perlu diperbarui.

## 14. Prinsip implementasi dan migrasi

Sebelum implementasi:
1. Audit skema database, Supabase Auth, profil pengguna, tabel role yang ada, RLS, RPC, dan seluruh pemeriksaan akses di frontend/backend.
2. Petakan struktur yang sudah ada ke konsep dalam dokumen ini.
3. Identifikasi konflik, duplikasi, dan jalur akses yang masih mengandalkan frontend.
4. Rancang migrasi bertahap yang mempertahankan data dan akses operasional yang sah.
5. Tentukan mekanisme bootstrap Platform Owner berdasarkan identitas yang telah diverifikasi; jangan menebak email atau ID.
6. Uji tenant isolation, privilege escalation, invitation redemption race, pencabutan akses, dan audit trail sebelum rilis.

Urutan fase yang disarankan:
- **Fase 1 — Identity & Membership:** identitas, registry perusahaan, membership, invite-only onboarding.
- **Fase 2 — Persona & Context:** persona assignment dan context switching.
- **Fase 3 — Authorization:** role-permission, ABAC constraints, project scope, server-side enforcement/RLS.
- **Fase 4 — Company Administration:** Company Super Admin, invitation management, authority policies.
- **Fase 5 — Advanced Governance:** custom roles/personas terbatas, ACL khusus, approval workflows, audit analytics.

Jangan mengubah atau menghapus kontrol keamanan database yang sudah ada hanya untuk menyesuaikan rancangan ini tanpa audit dampak dan alasan teknis. Setiap temuan keamanan lama harus ditangani sebagai pekerjaan terpisah dan terencana.

## 15. Kriteria penerimaan (acceptance criteria)

Rancangan dianggap terimplementasi dengan benar jika pengujian membuktikan bahwa:

1. Pengguna dapat login dengan provider yang didukung, tetapi tanpa membership aktif tidak dapat membaca atau mengubah data tenant.
2. Kode undangan valid hanya dapat digunakan sesuai penerima, expiry, status, dan batas penggunaan.
3. Satu identity dapat menjadi anggota lebih dari satu perusahaan tanpa membuat akun autentikasi duplikat.
4. Satu identity dapat memiliki beberapa persona dalam satu perusahaan.
5. Persona dan permission di satu perusahaan tidak memberikan akses ke perusahaan lain.
6. Context switching memvalidasi ulang membership, persona, project scope, dan permission di server.
7. Company Super Admin dapat mengelola pengguna hanya dalam tenant sendiri.
8. Company Super Admin tidak dapat memberikan Platform Super Admin atau melampaui batas policy platform.
9. Platform Owner dapat memiliki persona operasional tambahan tanpa kehilangan identitas maupun otoritas platform.
10. Pencabutan/suspensi membership atau persona membuat akses terkait ditolak pada permintaan berikutnya setelah validasi.
11. Approval limit dan authority policy ditegakkan pada backend, bukan hanya UI.
12. Semua tindakan administrasi dan mutasi sensitif memiliki audit trail yang dapat ditelusuri.
13. Uji negatif membuktikan pengguna tidak dapat mengakses tenant/resource lain dengan memanipulasi request, ID, JWT claim, atau state frontend.
14. RLS dan server-side authorization diuji pada jalur akses langsung maupun RPC.

## 16. Keputusan yang masih perlu dikonfirmasi

Dokumen ini menetapkan prinsip arsitektur, tetapi beberapa detail kebijakan operasional perlu diputuskan sebelum implementasi final:
- proses verifikasi legal perusahaan dan NPWP;
- apakah setiap undangan selalu wajib terikat email;
- apakah perusahaan dapat mengatur custom persona/role atau hanya memilih katalog platform;
- apakah Company Super Admin selalu lebih dari satu diperbolehkan (rekomendasi: ya);
- aturan pengganti/pemulihan Platform Owner jika akun utama tidak dapat diakses;
- struktur approval berjenjang dan limit nominal per jenis transaksi;
- masa berlaku membership dan kebijakan review akses berkala.

Keputusan detail tersebut tidak boleh mengubah prinsip dasar multi-tenant, multi-persona, least privilege, default deny, dan auditability.

---

## Ringkasan normatif

**UDU menggunakan arsitektur multi-tenant dengan satu identitas autentikasi per orang, keanggotaan lintas perusahaan, multi-persona per keanggotaan, serta otorisasi hybrid RBAC + ABAC + ReBAC.**

Platform Super Admin mengelola platform; Company Super Admin mengelola tenant perusahaannya. Pengguna login dengan Google/email, sedangkan NPWP mengidentifikasi perusahaan dan kode undangan mengotorisasi proses bergabung. Persona menentukan konteks kerja, role mengelompokkan permission, ABAC membatasi kondisi, ReBAC memeriksa hubungan dan scope, authority mengatur batas kewenangan bisnis, dan audit trail merekam tindakan penting.

**Tidak ada akses tenant tanpa membership yang sah, tidak ada eskalasi privilege melalui undangan perusahaan, dan tidak ada keputusan otorisasi yang hanya ditegakkan oleh frontend.**
