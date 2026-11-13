# USERS_SSOT.md
# UDU / Proyek Cair — Identity, Persona, Membership & Authorization SSOT

- **Status:** Target architecture / Single Source of Truth (SSOT)
- **Versi:** 1.5
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
| **Employee Record** | Catatan kepegawaian seseorang dalam satu perusahaan; orang yang sama dapat memiliki record berbeda pada perusahaan berbeda. |
| **employee_number** | NIK/nomor induk karyawan yang ditetapkan perusahaan masing-masing; bukan ID internal ProyekCair dan bukan kredensial login. |
| **Organizational Position** | Jabatan struktural seseorang, misalnya Supervisor, Superintendent, atau Manager; berbeda dari persona dan role aplikasi. |
| **Department / Unit** | Unit organisasi tempat seseorang ditempatkan, misalnya Operasional, Finance, Procurement, atau Head Office. |
| **Workflow / Approval Chain** | Rangkaian submit, review, verification, approval, rejection, atau return yang dikonfigurasi menurut proses dan kewenangan.
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

**Setiap perusahaan HANYA boleh memiliki satu Company Super Admin aktif.** Company Super Admin adalah administrator tertinggi untuk satu tenant perusahaan. Ketentuan satu akun ini bersifat normatif dan tidak dapat ditambah oleh Company Super Admin, pengguna biasa, atau proses invitation.

Model ini mengadopsi pola penunjukan administrator utama perusahaan seperti yang dijelaskan pengguna melalui analogi Coretax DJP: perusahaan tidak memperoleh hak Company Super Admin hanya dengan mendaftar mandiri. Perusahaan harus menghubungi pihak pemilik/operator platform ProyekCair. Setelah identitas legal perusahaan diverifikasi dan permohonan disetujui, Platform Super Admin melakukan provisioning satu akun/kursi Company Super Admin untuk perusahaan tersebut.

#### 3.2.1 Provisioning akun Company Super Admin

1. Perwakilan perusahaan menghubungi pemilik/operator ProyekCair melalui kanal resmi.
2. Platform Owner atau petugas platform yang diberi kewenangan memeriksa data legal perusahaan dan NPWP serta memastikan perusahaan belum memiliki Company Super Admin aktif.
3. Setelah disetujui, platform membuat satu registrasi Company Super Admin yang terikat pada satu Company/Tenant.
4. **NPWP perusahaan menjadi username/identifier perusahaan** pada proses provisioning dan identifikasi akun Company Super Admin. NPWP bukan password, bukan secret, dan tidak boleh dianggap sebagai bukti autentikasi yang cukup.
5. Platform menerbitkan satu kode aktivasi/undangan perusahaan yang unik, rahasia, berentropi tinggi, memiliki masa berlaku, dan hanya dapat digunakan sesuai ketentuan provisioning. Kode ini berfungsi sebagai bukti aktivasi awal untuk mengklaim kursi Company Super Admin.
6. Kode aktivasi disampaikan melalui kanal resmi kepada perwakilan perusahaan yang telah diverifikasi. Sistem hanya menyimpan hash kode, bukan nilai plaintext.
7. Penerima melakukan aktivasi dengan identitas personal yang terverifikasi (misalnya Google/email). Setelah berhasil, kursi Company Super Admin terikat pada User Identity personal tersebut.
8. Setelah aktivasi, kode tidak dapat digunakan kembali. Pemulihan, penggantian pemegang akun, atau penerbitan kode baru hanya dapat dilakukan melalui prosedur resmi Platform Owner dan wajib diaudit.

Istilah **kode aktivasi perusahaan** adalah istilah resmi internal ProyekCair. Istilah “EFIN” hanya merupakan analogi yang digunakan untuk menjelaskan fungsi kode aktivasi pada proses awal; ProyekCair tidak menyatakan bahwa kode tersebut adalah EFIN DJP atau memiliki fungsi/otoritas perpajakan.

**Pemisahan penting:** NPWP mengidentifikasi perusahaan; User Identity personal mengidentifikasi orang yang bertanggung jawab mengoperasikan akun Company Super Admin; kode aktivasi membuktikan hak untuk mengklaim kursi administrator pada proses awal. Ketiganya tidak boleh diperlakukan sebagai satu kredensial bersama.

Sistem tetap menggunakan autentikasi personal yang aman. Jangan membuat satu password bersama yang diketahui banyak pegawai atau menjadikan NPWP sebagai password. Jika pemegang Company Super Admin berganti, lakukan transfer/pemulihan kursi melalui prosedur resmi, bukan dengan membagikan akun atau kode lama.

#### 3.2.2 ProyekCair Console

Satu Company Super Admin memperoleh akses ke **ProyekCair Console**, yaitu area pengaturan dan tata kelola untuk tenant perusahaannya. Console merupakan bagian dari platform ProyekCair, bukan aplikasi terpisah dan bukan sistem autentikasi tersendiri.

Console difokuskan pada pengaturan perusahaan dan pengelolaan akses orang-orang yang diundang. Console bukan tempat menjalankan seluruh aktivitas operasional proyek. Aktivitas operasional dilakukan pada aplikasi ProyekCair sesuai persona, role, permission, project scope, dan authority yang diberikan.

Rute UI yang disarankan (bukan kontrak URL permanen):
- `/console` — Console perusahaan untuk Company Super Admin;
- `/platform` — administrasi global khusus Platform Super Admin;
- area aplikasi utama — modul operasional sesuai akses pengguna.
#### 3.2.3 Isi dan fungsi Company Console

| Menu Console | Fungsi |
|---|---|
| **Dashboard Perusahaan** | Ringkasan pengguna/karyawan, proyek, aktivitas barang dan keuangan, antrean pemeriksaan/persetujuan, dokumen tertunda, dan aktivitas yang perlu ditinjau. |
| **Profil Perusahaan** | Identitas perusahaan, NPWP, informasi legal, alamat, kontak, status verifikasi, dan riwayat perubahan profil. |
| **Manajemen Pengguna** | Daftar pengguna, undangan, status akun/membership, persona, dan riwayat keanggotaan. |
| **Manajemen Kepegawaian** | Daftar karyawan, employee_number, status kepegawaian, riwayat jabatan, mutasi, departemen, dan penempatan proyek. |
| **Struktur Organisasi** | Struktur Head Office, departemen/unit, struktur proyek lapangan, jabatan struktural, atasan langsung, dan riwayat perubahan organisasi. |
| **Jabatan, Role & Wewenang** | Katalog jabatan, persona, role, permission, matriks wewenang, batas persetujuan, dan penugasan proyek. |
| **Pengawasan Operasional** | Penelusuran aktivitas barang, keuangan, progres, K3, dokumen, serta pemeriksaan dan persetujuan berjenjang. |
| **Workflow & Persetujuan** | Konfigurasi alur review/approval berdasarkan jenis proses, proyek, departemen, nominal, jabatan, dan authority dalam guardrail platform. |
| **Audit & Riwayat Aktivitas** | Pencarian audit lintas modul: CRUD, import/export, pemeriksaan, persetujuan, perubahan akses, login/sesi, dan perubahan data penting. |
| **Pengaturan Perusahaan** | Preferensi tenant, kebijakan operasional yang diizinkan, notifikasi, dan konfigurasi lain dalam guardrail platform. |

Company Console menjadi pusat tata kelola dan pengawasan, bukan tempat Company Super Admin mengambil alih pekerjaan operasional. Console dapat menyediakan tampilan baca, filter, drill-down, dan audit aktivitas operasional. Hak audit tidak otomatis memberi hak membuat, mengubah, menghapus, memeriksa, atau menyetujui transaksi.

#### 3.2.4 Pengaturan role dan wewenang pengguna undangan

Company Super Admin dapat mengatur role dan wewenang orang yang diundang melalui dua pendekatan:

- **Default/template:** memilih template persona atau role bawaan ProyekCair, misalnya Project Manager, Site Engineer, Procurement, Finance, Storekeeper, HSE Officer, Document Controller, atau Viewer.
- **Custom:** menyesuaikan kombinasi role, permission, project scope, dan authority sesuai struktur serta kebutuhan perusahaan.

Aturan custom:
1. Custom berarti memilih/menyusun hak akses dari permission dan authority yang memang disediakan serta diizinkan platform; bukan membuat izin teknis bebas tanpa batas.
2. Company Super Admin tidak dapat memberikan permission yang dicadangkan untuk Platform Super Admin atau mengubah kebijakan global platform.
3. Authority dapat dibatasi berdasarkan nilai transaksi, kategori pekerjaan, proyek, jenis dokumen, tahap persetujuan, atau batas bisnis lainnya.
4. Akses ke proyek harus ditentukan secara eksplisit bila permission memerlukan project scope.
5. Sistem harus menampilkan ringkasan hak akses efektif sebelum perubahan disimpan agar administrator memahami dampak pemberian akses.
6. Perubahan role, permission, persona, project scope, dan authority harus dicatat dalam audit log dengan alasan perubahan bila relevan.
7. Perubahan konfigurasi tidak boleh berlaku hanya karena UI menampilkan pilihan; backend/database wajib memvalidasi dan menegakkan seluruh batasnya.

#### 3.2.5 Undangan anggota perusahaan

- Hanya satu Company Super Admin aktif yang menjadi pemegang kewenangan tertinggi administrasi tenant.
- Company Super Admin dapat mengundang banyak pengguna sesuai kebijakan/lisensi platform.
- Pengguna yang diundang login menggunakan identitas personal masing-masing (Google/email atau provider resmi lain yang didukung).
- Invitation anggota bukan kode aktivasi Company Super Admin dan tidak dapat membuat Company Super Admin kedua.
- Invitation memberikan membership dan role/persona/authority awal sesuai konfigurasi undangan.
- Company Super Admin dapat mengubah, menangguhkan, atau mencabut akses pengguna yang diundang dalam batas policy.
- Pengguna yang diundang tidak otomatis memperoleh akses Console. Akses penuh Console hanya dimiliki pemegang kursi Company Super Admin tunggal. Jika kelak dibutuhkan bantuan administratif, platform dapat merancang permission delegasi yang sangat terbatas secara terpisah; delegasi tersebut bukan Company Super Admin dan tidak boleh mengubah aturan satu akun utama.

#### 3.2.6 Penggantian dan pemulihan Company Super Admin

Karena hanya ada satu Company Super Admin aktif, sistem wajib menyediakan prosedur pemulihan agar tenant tidak terkunci jika pemegang akun kehilangan akses, berhenti bekerja, atau perlu diganti.

- Penggantian pemegang dilakukan melalui permohonan resmi perusahaan dan verifikasi oleh Platform Owner/operator platform.
- Platform menonaktifkan atau mencabut ikatan pemegang lama, lalu mengikat kursi yang sama kepada identitas personal pengganti.
- Tidak boleh ada dua Company Super Admin aktif bersamaan selama proses transfer.
- Setiap tahap transfer harus tercatat: pemohon, perusahaan, pemegang lama, pemegang baru, petugas platform, alasan, waktu, dan hasil.
- Kode aktivasi baru hanya diterbitkan melalui proses pemulihan/provisioning resmi; kode lama harus dicabut.
- Jika Platform Owner menunjuk petugas platform untuk membantu proses, petugas tersebut tidak otomatis menjadi Company Super Admin perusahaan.

#### 3.2.7 Keamanan, audit, dan batas kewenangan

1. Company Super Admin hanya berlaku pada satu tenant perusahaan yang telah diverifikasi.
2. Company Super Admin tidak dapat membaca atau mengelola tenant lain.
3. Company Super Admin tidak dapat membuat atau mengangkat Company Super Admin kedua.
4. Company Super Admin tidak dapat mengangkat siapa pun menjadi Platform Super Admin.
5. Company Super Admin hanya dapat mengatur role, permission, persona, project scope, dan authority yang diizinkan katalog serta guardrail platform.
6. Console dan seluruh endpoint administrasinya wajib menerapkan pemeriksaan backend/database dan RLS; menyembunyikan menu di frontend tidak cukup.
7. Company ID, NPWP, role, persona, dan authority yang dikirim client harus divalidasi terhadap data resmi di server.
8. Setiap perubahan administrasi harus merekam identitas personal pelaku, tenant, waktu, tindakan, target, nilai sebelum/sesudah jika relevan, alasan, dan hasil.
9. Audit log dapat dibaca Company Super Admin untuk tenantnya, tetapi tidak dapat dihapus atau diubah olehnya.
10. Kode aktivasi, password, OAuth token, session token, dan secret tidak boleh ditampilkan kembali di Console.
11. Pencabutan atau perubahan akses harus berlaku pada permintaan berikutnya setelah validasi ulang server.
12. Tindakan berisiko tinggi dapat memerlukan autentikasi ulang, alasan wajib, atau persetujuan Platform Owner sesuai kebijakan.

#### 3.2.8 Perbandingan kewenangan

| Kemampuan | Company Super Admin tunggal | Platform Super Admin |
|---|:---:|:---:|
| Mengelola pengaturan tenant sendiri | Ya | Ya |
| Mengundang pengguna ke perusahaan sendiri | Ya | Dapat membantu sesuai policy |
| Menetapkan role/persona pengguna dalam batas policy | Ya | Ya |
| Menetapkan custom permission/authority dalam guardrail | Ya | Menetapkan guardrail global |
| Melihat audit tenant sendiri | Ya | Sesuai kebijakan platform |
| Mengakses tenant lain | Tidak | Sesuai policy dan kebutuhan tugas |
| Menerbitkan/mengganti akun Company Super Admin | Tidak | Ya, melalui proses resmi |
| Membuat Company Super Admin kedua | Tidak | Tidak; kursi tunggal ditransfer, bukan digandakan |
| Mengubah policy atau katalog permission global | Tidak | Ya |
| Menunjuk Platform Super Admin | Tidak | Hanya melalui prosedur kepemilikan platform khusus |

**Aturan normatif:** satu perusahaan memiliki tepat satu kursi Company Super Admin aktif. ProyekCair Console adalah antarmuka pengaturan tenant dan audit, sedangkan sumber kebenaran otorisasi tetap berada pada data membership, role, permission, persona, authority, project scope, policy, dan pemeriksaan backend/database.

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

## 4.1 Identitas kepegawaian dan employee_number

Setiap orang yang dicatat sebagai karyawan perusahaan harus memiliki Employee Record yang terhubung ke User Identity dan Company Membership yang tepat.

- `user_id` adalah ID identitas autentikasi global orang tersebut.
- `company_id` adalah ID internal tenant/perusahaan.
- `employee_id` adalah ID internal record kepegawaian orang tersebut di satu perusahaan.
- `employee_number` adalah NIK/nomor induk karyawan yang ditetapkan atau diberikan oleh perusahaan masing-masing. Nilainya diinput/dikelola melalui administrasi perusahaan, bukan dibuat otomatis oleh ProyekCair.
- Format `employee_number` mengikuti sistem perusahaan, misalnya `00125`, `MM-00125`, atau `EMP/OPS/025`; format tidak diasumsikan seragam.- Terapkan keunikan `UNIQUE(company_id, employee_number)`. Nilai yang sama boleh digunakan oleh perusahaan berbeda.
- `employee_number` bukan username, password, secret, atau kredensial autentikasi.
- Satu User Identity yang bekerja pada beberapa perusahaan memiliki Employee Record dan employee_number masing-masing pada setiap perusahaan.
- Pegawai yang keluar tidak dihapus secara fisik jika telah memiliki histori; statusnya diakhiri/nonaktif dan histori dipertahankan.
- Perubahan employee_number, status kepegawaian, jabatan, departemen, atasan, dan penempatan harus memiliki histori.

**Aturan auto-generation ID:** seluruh identifier teknis/internal ProyekCair dibuat otomatis oleh aplikasi/backend/database dan tidak dipilih pengguna. Ini mencakup `user_id`, `company_id`, `employee_id`, `persona_id`, `position_id`, `department_id`, `project_id`, `role_id`, `permission_id`, `workflow_id`, `workflow_step_id`, `audit_event_id`, serta ID internal entitas lainnya. Gunakan UUID sebagai default identifier internal. Pengecualian yang disepakati adalah `employee_number`, yang berasal dari perusahaan. Nomor dokumen/transaksi yang mudah dibaca (misalnya `INV-2026-00001`) boleh dibuat otomatis sebagai business/display number, tetapi bukan pengganti UUID primary key.

Relasi antartabel menggunakan UUID internal, bukan employee_number sebagai foreign key. Satu user_id dapat terhubung ke beberapa Employee Record melalui Company Membership berbeda.

## 5.1 Struktur organisasi, departemen, dan jabatan

Struktur organisasi adalah model tersendiri dan tidak boleh disamakan dengan persona atau role aplikasi. Satu perusahaan dapat memiliki struktur Head Office dan struktur proyek lapangan yang berbeda.

Contoh struktur proyek lapangan (template, bukan keharusan):
```text
Direktur / CEO
└── Manager / KTT / Project Manager
    └── Superintendent
        └── Supervisor
            └── Foreman
                └── Worker
```

Contoh struktur Head Office (template, bukan keharusan):
```text
CEO / Direktur Utama
└── Direktur Departemen
    └── General Manager
        └── Department Head / Manager
            └── Assistant Manager
                └── Supervisor
                    └── Staff
```

Ketentuan:
- Contoh tersebut bukan struktur wajib/universal. Perusahaan dapat menambah, mengurangi, mengganti nama, atau mengurutkan jabatan.
- Struktur proyek lapangan dapat berakhir pada Manager/KTT/Project Manager; jabatan di atasnya dapat berada pada struktur Head Office atau tata kelola korporat.
- Jabatan/position, departemen/unit, dan relasi atasan-bawahan memiliki ID internal auto-generated serta riwayat masa berlaku.
- Penempatan karyawan dapat berbeda menurut perusahaan, departemen, proyek, lokasi, dan periode.
- Atasan langsung dan rantai pelaporan disimpan sebagai relasi organisasi dengan effective date, bukan disimpulkan hanya dari nama jabatan.
- Posisi direktur dengan lingkup berbeda (misalnya Direktur Operasional dan Direktur Keuangan) harus dapat dibedakan.
- Perubahan struktur, jabatan, departemen, atasan, atau penempatan tidak boleh mengubah snapshot histori aktivitas terdahulu.

### Pembedaan jabatan, persona, role, permission, dan authority

- **Jabatan/position:** kedudukan struktural, misalnya Supervisor atau Superintendent.
- **Persona:** kapasitas/konteks saat menggunakan ProyekCair, misalnya Supervisor Proyek A.
- **Role:** bundel permission aplikasi, misalnya Inventory Reviewer.
- **Permission:** tindakan teknis atomik, misalnya `inventory.mutation.review`.
- **Authority:** batas kewenangan bisnis, misalnya persetujuan transaksi sampai nominal tertentu.

Jabatan Supervisor tidak otomatis memberikan semua permission Supervisor, kewenangan persetujuan tanpa batas, atau akses ke seluruh proyek. Otorisasi tetap mengikuti membership, persona, role, permission, authority, atribut, relasi, dan project scope.

## 5.2 Workflow pemeriksaan dan persetujuan berjenjang

ProyekCair harus mendukung workflow yang dapat dikonfigurasi, bukan menanam satu rantai jabatan permanen di kode. Alur dapat berbeda menurut jenis transaksi/dokumen, departemen, proyek, nilai/nominal, kategori, risiko, dan kebijakan perusahaan.

Contoh alur proyek lapangan:
```text
Worker / Foreman
    → Supervisor (input/pemeriksaan)
    → Superintendent (review/verifikasi)
    → Manager / KTT / Project Manager (persetujuan sesuai authority)
    → Selesai
```

Tahap dapat berupa draft, submit, review, verify, approve, reject, return for revision, resubmit, dan close. Tidak semua proses harus melewati semua jabatan. Head Office dapat memiliki approval chain berbeda. Workflow harus memeriksa penugasan organisasi dan authority saat tindakan dilakukan; jabatan saja tidak cukup.

Setiap workflow instance dan step memiliki ID internal auto-generated. Setiap keputusan tahap menyimpan aktor, user_id, company_id, employee_id, employee_number saat itu (jika tersedia), persona aktif, snapshot jabatan/position, departemen, proyek, tindakan, waktu, catatan/alasan, hasil, SLA/due date, dan referensi dokumen/transaksi. Pengulangan tahap menghasilkan event baru; histori tahap sebelumnya tidak ditimpa. Tahap approval bersifat serial; akses melihat dapat diberikan lebih awal secara paralel, tetapi tombol/tindakan approval hanya aktif pada tahap yang sedang berjalan.

Contoh kategori workflow: laporan progres harian/mingguan, permintaan dan pengeluaran material, transaksi keuangan/pengajuan pembayaran, laporan K3, dokumen resmi, dan perubahan BOQ. Workflow Builder harus dibatasi katalog permission dan guardrail platform.

### 5.2.1 Persetujuan berurutan, penandatangan akhir, dan QR

Persetujuan dokumen/data mengikuti **alur serial (berurutan)** berdasarkan tangga/hierarki organisasi dan aturan workflow yang berlaku. Persetujuan paralel untuk beberapa tahap/pejabat pada satu rantai approval tidak diperbolehkan. Pengguna yang berada pada tahap berikutnya boleh melihat dokumen/data secara paralel (read-only sesuai akses), tetapi tindakan persetujuan hanya dibuka ketika giliran tahapnya aktif dan seluruh tahap sebelumnya telah selesai.

- Setiap tahap yang diwajibkan harus ditindaklanjuti satu per satu sesuai urutan workflow, misalnya Foreman/Worker → Supervisor → Superintendent → Manager/KTT/Project Manager. Rantai Head Office dapat berbeda sesuai struktur dan kebijakan perusahaan.
- Pengguna pada tahap aktif meninjau dokumen/data, lalu melakukan tindakan eksplisit melalui aplikasi: approve/agree, reject, atau return for revision sesuai hak dan kebijakan. Klik persetujuan merupakan persetujuan elektronik internal yang tercatat; bukan tanda tangan QR.
- **QR/tanda tangan pengesahan hanya diterbitkan oleh penandatangan akhir (final signatory)** setelah seluruh tahap persetujuan serial selesai. Tidak semua reviewer/approver membubuhkan tanda tangan QR.
- **Default penandatangan akhir untuk workflow proyek maupun departemen adalah Manager / KTT / Project Manager**, sesuai struktur organisasi dan konteks proses. Default ini merupakan template awal, bukan aturan jabatan yang kaku atau hard-coded.
- **Company Super Admin dapat meng-custom penunjukan final signatory** melalui Company Console berdasarkan perusahaan, jenis dokumen/formulir/kontrak, proyek, departemen, unit, atau scope lain yang diizinkan policy. Konfigurasi dapat menunjuk orang yang berbeda untuk jenis dokumen atau scope yang berbeda; tidak harus selalu pemegang jabatan default.
- Penunjukan harus mengikat ke User Identity dan Employee Record/membership yang sah, serta memvalidasi jabatan/position, persona/role, authority, ruang lingkup, masa berlaku, dan status aktif. Nama yang diketik bebas tidak cukup sebagai dasar otorisasi.
- **Seseorang dapat ditunjuk sebagai final signatory oleh Company Super Admin di beberapa perusahaan sekaligus**, selama masing-masing perusahaan secara terpisah memberikan penunjukan dan scope kewenangan yang jelas. Dengan demikian satu identitas personal dapat memiliki otoritas pengesahan tertentu di Perusahaan A, B, dan C tanpa membuat akun login duplikat.
- Contoh konseptual: seseorang yang memiliki otoritas menandatangani dokumen tertentu melalui Coretax pada beberapa perusahaan dapat dianalogikan sebagai pihak yang ditunjuk masing-masing Company Super Admin ProyekCair untuk mengesahkan jenis dokumen tertentu pada tenant mereka. **Coretax hanya contoh pola penunjukan lintas perusahaan; ProyekCair tidak mengklaim integrasi, afiliasi, atau kesetaraan kewenangan perpajakan dengan Coretax/DJP.**
- Penunjukan lintas perusahaan tidak memberikan akses otomatis ke tenant lain, tidak memperluas kewenangan ke semua dokumen, dan tidak menggantikan proses persetujuan serial internal perusahaan. Otoritas final signatory selalu spesifik pada perusahaan dan scope penunjukannya.
- Penetapan, perubahan, penangguhan, pencabutan, dan penggunaan kewenangan final signatory wajib dicatat dalam audit trail, termasuk pihak yang menunjuk, pihak yang ditunjuk, tenant, jenis dokumen, scope, authority, masa berlaku, dan waktu tindakan.
- Final signatory baru dapat melakukan pengesahan setelah seluruh tahap persetujuan serial yang diwajibkan selesai dan dokumen berada pada versi final yang disetujui. QR harus terikat pada dokumen/versi final, identitas penandatangan, waktu pengesahan, dan mekanisme verifikasi publik/internal. Perubahan dokumen setelah pengesahan harus membatalkan/menandai QR lama tidak berlaku dan memerlukan proses revisi serta pengesahan ulang.
- QR merupakan bukti verifikasi/pengesahan dokumen dalam ProyekCair; jangan menyebutnya tanda tangan elektronik tersertifikasi atau mengklaim kekuatan hukum tertentu kecuali integrasi dan persyaratan hukum terkait benar-benar dipenuhi.

### 5.2.2 SLA tindakan, notifikasi, dan eskalasi

Setiap tahap workflow yang membutuhkan tindakan harus memiliki batas waktu/SLA yang ditetapkan oleh template atau konfigurasi workflow. SLA dapat berbeda menurut jenis dokumen/transaksi dan urgensi, misalnya maksimal 1 hari, 2 hari, atau 1 minggu.

- Saat item masuk ke antrean seorang approver/reviewer, aplikasi mengirim notifikasi yang memuat jenis dokumen/data, referensi, proyek/departemen, tindakan yang diminta, tanggal/waktu jatuh tempo, dan sisa waktu.
- Dashboard dan daftar tugas menampilkan status menunggu tindakan, prioritas, due date, serta indikator terlambat.
- Pengingat dikirim sebelum tenggat dan/atau saat tenggat terlewati sesuai kebijakan notifikasi.
- Jika tenggat terlewati, aplikasi menandai overdue dan menjalankan aturan eskalasi yang telah dikonfigurasi, misalnya mengingatkan atasan/level berikutnya atau administrator terkait. Eskalasi tidak boleh diam-diam dianggap sebagai persetujuan otomatis.
- Dokumen tetap mengikuti urutan serial. Notifikasi kepada pihak berikutnya atau atasan untuk awareness/escalation tidak membuka hak approve sebelum gilirannya, kecuali terdapat mekanisme delegasi/pengganti resmi yang sah, tercatat, dan tervalidasi.
- SLA, reminder, escalation, delegation/substitution, alasan keterlambatan, serta seluruh tindakan harus masuk audit trail. Perubahan SLA setelah workflow berjalan tidak boleh menghapus jejak SLA yang berlaku ketika tahap dimulai.
- Workflow dapat menetapkan SLA khusus untuk keputusan berdampak operasional tinggi, misalnya permintaan penambahan quantity item yang melebihi BOQ. Kasus tersebut dapat diberi tenggat singkat (contohnya 1–2 hari) agar keputusan tidak menghambat pekerjaan, sesuai kebijakan perusahaan dan tingkat risikonya.

## 5.3 Pengawasan operasional dalam Company Console

Company Super Admin dapat memperoleh dashboard dan penelusuran audit tenant untuk:
- aktivitas barang/inventory: create, update, koreksi, void/delete, import, export, dan lampiran;
- aktivitas keuangan/cash: input, perubahan, pembatalan/koreksi, import/export, serta status pemeriksaan/persetujuan;
- progres pekerjaan dan pemeriksaan Supervisor/Superintendent/Manager;
- dokumen resmi, revisi, penerbitan, pembatalan, dan verifikasi;
- aktivitas K3 dan dokumentasi lapangan;
- antrean review, verifikasi, approval, revisi, atau eskalasi;
- aktivitas yang perlu ditinjau, seperti perubahan nilai material, penghapusan, ekspor besar, atau percobaan akses ditolak.

Pengawasan bersifat audit/read-oriented. Company Super Admin tidak otomatis menjadi pembuat, reviewer, atau approver transaksi karena memiliki Console. Jika ia juga bekerja secara operasional, ia menggunakan persona operasional yang sah; audit tetap mencatat identitas dan konteksnya.

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

Autentikasi berhasil tidak berarti pengguna otomatis memperoleh akses ke data perusahaan. Ada dua jalur provisioning yang berbeda:
1. **Company Super Admin:** hanya melalui permohonan resmi perusahaan kepada pemilik/operator ProyekCair, verifikasi legal/NPWP, dan provisioning satu kursi administrator oleh Platform Super Admin. NPWP menjadi identifier perusahaan; kode aktivasi perusahaan yang unik digunakan untuk mengklaim kursi tersebut dan kemudian diikat ke User Identity personal yang terverifikasi.
2. **Pengguna anggota perusahaan:** melalui invitation yang dibuat Company Super Admin dari Company Console. Undangan ini memberikan membership dan role/persona/authority sesuai konfigurasi, tetapi tidak pernah memberikan kursi Company Super Admin.

Tidak ada pendaftaran publik yang otomatis membuat tenant aktif atau memberikan hak Company Super Admin.

### 6.2 Alur provisioning Company Super Admin

1. Perusahaan menghubungi pemilik/operator ProyekCair melalui kanal resmi.
2. Platform memverifikasi perusahaan dan NPWP serta memastikan belum ada kursi Company Super Admin aktif.
3. Platform membuat tenant (jika belum ada) dan satu kursi Company Super Admin.
4. Platform menerbitkan kode aktivasi perusahaan; nilai kode hanya ditampilkan/disampaikan sekali dan hash-nya disimpan.
5. Perwakilan yang disetujui login dengan identitas personal terverifikasi, memasukkan NPWP sebagai identifier perusahaan dan kode aktivasi, lalu menyelesaikan pengikatan identitas ke kursi tersebut.
6. Server memvalidasi kode, status, expiry, tenant tujuan, dan identitas penerima sesuai proses verifikasi.
7. Setelah sukses, kode dinonaktifkan dan identitas personal tersebut menjadi pemegang satu-satunya kursi Company Super Admin.
8. Semua aktivitas provisioning dan aktivasi dicatat pada audit platform dan histori tenant.

### 6.3 Alur pengguna anggota perusahaan

1. Pengguna login menggunakan Google atau email.
2. Server mengenali atau membuat User Identity berdasarkan identitas provider yang tervalidasi.
3. Pengguna menerima invitation dari Company Super Admin.
4. Pengguna membuka undangan dan melakukan redeem menggunakan identitas personalnya.
5. Server memvalidasi kode, status, masa berlaku, batas penggunaan, perusahaan tujuan, dan ketentuan email/identitas penerima.
6. Jika valid, server membuat atau mengaktifkan Company Membership dan memberikan persona/role/project scope/authority sesuai konfigurasi undangan.
7. Sistem mencatat penerimaan undangan dan perubahan membership ke audit trail.
8. Pengguna memilih perusahaan dan persona aktif untuk memulai pekerjaan.

### 6.4 Aturan invitation anggota perusahaan

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

### 6.5 Undangan untuk diri sendiri

Platform Owner atau pemegang Company Super Admin dapat memiliki persona operasional tambahan melalui mekanisme pemberian persona/undangan yang sah sesuai kewenangannya. Untuk mendukung kebutuhan pemilik yang juga bekerja sebagai operator/inputter:
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
- nilai transaksi dan approval limit;- status/verifikasi perusahaan;
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
- Persona/role bawaan adalah template. Company Super Admin dapat mengelola pemberian persona dalam batas katalog dan policy platform.- Custom persona/role perusahaan dapat dipertimbangkan pada fase lanjutan, tetapi harus tetap tersusun dari permission yang diizinkan platform dan tidak dapat memperluas privilege secara diam-diam.

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
| `employee_records` (konseptual) | Record kepegawaian per membership/company, termasuk employee_number dari perusahaan, status, dan masa berlaku. |
| `departments` | Unit/departemen perusahaan atau proyek. |
| `organizational_positions` | Katalog jabatan struktural yang dapat dikonfigurasi. |
| `employee_assignments` | Penempatan karyawan ke departemen, jabatan, atasan, proyek, dan periode efektif. |
| `organizational_relationships` (konseptual) | Relasi atasan-bawahan/pelaporan dengan periode berlaku. |
| `workflow_definitions` | Definisi alur review/approval per jenis proses dan scope. |
| `workflow_steps` | Tahapan, urutan, kondisi, dan aturan aktor/authority. |
| `workflow_instances` | Instance workflow yang terkait dokumen/transaksi/resource. |
| `workflow_events` | Event append-only submit, review, verify, approve, reject, return, dan resubmit. |
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