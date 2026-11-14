# USERS_SSOT.md
# UDU / Proyek Cair — Identity, Persona, Membership & Authorization SSOT

- **Status:** Target architecture / Single Source of Truth (SSOT)
- **Versi:** 3.0
- **Tanggal:** 2026-11-14
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
7. Pendaftaran publik melalui Google/email dapat membuat User Identity dan Personal Workspace, tetapi tidak otomatis memberikan Company Membership atau hak istimewa perusahaan.
8. Personal Workspace dan Company Workspace adalah konteks/ruang kerja berbeda dengan kepemilikan, batas data, dan otorisasi terpisah.
9. Pengguna dapat berkembang dari penggunaan personal menuju penggunaan perusahaan melalui penawaran dan onboarding resmi; penawaran tidak mengubah akses atau privilege dengan sendirinya.

## 2. Terminologi dan pemisahan konsep

Istilah berikut harus digunakan secara konsisten dalam kode, database, API, UI, dan dokumentasi.

| Istilah | Definisi |
|---|---|
| **User Identity** | Identitas orang yang telah diautentikasi, misalnya melalui Google atau email. Identitas ini tidak sama dengan jabatan atau role. |
| **Authentication** | Proses membuktikan siapa pengguna melalui penyedia autentikasi. |
| **Company / Tenant** | Organisasi yang terdaftar di platform dan menjadi batas isolasi data. |
| **Company Membership** | Hubungan antara satu User Identity dan satu Company, beserta status keanggotaannya. |
| **Employee Record** | Data kepegawaian tambahan conditional/optional bila diperlukan untuk proses operasional tertentu. Bukan daftar seluruh karyawan dan bukan prasyarat universal membership, persona, project scope, approval, atau final signing. |
| **employee_number** | Nomor Induk Karyawan (Employee Number) yang ditetapkan perusahaan masing-masing; bukan Nomor Induk Kependudukan (NIK), bukan ID internal ProyekCair, dan bukan kredensial login. |
| **Organizational Position** | Jabatan struktural seseorang, misalnya Supervisor, Superintendent, atau Manager; berbeda dari persona dan role aplikasi. |
| **Department / Unit** | Unit organisasi tempat seseorang ditempatkan, misalnya Operasional, Finance, Procurement, atau Head Office. |
| **Workflow / Approval Chain** | Rangkaian submit, review, verification, approval, rejection, atau return yang dikonfigurasi menurut proses dan kewenangan. |
| **Persona** | Kapasitas/konteks kerja yang dipilih pengguna dalam suatu perusahaan atau cakupan tertentu, misalnya Finance atau Site Engineer. Persona adalah konteks penggunaan, bukan identitas login. |
| **Role** | Kumpulan izin yang dapat diberikan kepada persona atau keanggotaan. |
| **Permission** | Izin teknis yang spesifik terhadap tindakan/sumber daya, misalnya `cash.transaction.create`. |
| **Authority** | Batas kewenangan bisnis, misalnya limit persetujuan nominal, jenis persetujuan, atau tingkat otorisasi. |
| **Project Membership / Scope** | Hubungan pengguna dengan proyek tertentu yang membatasi data dan tindakan yang dapat diakses. |
| **Invitation** | Undangan yang dibuat oleh pihak berwenang agar identitas dapat bergabung ke perusahaan dan menerima persona/role tertentu. |
| **Platform Super Admin** | Pemilik/pengelola tertinggi platform UDU, dengan otoritas lintas tenant sesuai kebijakan platform. |
| **Company Super Admin** | Administrator tertinggi pada satu perusahaan, terbatas pada tenant perusahaannya sendiri. |
| **Pihak Terkait (penunjukan kewenangan)** | User Identity yang memiliki Company Membership aktif pada perusahaan yang menunjuknya dan didaftarkan sebagai anggota oleh Company Super Admin, lalu ditunjuk perusahaan sebagai final signatory untuk dokumen/scope terkait. ProyekCair tidak mensyaratkan jabatan, senioritas, KTP/NIK, atau Employee Record terpisah secara universal; tanggung jawab pemeriksaan identitas dan kelayakan internal ada pada perusahaan. |
| **Orang Terkait (relasi orang–perusahaan)** | Catatan hubungan seseorang dengan perusahaan dalam kapasitas legal, kepemilikan, pengendalian, atau manfaat, misalnya pendiri, direktur/CEO, pemegang saham, atau penerima manfaat (*beneficial owner*). Orang tersebut dapat sama sekali tidak mengetahui, menggunakan, atau memiliki akun di ProyekCair; pencatatannya tidak mensyaratkan User Identity, login, membership, persona, atau aktivitas di aplikasi. Konsep ini berbeda dari penunjukan Pihak Terkait sebagai penandatangan. Fitur ini belum termasuk cakupan implementasi saat ini. |
| **RFIN** | Keluarga credential aktivasi/undangan internal ProyekCair yang dibedakan menjadi RFIN-A dan RFIN-B berdasarkan penerbit, penerima, serta tujuan penggunaannya. RFIN bukan password login, bukan NPWP, dan bukan pengganti autentikasi User Identity. |\n| **RFIN-A** | Credential aktivasi awal yang diterbitkan oleh Platform Super Admin kepada perusahaan untuk mengklaim/mengaktifkan satu kursi Company Super Admin pada proses signup/provisioning perusahaan. |\n| **RFIN-B** | Credential undangan yang diterbitkan oleh Company Super Admin kepada user/karyawan perusahaan yang diundang untuk signup dan mengaktifkan Company Membership serta akses awal sesuai konfigurasi undangan. |\n| **RFIN Engine** | Komponen khusus untuk provisioning, pengelolaan, validasi, pencabutan, dan pemeriksaan penggunaan RFIN-A maupun RFIN-B secara aman, tenant-isolated, dan teraudit; kedua jenis credential wajib memiliki alur dan policy terpisah. |\n| **TTE/QR Privat** | Mekanisme pengesahan/tanda tangan elektronik internal ProyekCair yang akses, tindakan, dan verifikasinya dibatasi untuk pengguna berwenang dalam tenant/scope terkait; bukan layanan verifikasi publik. |\n| **Audit Trail** | Catatan append-only atas aktivitas dan perubahan penting yang dapat ditelusuri. |

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
- Saat menggunakan persona operasional pada suatu perusahaan, Platform Owner bertindak dalam konteks perusahaan tersebut dan wajib tunduk pada membership, persona, role, permission, authority, serta project/resource scope yang diberikan oleh Company Super Admin perusahaan itu. Hak Platform Super Admin tidak boleh dipakai untuk melewati atau memperluas kewenangan operasional persona.
- Kewenangan Platform Super Admin hanya digunakan melalui tindakan administratif platform yang eksplisit, terpisah dari pekerjaan operasional tenant, dengan alasan dan audit trail yang sesuai. Identitas asli Platform Owner tetap tercatat pada kedua jenis tindakan; tindakan administratif platform tidak boleh disamarkan sebagai tindakan persona operasional.
- Sistem sebaiknya mendukung satu pemilik utama yang terlindungi. Administrator platform tambahan dapat ditunjuk dengan kewenangan yang eksplisit dan tidak otomatis setara dengan pemilik utama.

### 3.2 Company Super Admin

**Setiap perusahaan HANYA boleh memiliki satu Company Super Admin aktif.** Company Super Admin adalah administrator tertinggi untuk satu tenant perusahaan. Ketentuan satu akun ini bersifat normatif dan tidak dapat ditambah oleh Company Super Admin, pengguna biasa, atau proses invitation.

Calon Company/Tenant mengajukan registrasi melalui aplikasi menggunakan NPWP dan autentikasi Google. Pengajuan berstatus `PENDING` dan mengirim notifikasi kepada Platform Super Admin. Status tetap `PENDING` sampai Platform Super Admin memutuskan `ACCEPTED` atau `REJECTED`. Setelah `ACCEPTED`, Platform memulai provisioning tenant dalam status `CLAIM_PENDING` dan menyiapkan satu kursi Company Super Admin yang belum diklaim; tenant dan kursi baru menjadi aktif setelah proses signup/claim pemegang kursi diselesaikan sesuai Bagian 17. Review ini adalah keputusan menerima/menolak deklarasi dan informasi yang tersedia, bukan verifikasi legal independen atau KYC pemerintah.

#### 3.2.1 Provisioning akun Company Super Admin

1. Calon Company/Tenant mengajukan Company Identity Registration dengan NPWP dan autentikasi Google. Google mengautentikasi orang yang mengajukan; NPWP mengidentifikasi calon tenant. Formulir standar tidak mewajibkan identitas pemohon terpisah, business email terpisah, akta, atau dokumen legal pemerintah.
2. Sistem menormalisasi NPWP, memeriksa format/kelengkapan dan duplikasi. Lolos pemeriksaan ini tidak berarti status legal perusahaan atau kewenangan pemohon diverifikasi independen.
3. Pengajuan disimpan dengan status `PENDING`; Platform Super Admin menerima notifikasi. Selama belum ada keputusan eksplisit, status tetap `PENDING` dan tenant belum aktif.
4. Platform Super Admin meninjau deklarasi/informasi yang tersedia dan memutuskan `ACCEPTED` atau `REJECTED`. Tidak ada auto-activation. Alasan keputusan dicatat dalam audit trail. Review bukan verifikasi legal independen, verifikasi pemerintah, atau KYC.
5. Setelah `ACCEPTED`, sistem membuat record Company/Tenant dalam status `CLAIM_PENDING` dan menyediakan tepat satu kursi Company Super Admin berstatus `UNCLAIMED`. Penerimaan aplikasi, provisioning tenant, signup/claim pemegang kursi, dan aktivasi tenant adalah state/proses terpisah.
6. Calon pemegang kursi menyelesaikan signup baru menggunakan email atau Google (atau sign-in/reauthentication jika sudah memiliki User Identity) setelah persetujuan Platform dan provisioning claim diberikan. Setelah claim berhasil, akun ditautkan ke Company/Tenant dan User Identity internal yang stabil (`auth.users.id`). Untuk sign-in berikutnya, Company Super Admin menggunakan NPWP perusahaan sebagai login identifier dan kata sandi sebagai credential rahasia. NPWP bukan kata sandi dan tidak boleh diperlakukan sebagai secret. Sistem memverifikasi pasangan NPWP + kata sandi, lalu memetakan sesi terautentikasi ke User Identity dan tenant yang tepat. Password disimpan hanya dalam bentuk hash menggunakan mekanisme password hashing yang aman; implementasi wajib menyediakan rate limiting, proteksi brute-force/credential stuffing, lockout atau throttling adaptif, reset/recovery aman, dan audit peristiwa autentikasi.
7. Kursi Company Super Admin tetap terikat pada User Identity internal stabil (`auth.users.id`) untuk relasi dan audit. Login khusus memetakan sesi terverifikasi ke User Identity tersebut; NPWP tidak menggantikan `user_id`.
8. Platform Super Admin menjalankan provisioning/aktivasi kursi tunggal melalui Platform Administration Engine. RFIN-A dapat dipakai sebagai credential aktivasi/claim satu kali bila diperlukan. RFIN-A bukan faktor login berulang. A2F/MFA adalah fitur keamanan opsional yang disediakan platform dan dapat diwajibkan oleh kebijakan tenant untuk kelompok pengguna atau tindakan tertentu; bukan syarat universal aktivasi Company Super Admin.
9. RFIN-A, bila digunakan, memiliki entropy tinggi, expiry, tenant binding, rate limit, redemption atomik satu kali, dan disimpan sebagai hash setelah issuance.
10. Penggantian pemegang kursi, perubahan metode autentikasi, dan recovery diajukan melalui Console kepada Platform Super Admin melalui Platform Administration Engine dengan keputusan accept/reject dan audit lengkap. Tidak boleh ada dua kursi Company Super Admin aktif bersamaan.

Istilah resmi credential aktivasi perusahaan adalah **RFIN-A**. RFIN-A bukan credential undangan karyawan. Istilah “EFIN” hanya pernah digunakan sebagai analogi penjelasan dan bukan nama, integrasi, afiliasi, atau kesetaraan dengan credential DJP/Coretax.

**Pemisahan penting:** NPWP mengidentifikasi perusahaan; User Identity personal mengidentifikasi orang yang bertanggung jawab mengoperasikan akun Company Super Admin; kode aktivasi membuktikan hak untuk mengklaim kursi administrator pada proses awal. Ketiganya tidak boleh diperlakukan sebagai satu kredensial bersama.

NPWP merupakan login identifier Company Super Admin, sedangkan kata sandi merupakan credential rahasia untuk sign-in. Email/Google digunakan pada proses sign-up dan pengaitan awal User Identity; bukan berarti NPWP menjadi password. Setelah akun diprovisioning, sign-in menggunakan pasangan NPWP + kata sandi dan sesi harus dipetakan ke `auth.users.id` serta tenant yang tepat. Reset password, pemulihan akun, dan penggantian pemegang kursi dilakukan melalui prosedur aman pada Platform Administration Engine dan wajib diaudit. A2F/MFA (misalnya TOTP authenticator, passkey/security key, atau metode MFA provider yang secara eksplisit didukung platform) merupakan opsi keamanan yang ditawarkan Platform. Secara default fitur ini tidak wajib bagi seluruh tenant. Company Super Admin dapat mengaktifkan metode yang tersedia untuk tenant, menetapkan cakupan pengguna/tindakan, dan mewajibkannya berdasarkan risiko. Google OAuth sebagai metode sign-in tidak otomatis berarti A2F ProyekCair aktif; faktor kedua hanya dianggap terpenuhi jika ada sinyal/provider flow MFA yang tervalidasi atau challenge MFA ProyekCair yang berhasil.

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
| **Profil Anggota / Employee Record** | Data minimum pengguna perusahaan yang memang memerlukan record kepegawaian untuk penugasan operasional, CRUD tertentu, atau TTE/QR; employee_number bila digunakan. Bukan daftar seluruh karyawan. |
| **Penugasan Individu** | Penetapan persona, role/permission, level/label jabatan atau approval, authority, project scope, dan masa berlaku per anggota tanpa mewajibkan bagan organisasi, departemen, divisi, atau relasi atasan-bawahan. |
| **Persona, Role, Permission & Authority** | Pemilihan preset dan penyesuaian assignment per anggota; ringkasan effective access, batas kewenangan, project scope, dan masa berlaku. |
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

#### 3.2.5 Undangan anggota perusahaan dan RFIN-B

Company Super Admin memulai proses dengan menambahkan **calon anggota (Pihak Terkait/Invitee)** ke daftar undangan perusahaan, kemudian menetapkan konfigurasi akses orang tersebut. Istilah Pihak Terkait/Invitee ini tidak sama dengan **Orang Terkait** dalam arti beneficial owner/pemilik/pengendali perusahaan pada glossary, dan belum menjadi Company Membership sampai proses redemption selesai.

Alur normatif:
1. Company Super Admin membuat draft undangan dengan identitas tujuan yang dapat dihubungi (email wajib untuk pengiriman; nama tampilan dan nomor telepon opsional), tenant tujuan, serta catatan/employee_number bila memang diperlukan. Email tujuan dinormalisasi dan menjadi binding undangan; employee_number bukan login credential.
2. Sebelum penerbitan, Company Super Admin memilih satu atau beberapa persona, minimal satu role yang relevan untuk akses operasional, permission dari katalog platform, project scope bila tindakan memerlukannya, authority bila proses memerlukannya, serta tanggal mulai/akhir bila diperlukan. Employee Record tetap opsional dan dibuat hanya bila use case memerlukannya.
3. Sistem menampilkan Effective Access Preview: identitas tujuan, tenant, persona, role, permission efektif, project/resource scope, authority/limit, masa berlaku, kemampuan yang tidak diberikan, dan potensi konflik. Penerbit harus mengonfirmasi bahwa konfigurasi sesuai tanggung jawab orang tersebut.
4. Setelah konfirmasi, backend menerbitkan RFIN-B unik, acak berentropi tinggi, terikat pada tenant, email tujuan, dan snapshot konfigurasi; token disimpan sebagai hash, memiliki expiry dan batas redemption satu kali. RFIN-B dikirim melalui kanal terverifikasi (email atau kanal lain yang diaktifkan platform). Jangan menampilkan ulang plaintext setelah issuance.
5. Invitee membuka tautan/memasukkan RFIN-B, melakukan sign-up atau sign-in dengan Google/email yang didukung, dan membuktikan kontrol atas email yang sama dengan binding undangan. Jika invitee sudah mempunyai User Identity, sistem menautkan undangan ke identitas tersebut setelah autentikasi ulang yang sesuai; jangan membuat identitas duplikat.
6. Sebelum redemption, sistem menampilkan ringkasan perusahaan dan akses yang akan diterima. Invitee menyetujui undangan; backend memvalidasi token, expiry, status tenant, binding email, kapasitas penerbit, snapshot konfigurasi, serta kebijakan saat redemption.
7. Redemption atomik mengubah Invitation menjadi `REDEEMED`, membuat/mengaktifkan Company Membership sesuai kebijakan, dan menerapkan persona/role/permission/project scope/authority yang sudah disetujui. Jika policy tenant memerlukan pemeriksaan pasca-redemption, membership tetap `PENDING` sampai keputusan eksplisit; selain itu membership menjadi `ACTIVE` pada transaksi redemption yang sama. Tidak boleh ada kondisi parsial di mana token habis tetapi membership/assignment gagal tanpa mekanisme transaksi/kompensasi yang aman.
8. Semua perubahan setelah RFIN-B diterbitkan dilakukan melalui revisi undangan (revoke undangan lama dan terbitkan yang baru) atau perubahan assignment setelah membership aktif. Snapshot historis undangan tidak boleh ditimpa.

Lifecycle Invitation: `DRAFT → ACTIVE → REDEEMED`, dengan cabang `REVOKED` atau `EXPIRED`. Hanya `ACTIVE` yang dapat diredeem. Lifecycle Membership terpisah: `PENDING → ACTIVE`, atau `SUSPENDED`, `REVOKED`, `EXPIRED` sesuai policy. `REDEEMED` adalah status Invitation, bukan Membership. Invitation yang `REDEEMED` tidak dapat dipakai lagi. Pengiriman ulang menggunakan token baru atau mekanisme delivery ulang yang tidak mengekspos token lama; penerbitan ulang membatalkan token sebelumnya.

RFIN-B tidak memberikan Company Super Admin atau Platform Super Admin, tidak melampaui permission/authority penerbit, tidak menggantikan autentikasi, dan bukan password. Company Super Admin dapat mengubah, menangguhkan, atau mencabut membership setelah aktif dalam batas policy. Pengguna undangan tidak otomatis memperoleh akses Console; kursi Company Super Admin tetap tunggal.

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

Registrasi Company adalah **Company Identity Registration**, bukan layanan pemerintah atau pengakuan bahwa ProyekCair telah mengesahkan status hukum perusahaan. Calon tenant mendaftar dengan NPWP dan autentikasi Google; nama perusahaan serta email kontak (business email atau Gmail) dicatat sebagai deklarasi. Identitas pemohon terpisah, akta pendirian, dan dokumen legal pemerintah bukan persyaratan standar.

- Setiap Company memiliki UUID internal stabil sebagai primary key.
- Data registrasi standar: NPWP, nama perusahaan, dan email kontak (business email atau Gmail). Identitas pemohon terpisah bukan field wajib.
- Autentikasi Google mengidentifikasi User Identity pengaju sebagai actor, bukan bukti kewenangan legal mewakili perusahaan.
- NPWP dinormalisasi dan diperiksa format/duplikasinya; digunakan untuk pencarian, pencocokan, pencegahan duplikasi, serta Company Lookup/Login Identifier khusus Company Super Admin. NPWP bukan password, secret, atau faktor autentikasi.
- Setelah submit status aplikasi `PENDING`; Platform Super Admin menerima notifikasi dan memutuskan `ACCEPTED` atau `REJECTED`. Selama belum diputuskan status tetap `PENDING`; tidak ada auto-activation.
- Keputusan Platform Super Admin adalah penerimaan/penolakan berdasarkan deklarasi, informasi tersedia, dan pemeriksaan platform. Ini bukan verifikasi legal independen, verifikasi pemerintah, atau KYC.
- Pemohon bertanggung jawab atas kebenaran, kelengkapan, dan hak penggunaan data yang dideklarasikan. Sistem mencatat pernyataan tanggung jawab, timestamp server, User Identity pengaju, dan versi teks deklarasi; ProyekCair tidak menjamin status legal perusahaan atau kewenangan perwakilan.
- Akta/dokumen legal pemerintah bukan persyaratan registrasi standar; persyaratan tambahan hanya melalui perubahan kebijakan eksplisit.
- NPWP merupakan data sensitif bisnis: akses dibatasi, dienkripsi sesuai klasifikasi, dimasking di UI, tidak dicatat penuh di log, dan perubahan/akses penting diaudit. Nilai ternormalisasi memiliki unique constraint.
- Perubahan NPWP atau field identitas tenant platform-controlled diajukan Company Super Admin melalui Console dan berlaku setelah keputusan Platform Super Admin melalui Platform Administration Engine.
- Company Application, Company/Tenant, kursi Company Super Admin, dan Company Membership adalah lifecycle terpisah.

## 4.1 Identitas kepegawaian dan employee_number

Employee Record adalah data kepegawaian tambahan conditional/optional, bukan daftar seluruh karyawan. Perusahaan membuatnya hanya jika diperlukan untuk proses operasional seperti employee_number, atribut kepegawaian, assignment tertentu, atau histori. Employee Record bukan syarat Company Membership, persona, role, permission, project scope, approval, ataupun final signing. Final signatory dapat ditunjuk tanpa Employee Record.

- `user_id` adalah ID identitas autentikasi global orang tersebut.
- `company_id` adalah ID internal tenant/perusahaan.
- `employee_id` adalah ID internal record kepegawaian orang tersebut di satu perusahaan.
- `employee_number` adalah Nomor Induk Karyawan (Employee Number) yang ditetapkan atau diberikan oleh perusahaan masing-masing. Nilainya diinput/dikelola melalui administrasi perusahaan, bukan dibuat otomatis oleh ProyekCair.
- Format `employee_number` mengikuti sistem perusahaan, misalnya `00125`, `MM-00125`, atau `EMP/OPS/025`; format tidak diasumsikan seragam.
- Terapkan keunikan `UNIQUE(company_id, employee_number)`. Nilai yang sama boleh digunakan oleh perusahaan berbeda.
- `employee_number` bukan username, password, secret, atau kredensial autentikasi.
- Satu User Identity yang bekerja dengan persona operasional atau memegang kewenangan CRUD/TTE QR pada beberapa perusahaan harus memiliki Company Membership aktif dan persona yang ditetapkan Company Super Admin pada **setiap perusahaan** tersebut. Employee Record dan employee_number dibuat terpisah pada setiap perusahaan sesuai kriteria Employee Record di atas; satu User Identity global tidak menggantikan membership atau penugasan perusahaan.
- Pegawai yang keluar tidak dihapus secara fisik jika telah memiliki histori; statusnya diakhiri/nonaktif dan histori dipertahankan.
- Perubahan employee_number, status kepegawaian, jabatan, departemen, atasan, dan penempatan harus memiliki histori.

**Aturan auto-generation ID:** seluruh identifier teknis/internal ProyekCair dibuat otomatis oleh aplikasi/backend/database dan tidak dipilih pengguna. Ini mencakup `user_id`, `company_id`, `employee_id`, `persona_id`, `position_id`, `department_id`, `project_id`, `role_id`, `permission_id`, `workflow_id`, `workflow_step_id`, `audit_event_id`, serta ID internal entitas lainnya. Gunakan UUID sebagai default identifier internal. Pengecualian yang disepakati adalah `employee_number`, yang berasal dari perusahaan. Nomor dokumen/transaksi yang mudah dibaca (misalnya `INV-2026-00001`) boleh dibuat otomatis sebagai business/display number, tetapi bukan pengganti UUID primary key.

Relasi antartabel menggunakan UUID internal, bukan employee_number sebagai foreign key. Satu user_id dapat terhubung ke beberapa Employee Record melalui Company Membership berbeda.

## 5.1 Jabatan, label approval, dan penugasan individu

**Mandatory scope:** Individual Assignment, Persona, Role, Permission, Authority, Project Membership/Scope, dan Workflow. Employee Record dan label jabatan conditional/optional. Organization Structure Builder bukan fitur inti. Department/division metadata, bagan organisasi, relasi atasan-bawahan, serta struktur Head Office/proyek bukan dependensi authorization dan berada dalam kategori optional/future.

Perusahaan dapat menetapkan penugasan per individu secara langsung: persona, role/permission, label jabatan atau approval level, authority, project scope, dan masa berlaku. Label jabatan/level dapat dipilih dari preset platform lalu disesuaikan dengan istilah internal perusahaan. Preset tidak otomatis memberikan permission, authority, atau akses proyek.

Contoh tingkatan/preset yang dapat disediakan katalog platform (bukan urutan wajib dan bukan pemberian hak otomatis): Staff, Foreman, Supervisor, Superintendent, Assistant Manager, Manager, General Manager, KTT/Project Manager, Director, dan CEO. Perusahaan dapat memakai label yang relevan, mengganti nama, atau menambahkan label internal. Setiap keputusan tetap dievaluasi berdasarkan assignment dan policy yang konkret.

Struktur organisasi lengkap dapat dipertimbangkan sebagai fitur opsional di masa depan melalui keputusan cakupan terpisah; ia tidak menjadi dependensi untuk membership, project scope, workflow, authority, atau TTE/QR.

**Optional conceptual reference — bukan model operasional atau mandatory scope.** Contoh struktur proyek lapangan:
```text
Direktur / CEO
└── Manager / KTT / Project Manager
    └── Superintendent
        └── Supervisor
            └── Foreman
                └── Worker
```

**Optional conceptual reference — bukan model operasional atau mandatory scope.** Contoh struktur Head Office:
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
- Penempatan karyawan dapat berbeda menurut perusahaan, departemen, proyek, lokasi, dan periode.- Atasan langsung dan rantai pelaporan disimpan sebagai relasi organisasi dengan effective date, bukan disimpulkan hanya dari nama jabatan.- Posisi direktur dengan lingkup berbeda (misalnya Direktur Operasional dan Direktur Keuangan) harus dapat dibedakan.
- Perubahan struktur, jabatan, departemen, atasan, atau penempatan tidak boleh mengubah snapshot histori aktivitas terdahulu.

### Pembedaan jabatan, persona, role, permission, dan authority

- **Jabatan/position:** kedudukan struktural, misalnya Supervisor atau Superintendent.
- **Persona:** kapasitas/konteks saat menggunakan ProyekCair, misalnya Supervisor Proyek A.
- **Role:** bundel permission aplikasi, misalnya Inventory Reviewer.
- **Permission:** tindakan teknis atomik, misalnya `inventory.mutation.review`.
- **Authority:** batas kewenangan bisnis, misalnya persetujuan transaksi sampai nominal tertentu.

Jabatan Supervisor tidak otomatis memberikan semua permission Supervisor, kewenangan persetujuan tanpa batas, atau akses ke seluruh proyek. Otorisasi tetap mengikuti membership, persona, role, permission, authority, atribut, relasi, dan project scope.

## 5.2 Workflow pemeriksaan dan persetujuan berjenjang

ProyekCair mendukung workflow configurable, bukan rantai jabatan permanen. Alur dapat berbeda menurut jenis transaksi/dokumen, proyek/scope, nilai/nominal, kategori, risiko, atribut individual, dan policy. Department/jabatan hanya metadata/filter opsional bila digunakan perusahaan.

Contoh alur proyek lapangan:
```text
Worker / Foreman
    → Supervisor (input/pemeriksaan)
    → Superintendent (review/verifikasi)
    → Manager / KTT / Project Manager (persetujuan sesuai authority)
    → Selesai
```

Tahap dapat berupa draft, submit, review, verify, approve, reject, return for revision, resubmit, dan close. Tidak semua proses harus melewati semua jabatan. Head Office dapat memiliki approval chain berbeda. Workflow memeriksa Workflow Initiator Permission, Approver Eligibility Pool, membership, permission, authority, project/resource scope, status aktif, dan policy; jabatan/relasi organisasi bukan prasyarat.

Setiap workflow instance dan step memiliki ID internal auto-generated. Setiap keputusan tahap menyimpan aktor, user_id, company_id, employee_id, employee_number saat itu (jika tersedia), persona aktif, snapshot jabatan/position, departemen, proyek, tindakan, waktu, catatan/alasan, hasil, SLA/due date, dan referensi dokumen/transaksi. Pengulangan tahap menghasilkan event baru; histori tahap sebelumnya tidak ditimpa. Tahap approval dan eksekusinya bersifat serial; **notifikasi kepada seluruh approver yang tercantum dalam rangkaian dapat dikirim secara paralel sejak workflow dimulai** agar mereka dapat saling mengingatkan dan mempersiapkan pemeriksaan. Notifikasi paralel tidak mengubah urutan eksekusi, status aktif, atau hak bertindak.

Contoh kategori workflow: laporan progres harian/mingguan, permintaan dan pengeluaran material, transaksi keuangan/pengajuan pembayaran, laporan K3, dokumen resmi, dan perubahan BOQ. Workflow Builder harus dibatasi katalog permission dan guardrail platform.

### 5.2.1 Persetujuan berurutan, penandatangan akhir, dan QR

Persetujuan dokumen/data mengikuti **alur eksekusi serial (berurutan)** berdasarkan urutan approver yang ditentukan untuk dokumen tersebut dan aturan workflow yang berlaku. Eksekusi approval paralel tidak diperbolehkan. **Notifikasi kepada semua approver dalam rangkaian dikirim secara paralel** agar mereka mengetahui adanya dokumen dan dapat saling mengingatkan; notifikasi bukan aktivasi hak approval. Pengguna pada tahap berikutnya dapat melihat dokumen secara read-only sesuai akses, tetapi tindakan persetujuan hanya dibuka ketika gilirannya aktif dan seluruh tahap sebelumnya selesai.

- Setiap tahap yang diwajibkan harus ditindaklanjuti satu per satu sesuai urutan yang dipilih untuk dokumen tersebut. Pembuat/pengaju dokumen dapat menetapkan rangkaian approver dan jumlah tahap yang diperlukan (misalnya dua atau empat orang) sesuai proses perusahaan; template workflow boleh disediakan untuk mempercepat pemilihan. Urutan yang dipilih tidak boleh melewati validasi membership, permission, authority, project/resource scope, status aktif, dan aturan dokumen. Tidak ada keharusan membangun bagan organisasi terlebih dahulu untuk memilih approver.
- ProyekCair tidak melakukan verifikasi identitas legal/kenegaraan atau KYC independen terhadap final signatory sebagai prasyarat fitur. Tanggung jawab memastikan siapa orang tersebut, kapasitas internalnya, dan kelayakan penunjukannya berada pada perusahaan melalui proses internalnya. ProyekCair mengandalkan User Identity yang telah berhasil login dan status Company Membership aktif yang didaftarkan/dikelola Company Super Admin; anggota perusahaan mana pun dapat ditunjuk, tanpa syarat jabatan atau kelas pekerjaan tertentu (termasuk pekerja lapangan atau petugas kebersihan), sepanjang perusahaan memilihnya. Jangan meminta atau menyimpan NIK/KTP/alamat KTP sebagai persyaratan platform untuk final signatory. Keputusan perusahaan menunjuk orang tersebut harus tercatat dan dapat diaudit.
- Email dan kanal notifikasi yang terdaftar digunakan untuk pemberitahuan di luar aplikasi, termasuk pemberitahuan bahwa pengguna diminta meninjau/menyetujui dokumen, dokumen yang telah ditandatangani kemudian dibatalkan, atau perubahan status penting lainnya. Untuk setiap dokumen, seluruh approver yang telah ditetapkan menerima notifikasi secara paralel (fan-out) saat workflow memulai proses pemberitahuan; reminder dan eskalasi mengikuti SLA. Notifikasi memuat referensi dokumen dan instruksi meninjau konteks/riwayat; jangan mengirim data pribadi atau isi dokumen sensitif secara berlebihan.
- Pengguna pada tahap aktif meninjau dokumen/data, lalu melakukan tindakan eksplisit melalui aplikasi: approve/agree, reject, atau return for revision sesuai hak dan kebijakan. Klik persetujuan merupakan persetujuan elektronik internal yang tercatat; bukan tanda tangan QR.
- **QR/tanda tangan pengesahan hanya diterbitkan oleh penandatangan akhir (final signatory)** setelah seluruh tahap persetujuan serial selesai. Tidak semua reviewer/approver membubuhkan tanda tangan QR.
- Manager / KTT / Project Manager dapat ditampilkan sebagai suggested preset, bukan default appointment. Final signatory selalu ditunjuk eksplisit Company Super Admin; tanpa appointment aktif sesuai scope, signing ditolak.
- **Company Super Admin dapat meng-custom penunjukan final signatory** melalui Company Console berdasarkan perusahaan, jenis dokumen/formulir/kontrak, proyek, departemen, unit, atau scope lain yang diizinkan policy. Konfigurasi dapat menunjuk orang yang berbeda untuk jenis dokumen atau scope yang berbeda; tidak harus selalu pemegang jabatan default.
- Final signatory wajib memiliki User Identity terautentikasi, Company Membership `ACTIVE` pada tenant, dan appointment eksplisit aktif dari Company Super Admin untuk jenis dokumen/scope tertentu.
- Membership aktif + appointment eksplisit aktif/sesuai scope merupakan dasar otorisasi bisnis yang cukup untuk final signing. Tidak disyaratkan persona, Employee Record, jabatan, senioritas, department, approval level, atau authority tambahan. QR scan/verifikasi tetap permission terpisah.
- Backend memvalidasi tenant/dokumen, appointment/scope, penyelesaian seluruh approval serial, versi final, dan lifecycle BATAL/GANTI. Ini kontrol integritas dokumen, bukan persyaratan kepegawaian/jabatan.
- **Satu orang dapat menjadi final signatory di beberapa perusahaan dengan satu User Identity global**, tetapi pada setiap perusahaan ia wajib memiliki Company Membership aktif dan penunjukan terpisah oleh Company Super Admin perusahaan tersebut. Membership pada PT A tidak memberikan hak di PT B atau PT C.
- Konsep **Pihak Terkait** dalam ProyekCair dibatasi pada pengguna internal perusahaan yang memenuhi syarat akun, membership, dan Employee Record sebagaimana di atas. Istilah ini digunakan untuk konfigurasi pihak yang diberi kewenangan TTE/pengesahan QR, bukan untuk mencatat pihak eksternal tanpa akses aplikasi. Konsep ini tetap berbeda dari **Orang Terkait**, yaitu relasi legal/kepemilikan/manfaat; fitur Orang Terkait tidak termasuk aplikasi.
- **Batas cakupan saat ini: Orang Terkait TIDAK diimplementasikan di web app ProyekCair ini.** Fitur, modul, registri, UI, API, dan skema operasional untuk mengelola Orang Terkait bukan bagian dari implementasi aplikasi ini. ProyekCair pada tahap ini hanya memodelkan penunjukan Pihak Terkait untuk kebutuhan kewenangan dan final signatory. Jangan membangun atau menampilkan fitur Orang Terkait dalam web app ini kecuali ada keputusan dan perubahan cakupan yang secara eksplisit disetujui kemudian.
- Orang Terkait pada dasarnya adalah data hubungan legal/kepemilikan/manfaat antara seseorang dan perusahaan dan tetap di luar cakupan web app ProyekCair. Tidak ada registri atau modul Orang Terkait dalam aplikasi ini. Ketentuan konseptual mengenai Orang Terkait tidak dapat digunakan sebagai jalur alternatif untuk membuat pihak eksternal menjadi final signatory.
- Seseorang yang menjadi final signatory di beberapa perusahaan menggunakan satu User Identity global dan wajib memiliki Company Membership aktif serta penunjukan terpisah oleh Company Super Admin di masing-masing perusahaan.
- Contoh konseptual: seseorang yang memiliki otoritas menandatangani dokumen tertentu melalui Coretax pada beberapa perusahaan dapat dianalogikan sebagai pihak yang ditunjuk masing-masing Company Super Admin ProyekCair untuk mengesahkan jenis dokumen tertentu pada tenant mereka. **Coretax hanya contoh pola penunjukan lintas perusahaan; ProyekCair tidak mengklaim integrasi, afiliasi, atau kesetaraan kewenangan perpajakan dengan Coretax/DJP.**
- Penunjukan lintas perusahaan tidak memberikan akses otomatis ke tenant lain, tidak memperluas kewenangan ke semua dokumen, dan tidak menggantikan proses persetujuan serial internal perusahaan. Otoritas final signatory selalu spesifik pada perusahaan dan scope penunjukannya.
- Penetapan, perubahan, penangguhan, pencabutan, dan penggunaan kewenangan final signatory wajib dicatat dalam audit trail, termasuk pihak yang menunjuk, pihak yang ditunjuk, tenant, jenis dokumen, scope, authority, masa berlaku, dan waktu tindakan.
- Final signatory baru dapat melakukan pengesahan setelah seluruh tahap persetujuan serial yang diwajibkan selesai dan dokumen berada pada versi final yang disetujui. QR harus terikat pada dokumen/versi final, identitas penandatangan, waktu pengesahan, dan mekanisme verifikasi privat untuk pengguna yang berwenang. QR/TTE merupakan FYEO/Privat untuk kebutuhan B2B; tidak menyediakan pemindaian atau verifikasi publik tanpa autentikasi dan otorisasi tenant.
- Perubahan atau pembatalan dokumen setelah diterbitkan/ditandatangani tidak boleh menghapus histori atau mengubah dokumen lama secara diam-diam. Untuk lifecycle dokumen, gunakan event/status **BATAL** (membatalkan dokumen/versi yang berlaku) dan **GANTI** (menerbitkan dokumen pengganti yang merujuk dokumen yang dibatalkan), mengikuti prinsip jejak faktur Coretax sebagai analogi pencatatan. Dokumen lama, versi, QR, alasan pembatalan, pelaku, waktu, dan relasi ke dokumen pengganti tetap tersimpan serta dapat diaudit. QR pada dokumen yang berstatus BATAL harus ditampilkan tidak berlaku; dokumen pengganti menjalani workflow dan pengesahan sesuai ketentuan.
- Istilah BATAL/GANTI adalah aturan lifecycle dokumen ProyekCair, bukan klaim bahwa dokumen ProyekCair merupakan faktur pajak atau terintegrasi dengan Coretax.
- QR merupakan bukti verifikasi/pengesahan dokumen dalam ProyekCair; jangan menyebutnya tanda tangan elektronik tersertifikasi atau mengklaim kekuatan hukum tertentu kecuali integrasi dan persyaratan hukum terkait benar-benar dipenuhi.

### 5.2.2 SLA tindakan, notifikasi, dan eskalasi

Setiap tahap workflow yang membutuhkan tindakan harus memiliki batas waktu/SLA yang ditetapkan oleh template atau konfigurasi workflow. SLA dapat berbeda menurut jenis dokumen/transaksi dan urgensi, misalnya maksimal 1 hari, 2 hari, atau 1 minggu.

- Initial notification kepada seluruh approver dikirim paralel saat workflow dimulai dan tidak mengaktifkan step. Saat step menjadi aktif, actionable notification dikirim kepada approver step itu dan SLA clock dimulai pada timestamp aktivasi server; reminder/escalation dihitung dari SLA step aktif.
- Dashboard dan daftar tugas menampilkan status menunggu tindakan, prioritas, due date, serta indikator terlambat.
- Pengingat dikirim sebelum tenggat dan/atau saat tenggat terlewati sesuai kebijakan notifikasi.
- Jika tenggat terlewati, aplikasi menandai overdue dan menjalankan aturan eskalasi yang telah dikonfigurasi, misalnya mengingatkan atasan/level berikutnya atau administrator terkait. Eskalasi tidak boleh diam-diam dianggap sebagai persetujuan otomatis.
- Initial notification dikirim paralel kepada seluruh approver untuk awareness. Hanya approver pada step aktif yang boleh approve/reject/return; notifikasi tidak membuka hak tindakan sebelum gilirannya, kecuali delegasi/pengganti resmi tervalidasi. SLA setiap step dimulai saat step aktif; reminder/escalation mengikuti SLA tersebut.
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

Satu User Identity dapat memiliki Company Membership di beberapa perusahaan secara bersamaan. **Membership dan persona tidak diwariskan otomatis antarperusahaan**: Company Super Admin masing-masing perusahaan harus mengundang/mengaktifkan identitas tersebut, membuat membership, dan menetapkan satu atau beberapa persona sesuai kebutuhan dan policy perusahaan.

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
1. **Company Super Admin:** melalui permohonan/proses registrasi perusahaan, pemeriksaan identitas perusahaan sesuai model Company Identity Registration (nama, NPWP, business email, identitas pemohon, dan pernyataan kebenaran), serta provisioning satu kursi administrator oleh Platform Super Admin. Pemeriksaan tersebut bukan klaim verifikasi legal independen kecuali proses independen memang dilakukan. NPWP menjadi identifier perusahaan; kode aktivasi perusahaan yang unik digunakan untuk mengklaim kursi tersebut dan kemudian diikat ke User Identity personal yang terverifikasi.
2. **Pengguna anggota perusahaan:** melalui invitation yang dibuat Company Super Admin dari Company Console. Undangan ini memberikan membership dan role/persona/authority sesuai konfigurasi, tetapi tidak pernah memberikan kursi Company Super Admin.

Tidak ada pendaftaran publik yang otomatis membuat tenant aktif atau memberikan hak Company Super Admin.

### 6.2 Alur provisioning Company Super Admin

1. Perusahaan menghubungi pemilik/operator ProyekCair melalui kanal resmi.
2. Platform meninjau data Company Identity Registration (nama perusahaan, NPWP, business email, identitas pemohon, dan pernyataan kebenaran), melakukan pemeriksaan format/kelengkapan/duplikasi yang tersedia, serta memastikan belum ada kursi Company Super Admin aktif. Langkah ini tidak boleh disebut verifikasi legal pemerintah atau verifikasi independen jika tidak dilakukan.
3. Platform membuat tenant (jika belum ada) dan satu kursi Company Super Admin.
4. Platform menerbitkan kode aktivasi perusahaan; nilai kode hanya ditampilkan/disampaikan sekali dan hash-nya disimpan.
5. Perwakilan yang disetujui login dengan identitas personal terverifikasi, memasukkan NPWP sebagai identifier perusahaan dan kode aktivasi, lalu menyelesaikan pengikatan identitas ke kursi tersebut.
6. Server memvalidasi kode, status, expiry, tenant tujuan, dan identitas penerima sesuai proses verifikasi.
7. Setelah sukses, kode dinonaktifkan dan identitas personal tersebut menjadi pemegang satu-satunya kursi Company Super Admin.
8. Semua aktivitas provisioning dan aktivasi dicatat pada audit platform dan histori tenant.

### 6.3 Alur pengguna anggota perusahaan

1. Pengguna login menggunakan Google atau email.
2. Server mengenali atau membuat User Identity berdasarkan identitas provider yang tervalidasi.
3. Pengguna menerima RFIN-B/invitation dari Company Super Admin.\n4. Pengguna membuka undangan dan melakukan redeem menggunakan identitas personalnya.
5. Server memvalidasi kode, status, masa berlaku, batas penggunaan, perusahaan tujuan, dan ketentuan email/identitas penerima.6. Jika valid, server membuat atau mengaktifkan Company Membership dan memberikan persona/role/project scope/authority sesuai konfigurasi undangan.
7. Sistem mencatat penerimaan undangan dan perubahan membership ke audit trail.
8. Pengguna memilih perusahaan dan persona aktif untuk memulai pekerjaan.

### 6.4 Aturan invitation anggota perusahaan

Invitation/RFIN-B minimal memiliki: identifier internal, tenant tujuan, credential hash, issuer dan kewenangannya, User Identity/email recipient binding, persona assignment, role/permission awal, project scope/authority bila relevan, Workflow Initiator Permission/Approver Eligibility Pool bila diizinkan, expiry, usage limit, redemption policy, status `PENDING/ACTIVE`, `REDEEMED`, `REVOKED`, atau `EXPIRED`, serta waktu dan User Identity penerima saat redemption.

`REDEEMED` adalah status Invitation, bukan Membership. Redemption sukses membuat/mengaktifkan Membership sesuai policy. Membership `ACTIVE` berarti relasi keanggotaan berlaku; Membership `PENDING` hanya bila ada persetujuan tambahan setelah redemption. Jangan gunakan Membership `INVITED` untuk undangan belum diterima.

**Effective Access Preview:** sebelum penerbitan, Console menampilkan recipient binding, tenant, persona, role/permission, project scope, authority, Workflow Initiator Permission/Approver Eligibility Pool bila relevan, expiry, usage limit, dan redemption policy. Preview menunjukkan hak efektif, scope, batas authority, serta tindakan yang tidak diberikan.

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
- perusahaan menjadi pemilik suatu resource atau memiliki hubungan penunjukan kewenangan yang relevan terhadap resource tersebut.

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

### 8.1 RFIN Engine dan pengendalian akses RFIN

RFIN adalah keluarga credential aktivasi/invitation: RFIN-A untuk aktivasi kursi Company Super Admin setelah tenant diterima; RFIN-B untuk aktivasi membership melalui invitation Company Super Admin. RFIN bukan permission, authority, signing key, faktor login berulang, atau pengganti autentikasi User Identity.

- RFIN harus ditangani oleh **RFIN Engine** khusus, bukan sebagai field teks biasa atau sekadar kode yang diperiksa di frontend.
- RFIN terikat pada perusahaan/tenant dan konteks kewenangan yang ditetapkan: User Identity, Company Membership, persona, role/permission, authority, dan scope.
- Company Super Admin menetapkan secara eksplisit pengguna mana yang boleh melihat/mengakses informasi atau material RFIN, untuk perusahaan dan scope apa. Hak ini tidak otomatis diberikan kepada seluruh anggota, final signatory, approver, atau pemegang TTE/QR.
- Hak membaca/mengakses RFIN harus dibedakan dari hak membuat, menerbitkan, merotasi, mencabut, atau menggunakan RFIN. Setiap kemampuan merupakan permission terpisah dan hanya diberikan bila memang diperlukan.
- RFIN bukan password login, bukan NPWP, bukan pengganti autentikasi, dan tidak boleh dipakai sebagai shared credential untuk menghindari identifikasi aktor.
- Material rahasia/kriptografis RFIN tidak boleh disimpan atau dikirim sebagai plaintext, ditampilkan pada log, atau diekspos ke frontend tanpa kebutuhan yang sah. Engine wajib menerapkan kontrol kriptografi, tenant isolation, validasi server-side, proteksi secret/key, pencatatan penggunaan, serta prosedur rotasi dan pencabutan.
- Spesifikasi algoritma, format token, lifecycle key, custody, recovery, dan protokol kriptografi harus dirancang serta ditinjau tersendiri sebelum implementasi; SSOT ini menetapkan kebutuhan kontrol, bukan memilih algoritma atau format yang belum disepakati.

### 8.2 Permission terpisah untuk approval, TTE/QR, dan scan

Kemampuan berikut **tidak boleh digabung menjadi satu permission**:

- **Approval action** — mengklik/menjalankan persetujuan pada tahapan workflow yang menjadi giliran pengguna, sesuai persona, authority, dan scope.
- **TTE/QR signing** — melakukan pengesahan akhir atau penerbitan QR untuk dokumen final yang memenuhi seluruh prasyarat.
- **QR scan/verification** — memindai atau menjalankan verifikasi QR dan melihat hasil verifikasi/dokumen sesuai hak akses.
- **RFIN read/access** — membaca atau mengakses RFIN sesuai penetapan khusus Company Super Admin.
- **RFIN administration/use** — administrasi atau penggunaan fungsi RFIN yang harus diberikan terpisah sesuai kebutuhan.

Satu pengguna dapat diberi hak approval dan TTE/QR signing tetapi **tidak diberi dan tidak boleh menggunakan hak QR scan/verification**. Sebaliknya, hak scan/verifikasi tidak memberikan hak approval, TTE/QR signing, atau akses RFIN. Company Super Admin menetapkan kombinasi permission, tenant, jenis dokumen, proyek/departemen, dan scope yang berlaku untuk setiap pengguna.

Backend/API/RLS harus menegakkan pemisahan tersebut; menyembunyikan tombol scan pada UI tidak cukup. Endpoint scan/verifikasi harus memeriksa permission khusus document.qr.scan atau permission setara, membership aktif, persona/konteks, tenant, serta scope dokumen. Tidak boleh ada fallback ke endpoint publik yang memungkinkan pengguna tanpa hak membaca status atau isi dokumen.

### 8.3 TTE/QR sebagai layanan FYEO/Privat B2B

- TTE/QR ProyekCair bersifat **FYEO/Privat** untuk hubungan B2B. Pemindaian dan verifikasi hanya tersedia bagi User Identity yang telah terautentikasi dan diberi hak oleh perusahaan terkait.
- Tidak ada public QR verification page atau akses anonim yang mengungkap validitas, isi, metadata, atau status dokumen. Jika dibutuhkan pembagian dokumen kepada pihak lain, harus ada mekanisme berbagi privat yang eksplisit, terbatas, dapat dicabut, dan teraudit; bukan akses publik bawaan.
- QR mengacu pada dokumen/versi/hash yang disahkan. Perubahan atau event BATAL/GANTI membuat QR/endorsement versi lama ditandai tidak berlaku di dalam kanal verifikasi privat.
- Audit mencatat aktor dan permission yang digunakan untuk approval, signing, scan, dan verification secara terpisah.

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
Company Application memiliki status `PENDING`, `ACCEPTED`, `REJECTED`. `PENDING` berlangsung sampai Platform Super Admin memutuskan; notifikasi dikirim kepadanya. `REJECTED` tidak menghasilkan tenant aktif. `ACCEPTED` mengizinkan provisioning tenant dan kursi Company Super Admin, bukan otomatis membership anggota. Setelah provisioning, lifecycle tenant adalah `ACTIVE`, `SUSPENDED`, atau `CLOSED`. Review bukan verifikasi legal independen/KYC.

### 9.3 Membership
Status membership minimal:
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

Audit log merupakan catatan append-only yang dapat ditelusuri dan tidak dapat diubah atau dihapus oleh pengguna tenant melalui aplikasi. Koreksi atas kesalahan pencatatan dilakukan dengan event koreksi/kompensasi baru yang merujuk event asal, bukan dengan menimpa histori.

**Kendali perubahan data dan dokumen:** hak CRUD langsung atas data dan profil pihak TTE/QR hanya diberikan kepada persona/role yang secara eksplisit memiliki permission terkait dan scope yang sesuai. Perubahan profil pihak TTE/QR wajib diaudit. Untuk dokumen resmi yang telah diterbitkan atau ditandatangani, jangan menerapkan hard delete atau overwrite histori; perubahan status dilakukan melalui event **BATAL** dan/atau penerbitan dokumen pengganti **GANTI**, dengan seluruh versi dan relasi tetap terlacak.

Audit log untuk aktivitas sensitif minimal mencatat, sepanjang relevan dengan jenis event:
- ID event audit yang unik dan dibuat oleh sistem;
- waktu kejadian (timestamp) yang ditetapkan server, serta waktu penerimaan/pemrosesan bila berbeda;
- actor User Identity (`user_id`) dan identitas autentikasi/provider yang relevan tanpa menyimpan token atau secret;
- company/tenant (`company_id`) dan project/resource scope yang relevan;
- Employee Record (`employee_id`, `employee_number`) jika tersedia dan relevan; ketiadaan Employee Record tidak boleh diisi dengan data rekaan;
- persona aktif, role/permission efektif, dan authority/scope yang digunakan saat tindakan;
- jenis event, nama aksi, objek/resource yang terdampak, dan ID objek;
- hasil tindakan (berhasil/ditolak/gagal), status sebelum dan sesudah bila relevan;
- perubahan nilai sebelum/sesudah untuk field penting, dengan redaksi atau pengecualian bagi secret, token, kredensial, dan data sensitif yang tidak perlu disalin;
- alasan/catatan wajib untuk tindakan berisiko tinggi, koreksi, void, revoke, override, delegasi, dan perubahan kewenangan;
- sumber tindakan (misalnya UI, API, RPC, proses sistem) dan correlation/request ID bila tersedia;
- alamat IP, user-agent, dan metadata keamanan lain hanya jika diperlukan, proporsional, dan sesuai kebijakan privasi/retensi.

Untuk workflow dan pengesahan dokumen, audit juga harus mencatat:
- workflow instance/step, urutan tahap, aktor yang bertindak, keputusan, catatan, dan waktu;
- SLA/due date yang berlaku pada saat tahap dimulai, reminder, escalation, delegation/substitution, serta alasan keterlambatan;
- penunjukan final signatory: pihak yang menunjuk, pihak yang ditunjuk, tenant, jenis dokumen, scope, authority, masa berlaku, status, dan histori perubahan;
- final signing event: identitas penandatangan, versi/hash dokumen yang disahkan, waktu pengesahan, identitas QR/verifikasi, serta status validitas pengesahan;
- verification/scan event privat: waktu, User Identity, membership, persona, permission, tenant, referensi dokumen/versi, hasil pemeriksaan, dan kanal verifikasi; akses serta hasilnya tidak boleh membocorkan data kepada pihak yang tidak berwenang.

Audit wajib mencakup sekurang-kurangnya login dan kegagalan akses yang relevan, provisioning/aktivasi Company Super Admin, invitation dan redemption, perubahan membership/persona/role/permission/authority, perubahan struktur organisasi dan penempatan, CRUD/import/export, transaksi, approval/rejection/return, penerbitan/revisi/pembatalan dokumen, final signing, verifikasi QR, serta tindakan administratif Platform Owner.

Akses baca audit log juga harus dibatasi berdasarkan tenant dan kewenangan. Platform-level audit dapat diakses hanya oleh otoritas platform yang berwenang. Retensi, ekspor, dan perlindungan integritas audit harus ditetapkan melalui kebijakan platform. Jangan menyimpan password, kode aktivasi plaintext, token sesi, secret, atau data autentikasi sensitif dalam audit log.

## 13. Model pengguna umum dan Personal Workspace

### 13.1 Keputusan produk: Model B — Personal Workspace

Proyek Cair mendukung penggunaan umum/mandiri di luar konteks perusahaan. Pengguna dapat mendaftar langsung menggunakan Google/email yang didukung tanpa RFIN dan tanpa undangan perusahaan. Setelah autentikasi berhasil, sistem dapat membuat atau menghubungkan satu User Identity dan menyediakan **Personal Workspace** bagi identitas tersebut.

Personal Workspace adalah ruang kerja pribadi untuk mengelola proyek dan aktivitas milik pengguna. Personal Workspace:
- dimiliki oleh satu User Identity;
- bukan Company/Tenant dan bukan Company Workspace;
- tidak memiliki NPWP atau status legal perusahaan;
- tidak memperoleh Company Membership secara otomatis;
- tidak memperoleh Company Super Admin, akses Console perusahaan, kewenangan organisasi, atau final-signatory appointment;
- tidak dapat mengakses data Company Workspace tanpa Company Membership aktif dan otorisasi yang sah;
- pada tahap awal bersifat single-owner: hanya pemilik User Identity yang dapat mengaksesnya. Kolaborasi/berbagi dengan pengguna lain belum termasuk cakupan awal dan memerlukan desain sharing, ACL/relasi, audit, serta kontrol pencabutan tersendiri.

Registrasi umum tidak menggunakan RFIN-A maupun RFIN-B. Google/email tetap menjadi mekanisme autentikasi. RFIN hanya digunakan pada proses perusahaan yang telah ditetapkan dalam bagian RFIN.

### 13.2 Satu identitas untuk konteks personal dan perusahaan

Satu User Identity dapat memiliki Personal Workspace sekaligus menjadi anggota satu atau beberapa Company/Tenant. Ketika identitas personal yang sama menerima dan menukarkan RFIN-B/invitation yang valid, sistem mengaktifkan Company Membership pada identitas yang sudah ada; sistem tidak boleh membuat akun/identitas duplikat hanya karena pengguna berpindah dari penggunaan personal ke perusahaan.

Personal Workspace tetap ada setelah Company Membership aktif. Bergabung dengan perusahaan tidak otomatis mengonversi, menghapus, memindahkan, atau menggabungkan data Personal Workspace ke Company Workspace. Demikian pula, kepemilikan Personal Workspace tidak memberikan hak atas data perusahaan.

Pengguna memilih konteks aktif secara eksplisit, misalnya Personal Workspace atau Company Workspace tertentu. Context switch hanya mengubah konteks kerja yang diminta; bukan proses pemberian privilege. Backend wajib memvalidasi ulang kepemilikan Personal Workspace atau Company Membership, persona, role, permission, authority, dan scope pada setiap operasi yang dilindungi.

### 13.3 Pembedaan Workspace

| Aspek | Personal Workspace | Company Workspace |
|---|---|---|
| Pemilik | Satu User Identity | Satu Company/Tenant |
| Cara memperoleh | Dibuat setelah signup Google/email yang berhasil | Melalui registrasi/provisioning perusahaan sesuai kebijakan platform |
| Identitas perusahaan/NPWP | Tidak ada | Ada sesuai proses verifikasi perusahaan |
| Membership | Tidak membutuhkan Company Membership | Memerlukan Company Membership aktif untuk pengguna operasional |
| Persona/role/authority perusahaan | Tidak ada secara default | Diberikan sesuai kebijakan perusahaan dan platform |
| Company Console | Tidak tersedia | Hanya untuk satu Company Super Admin aktif sesuai aturan |
| RFIN | Tidak digunakan untuk signup personal | RFIN-A untuk aktivasi Company Super Admin; RFIN-B untuk undangan anggota |
| Isolasi data | Terikat pada pemilik Personal Workspace | Terikat pada tenant dan scope perusahaan |
| Kolaborasi | Tidak tersedia pada tahap awal | Mengikuti Company Membership dan otorisasi |

Personal Workspace dapat menggunakan fitur personal yang secara eksplisit disediakan oleh platform. Ketersediaan modul, kuota, kapasitas, retensi, dan paket layanan personal merupakan kebijakan produk/komersial tersendiri; keberadaan Personal Workspace tidak berarti seluruh fitur perusahaan tersedia gratis atau otomatis.

### 13.4 Isolasi dan keamanan Personal Workspace

1. Setiap resource personal harus memiliki relasi kepemilikan yang jelas ke User Identity atau Personal Workspace.
2. Query dan mutasi personal hanya boleh mengakses resource yang dimiliki identitas tersebut.
3. Personal Workspace harus dipisahkan dari tenant perusahaan pada model data, query, API, dan RLS. Jangan menggunakan Company ID fiktif untuk mewakili workspace personal.
4. Jangan menganggap user_id, workspace_id, atau context yang dikirim client sebagai bukti kepemilikan. Server/database harus memverifikasi relasinya.
5. Company Membership tidak boleh disimpulkan dari kepemilikan Personal Workspace, email domain, NPWP, atau status Company Readiness.
6. Personal Workspace tidak boleh menerbitkan RFIN-A/RFIN-B, membuat Company Super Admin, mendaftarkan Company Workspace secara otomatis, atau mengangkat final signatory perusahaan.
7. Penghapusan, penutupan, ekspor, pemulihan, dan retensi data Personal Workspace harus mengikuti kebijakan platform yang eksplisit dan teraudit.
8. Jika kelak kolaborasi personal diaktifkan, fitur itu memerlukan desain terpisah untuk undangan, resource sharing, ACL/relationship, expiry/revocation, audit, dan batas data; jangan mengandalkan penambahan kolom owner atau berbagi URL saja.

## 14. Personal-to-Company Growth Journey

### 14.1 Prinsip

Proyek Cair dapat menyediakan jalur pertumbuhan pengguna dari penggunaan individu menuju penggunaan organisasi. Personal Workspace menjadi titik masuk penggunaan umum, sementara Company Workspace tetap merupakan entitas organisasi yang terpisah dan tunduk pada verifikasi serta proses provisioning perusahaan.

Alur konseptual:

1. **Personal** — pengguna mendaftar dengan Google/email dan menggunakan Personal Workspace.
2. **Growing** — pola penggunaan menunjukkan aktivitas atau kebutuhan yang berkembang. Ini merupakan indikator produk, bukan role atau status hukum.
3. **Company Ready** — sinyal penggunaan menunjukkan kemungkinan kebutuhan tata kelola, kolaborasi, pelaporan, atau kontrol organisasi.
4. **Company Offer** — platform dapat menampilkan penawaran/informasi untuk mengeksplorasi penggunaan Proyek Cair dalam konteks perusahaan.
5. **Company Onboarding** — jika pengguna berminat, proses registrasi dan verifikasi perusahaan dijalankan sesuai kebijakan platform.
6. **Company Activation** — setelah perusahaan disetujui, Platform Super Admin menerbitkan RFIN-A untuk aktivasi satu kursi Company Super Admin. Company Super Admin selanjutnya dapat mengundang anggota melalui RFIN-B.

Status Personal, Growing, dan Company Ready adalah status segmentasi/indikator kesiapan produk, bukan jabatan, persona, role, permission, authority, Company Membership, atau bukti legalitas perusahaan. Status tersebut tidak boleh digunakan sebagai dasar untuk memberikan akses tenant atau privilege.

### 14.2 Company Readiness

Platform dapat menghitung atau menilai indikator kesiapan penggunaan perusahaan, misalnya:
- konsistensi/intensitas penggunaan;
- jumlah dan kompleksitas proyek yang dikelola;
- kebutuhan kapasitas atau pelaporan yang meningkat;
- kebutuhan kolaborasi lebih dari satu pengguna;
- kebutuhan workflow, review, approval, audit, dan pembagian kewenangan;
- sinyal kebutuhan bisnis lain yang relevan.

Indikator, ambang batas, bobot, dan metode penilaian belum ditetapkan dalam SSOT ini. Penilaian harus proporsional, transparan pada tingkat yang sesuai, menghormati kebijakan privasi, dan tidak menyimpulkan status legal perusahaan hanya dari perilaku penggunaan. Hindari keputusan otomatis yang berdampak pada pembatasan hak pengguna.

Company Readiness adalah sinyal rekomendasi produk, bukan keputusan kelayakan hukum atau persetujuan perusahaan.

### 14.3 Company Offer

Company Offer adalah komunikasi/penawaran produk dari platform kepada pengguna Personal Workspace untuk mengeksplorasi atau memulai onboarding Company Workspace.

Aturan:
- Company Offer dapat dipicu oleh indikator Company Readiness atau ditampilkan melalui kanal promosi produk yang disetujui.
- Penawaran bersifat informatif dan sukarela, bukan paksaan.
- Pengguna dapat memilih untuk mengeksplorasi penawaran atau menundanya/menolaknya.
- Menerima, membuka, atau mengklik Company Offer tidak membuat Company/Tenant, Company Membership, Company Super Admin, persona, role, permission, authority, atau akses Console.
- Company Offer bukan RFIN dan tidak menggantikan RFIN-A/RFIN-B.
- Penawaran harus menjelaskan bahwa penggunaan perusahaan memerlukan proses registrasi/verifikasi dan aktivasi resmi.
- Frekuensi, kanal, preferensi komunikasi, dan penghentian penawaran harus mengikuti kebijakan produk dan privasi platform.
- Status penawaran dan respons pengguna dapat dicatat untuk analitik produk secara proporsional; jangan menyimpan data sensitif yang tidak diperlukan.

Contoh pesan produk (copy dapat berubah dan bukan kontrak API):

> **Your projects are growing. Is it time to work as a company?**
>
> Aktivitas Anda menunjukkan bahwa kebutuhan pengelolaan proyek mungkin sudah berkembang melampaui penggunaan individu. Jelajahi Proyek Cair Company untuk mendapatkan pengelolaan organisasi, kolaborasi tim, kontrol akses, dan persetujuan yang lebih terstruktur.

### 14.4 Company Offer, Registration, dan Activation adalah proses berbeda

| Proses | Tujuan | Otoritas/proses |
|---|---|---|
| Company Offer | Menginformasikan opsi penggunaan tingkat perusahaan | Platform sesuai kebijakan produk |
| Company Identity Registration Review | Mendaftarkan dan memverifikasi entitas perusahaan | Platform Owner/petugas platform berwenang |
| Company Super Admin Activation | Mengaktifkan satu kursi Company Super Admin | Platform Super Admin melalui RFIN-A |
| Employee Invitation & Membership Activation | Mengaktifkan membership dan akses awal pengguna perusahaan | Company Super Admin melalui RFIN-B |

Tidak ada proses Company Offer yang dapat melewati verifikasi perusahaan atau mengubah aturan satu Company Super Admin aktif per perusahaan.

### 14.5 Tingkatan produk — arah komersial, bukan hak akses otomatis

Sebagai arah eksplorasi produk, platform dapat mempertimbangkan:
- **Personal:** penggunaan individu dan fitur dasar yang disediakan untuk Personal Workspace.
- **Professional / Individual Plus:** opsi paket personal dengan kapasitas atau analitik lebih besar, tetap bukan Company Workspace.
- **Company:** penggunaan organisasi dengan Company Super Admin, membership, persona, role, permission, authority, workflow, dan audit organisasi.

Nama paket, fitur, harga, kuota, dan aturan billing belum diputuskan. Paket komersial tidak boleh menggantikan pemeriksaan authorization. Membeli atau menerima penawaran paket tidak otomatis memberikan Company Membership atau kewenangan perusahaan.

## 15. Tahapan implementasi konseptual

Tahapan berikut merupakan arah implementasi, bukan pernyataan bahwa fitur telah tersedia:

**Tahap 1 — Fondasi identitas dan konteks**
- Audit implementasi User Identity, Supabase Auth, skema, dan RLS yang sudah ada.
- Signup Google/email untuk pengguna umum.
- Pembuatan/penautan satu User Identity dan Personal Workspace.
- Pemisahan Personal Context dan Company Context.
- Company Membership tetap melalui RFIN-B.
- Company Super Admin tetap melalui provisioning resmi dan RFIN-A.
- Server-side authorization dan isolasi data personal/perusahaan.

**Tahap 2 — Penggunaan personal**
- Pembuatan dan pengelolaan proyek personal.
- Dashboard Personal Workspace.
- Kebijakan kuota, retensi, ekspor, pemulihan, dan penghapusan data.
- Pada tahap awal Personal Workspace hanya dapat diakses pemiliknya; tidak ada kolaborasi personal.

**Tahap 3 — Growth Journey**
- Indikator Company Readiness.
- Company Offer yang informatif, sukarela, dan dapat ditunda/ditolak.
- Pengukuran respons dan efektivitas penawaran secara proporsional.
- Company onboarding yang terpisah dari Company Offer.

**Tahap 4 — Ekspansi lanjutan**
- Pertimbangkan kolaborasi Personal Workspace hanya setelah desain sharing dan otorisasi disetujui.
- Pertimbangkan paket Professional/Individual Plus dan Company.
- Jika kelak diperlukan perpindahan data personal ke perusahaan, sediakan mekanisme transfer/copy yang eksplisit, disetujui pemilik, tervalidasi tujuan, dan teraudit. Jangan memindahkan kepemilikan atau menggabungkan data secara otomatis.


## 16. Workspace Architecture Specification

**Status:** Target architecture / product and authorization specification. Bagian ini mendefinisikan isi Workspace dan kontrak sinkronisasi frontend-backend. Ini bukan klaim bahwa seluruh menu, API, tabel, permission, atau modul telah diimplementasikan.

### 16.1 Prinsip arsitektur Workspace

UDU menggunakan tiga konteks kepemilikan utama: platform, perusahaan (tenant), dan personal. Untuk keperluan UI, konteks tersebut diekspresikan melalui empat pengalaman Workspace:

1. **Platform Super Admin Workspace** — administrasi global platform.
2. **Company Super Admin Workspace (ProyekCair Console)** — tata kelola satu tenant perusahaan.
3. **Company Operational Workspace (Persona Workspace)** — pekerjaan operasional dalam tenant berdasarkan persona aktif.
4. **Personal Workspace (General User Type B / Model B)** — penggunaan mandiri milik satu User Identity.

Company Operational Workspace bukan tenant atau jenis kepemilikan baru. Ini adalah pengalaman operasional dalam Company Workspace. Persona juga bukan Workspace, identitas, jabatan, atau role; persona adalah konteks kapasitas kerja yang dipilih dari penugasan sah pada membership perusahaan.

Prinsip pemisah:
- Workspace/context menentukan batas kepemilikan dan ruang data yang sedang digunakan.
- Persona menentukan kapasitas/konteks pekerjaan.
- Role mengelompokkan permission.
- Permission menentukan tindakan teknis atomik.
- Authority menentukan batas kewenangan bisnis.
- Project Membership/Scope membatasi proyek atau resource yang dapat diakses.
- Label jabatan/approval adalah atribut atau preset deskriptif dan tidak otomatis memberikan permission/authority. Organization Structure Builder, departemen/divisi, bagan organisasi, dan relasi atasan-bawahan bukan prasyarat penggunaan.
- Menu yang tampil di frontend bukan bukti otorisasi. Backend/database tetap menjadi sumber keputusan akses.

Rute UI berikut hanya rekomendasi, bukan kontrak URL permanen:
- \`/platform\` — Platform Super Admin Workspace.
- \`/console\` — Company Super Admin Console.
- area aplikasi operasional — Company Operational Workspace sesuai persona.
- \`/workspace/personal\` — Personal Workspace.

#### 16.1.1 Workspace Switcher / Active Context Selector

Navbar menyediakan dropdown pemilih konteks kerja dengan pola interaksi seperti pemilih entitas pada aplikasi administrasi multi-entitas (analogi UI: Coretax, tanpa klaim integrasi atau kesetaraan sistem). Pilihan minimal:
- **Personal / Umum (General User Type B)** — menampilkan nama/profil pengguna dan Personal Workspace miliknya;
- **Perusahaan** — menampilkan nama setiap Company/Tenant tempat User Identity memiliki Company Membership yang valid;
- **Persona** — setelah perusahaan dipilih, menampilkan persona-persona yang memang ditugaskan kepada pengguna dalam tenant itu.

Memilih perusahaan/persona mengganti Active Workspace Context dan memperbarui navigasi/menu/widget sesuai effective access. Dropdown tidak boleh menampilkan atau mengizinkan pemilihan perusahaan yang tidak memiliki membership sah. Berpindah konteks bukan proses signup, invitation, atau pemberian privilege. Daftar, status, dan pilihan konteks disediakan/diotorisasi server-side; pilihan UI atau localStorage hanya preferensi tampilan dan tidak pernah menjadi bukti otorisasi.



### 16.2 Platform Super Admin Workspace

Platform Super Admin Workspace digunakan untuk administrasi platform lintas tenant sesuai kebijakan platform. Otoritas Platform Super Admin tetap terpisah dari persona operasional tenant; ketika Platform Owner bekerja dalam perusahaan sebagai persona operasional, ia tunduk pada Company Membership, persona, role, permission, authority, dan scope perusahaan tersebut.

| Menu | Konten/tampilan frontend | Tanggung jawab backend (target) |
|---|---|---|
| Platform Dashboard | Statistik perusahaan, pengguna, status verifikasi, aktivasi, aktivitas dan alert | Agregasi platform-level yang dibatasi policy |
| Company Management | Daftar, pencarian, detail, status perusahaan | Company/tenant records dan lifecycle |
| Company Registration & Verification | Permohonan, dokumen legal, NPWP, keputusan dan alasan | Registration, legal verification, decision history |
| Company Super Admin Management | Kursi admin, pemegang aktif, histori aktivasi dan pemulihan | Provisioning dan transfer satu kursi Company Super Admin |
| RFIN-A Management | Penerbitan, status, expiry, revoke, redemption history | RFIN-A engine; simpan hash, bukan plaintext |
| User Identity Management | Pencarian identitas dan status provider yang diizinkan | Identity lookup yang meminimalkan data pribadi |
| Persona Catalog | Katalog persona global | Persona definitions/catalog |
| Role Catalog | Katalog role global | Role definitions/catalog |
| Permission Catalog | Katalog permission dan deskripsi | Permission catalog |
| Authority Policy / Platform Guardrails | Template serta batas kebijakan global | Guardrails dan policy global |
| Platform Audit Trail | Aktivitas administrasi platform | Append-only platform audit |
| Security Center | Peristiwa keamanan dan percobaan akses ditolak | Security events, rate-limit dan authentication signals |
| Platform Recovery | Pemulihan/pengalihan kepemilikan melalui prosedur terlindungi | Protected recovery workflow |
| Platform Settings | Konfigurasi global yang disetujui | Platform configuration |

Dashboard platform dapat merangkum total/verified/pending companies, kursi Company Super Admin aktif, jumlah User Identity dan Company Membership aktif, status RFIN-A, security alerts, dan aktivitas platform terbaru. Statistik hanya ditampilkan jika sumber data dan policy aksesnya tersedia.

**Batas:** Platform Super Admin tidak otomatis memperoleh hak CRUD/approval operasional pada setiap tenant. Akses lintas tenant untuk administrasi platform harus eksplisit, beralasan bila relevan, terbatas, dan diaudit. Jangan menyamarkan tindakan administratif platform sebagai tindakan persona operasional.

### 16.3 Company Super Admin Workspace — ProyekCair Console

Company Super Admin memperoleh Console untuk mengelola dan mengawasi tenantnya sendiri. Setiap perusahaan hanya boleh memiliki satu kursi Company Super Admin aktif. Console bukan tempat menjalankan seluruh pekerjaan operasional dan tidak otomatis memberikan hak transaksi. Tata kelola anggota menggunakan assignment individu; Organization Structure Builder tidak diwajibkan.

| Menu | Konten/tampilan frontend | Tanggung jawab backend (target) |
|---|---|---|
| Company Dashboard | Ringkasan profil, pengguna, proyek, antrean, dokumen dan aktivitas | Agregasi tenant-scoped |
| Company Profile | Identitas, NPWP, informasi legal, alamat, kontak, status dan riwayat | Company profile dan legal verification records |
| User Management | Anggota, status akun/membership, persona dan histori | Company memberships dan assignment |
| Invitation / RFIN-B Management | Buat, konfigurasi, tinjau, cabut dan pantau undangan | Invitation/RFIN-B lifecycle dan atomic redemption |
| Member Profile | Profil minimum anggota; Employee Record dan employee_number hanya bila diperlukan untuk penugasan operasional/CRUD/TTE-QR | Member profile dan Employee Records terkait membership bila use case memang memerlukannya |
| Individual Access Assignment | Persona, role/permission, label jabatan/approval bila dipakai, authority, project scope, dan masa berlaku per orang | Individual membership/persona/role/authority/project assignments; tidak mensyaratkan Org Structure Builder |
| Persona Management | Penugasan satu atau beberapa persona | Persona assignments dalam tenant |
| Role & Permission Management | Template/custom role dalam katalog dan guardrail | Role, role-permission, assignments dan policy validation |
| Authority Management | Limit dan kewenangan bisnis yang diatur sesuai kebijakan; bukan inferensi dari label jabatan | Authority policies/assignments |
| Project Management | Daftar dan detail proyek perusahaan | Tenant-owned projects |
| Project Assignment | Anggota, persona dan tanggung jawab per proyek | Project memberships/scopes |
| Workflow & Approval | Definisi tahap, urutan, SLA, reminder dan eskalasi | Workflow definitions, instances dan policy validation |
| Final Signatory Management | Penunjukan pihak TTE/QR, tipe dokumen, scope dan masa berlaku | Signatory assignments dan signing eligibility |
| Operational Monitoring | Penelusuran aktivitas BOQ, inventory, progress, cash, K3 dan dokumen | Read/audit-oriented tenant-scoped queries |
| Audit Trail | Histori administrasi dan aktivitas tenant | Append-only tenant audit dan tenant-scoped read |
| Company Settings | Preferensi dan konfigurasi yang diperbolehkan | Tenant configuration dalam guardrail platform |

Company Dashboard dapat menampilkan status profil, total/active memberships, undangan pending, Employee Records aktif, proyek, pending approvals, ringkasan aktivitas, status dokumen, security/access alerts, dan audit terbaru sesuai hak akses.

#### 16.3.0 Administrasi anggota tanpa bagan organisasi wajib

Company Console mengutamakan pengelolaan anggota dan penugasan individu. Tidak ada menu atau dependensi wajib untuk membangun departemen, divisi, bagan organisasi, atau relasi atasan-bawahan. Company Super Admin mengatur setiap anggota secara langsung: persona, role/permission, label jabatan/approval bila dipakai, authority, project scope, dan masa berlaku. Employee Record merupakan record minimum hanya untuk use case yang membutuhkannya sebagaimana bagian 4.1; ia bukan registri seluruh tenaga kerja perusahaan. Project Membership/Scope tetap wajib ditegakkan secara terpisah dan tidak boleh ditiadakan hanya karena Org Structure Builder tidak digunakan.



#### 16.3.1 Konfigurasi invitation dan preview akses

Sebelum RFIN-B diterbitkan, Company Super Admin mengonfigurasi penerima/binding identitas, tenant tujuan, persona, minimal satu role bila akses operasional memerlukannya, project scope bila relevan, authority bila relevan, expiry, usage limit, dan ketentuan redemption. Sistem menampilkan **Effective Access Preview** yang menjelaskan hak efektif dan batasnya sebelum penerbitan.

Invitation hanya boleh memberikan hak yang berada dalam kewenangan penerbit dan guardrail platform. Invitation tidak dapat membuat Company Super Admin kedua atau Platform Super Admin. Detail aturan RFIN-B tetap tunduk pada bagian onboarding/invitation dan keputusan bisnis yang disahkan.

#### 16.3.2 Pengawasan Console

Company Super Admin dapat memiliki pengawasan/read-oriented terhadap aktivitas tenant sesuai policy. Kemampuan membaca audit atau menelusuri transaksi tidak otomatis memberikan permission untuk membuat, mengubah, menghapus, memeriksa, atau menyetujui transaksi. Bila Company Super Admin juga menjalankan pekerjaan operasional, ia menggunakan persona operasional yang ditugaskan secara eksplisit; jejak audit tetap mencatat identitas asli dan konteks tindakan.

#### 16.3.1a Konfigurasi RFIN-B dan preview akses

Sebelum RFIN-B diterbitkan, Company Super Admin mengonfigurasi penerima/binding identitas, tenant tujuan, persona, role/permission awal yang relevan, project scope bila diperlukan, authority bila diperlukan, masa berlaku, batas penggunaan, serta ketentuan redemption. Console menampilkan **Effective Access Preview** yang menjelaskan hak efektif dan batasnya sebelum penerbitan. Redemption mengaktifkan konfigurasi yang telah diterbitkan; perubahan konfigurasi memerlukan prosedur penerbitan/perubahan yang tercatat. Invitation tidak dapat memberikan Company Super Admin kedua atau Platform Super Admin.


### 16.4 Company Operational Workspace — User Persona

Persona adalah kapasitas/konteks pekerjaan dalam membership perusahaan. Satu User Identity dapat memiliki beberapa persona dalam satu perusahaan dan/atau persona pada beberapa perusahaan. Setiap assignment bersifat eksplisit dan terikat tenant; persona tidak diwariskan antarperusahaan.

Alur pemilihan konteks yang disarankan:
\`User Identity → Company → Project/Scope (bila relevan) → Active Persona\`.

Kerangka navigasi operasional bersama dapat terdiri atas:

| Menu/area | Konten frontend | Sumber otorisasi backend |
|---|---|---|
| My Dashboard | Widget dan ringkasan sesuai persona/scope | Permission, attributes, relationships, authority, scope |
| My Tasks | Tugas yang ditugaskan kepada pengguna | Task assignment dan resource relationship |
| My Approvals | Item yang menunggu tindakan pengguna | Active workflow step, permission dan authority |
| Project Overview | Ringkasan proyek yang ditugaskan | Project membership/scope |
| Operational Modules | Modul operasional yang diizinkan | Module-specific permission dan tenant isolation |
| Documents | Dokumen sesuai hak akses | Document permission, classification dan scope |
| Notifications | Tugas, perubahan status dan pengingat | Recipient authorization dan notification policy |
| Activity History | Aktivitas sendiri/riwayat yang diizinkan | Audit/activity read policy |
| My Profile | Identitas dan data kepegawaian yang boleh ditampilkan | User Identity dan Employee Record access |
| Workspace Context | Perusahaan, proyek, persona aktif | Server-validated active context |

Katalog persona awal yang dicontohkan SSOT/produk mencakup Project Manager, Construction Manager, Site Engineer, Data Inputter, Procurement, Finance, Storekeeper, HSE Officer, Document Controller, dan Viewer. Ini adalah katalog awal/contoh, bukan daftar final atau pemberian hak otomatis.

#### 16.4.1 Template dashboard persona

Dashboard dibangun sebagai komposisi widget berbasis permission dan scope, bukan dashboard terpisah yang mengasumsikan role berdasarkan nama persona. Contoh konten yang dapat diaktifkan sesuai konfigurasi:

| Persona/contoh kapasitas | Kandidat widget |
|---|---|
| Project Manager | Project summary, planned vs actual progress, BOQ utilization, inventory summary, cash position (bila diizinkan), issues, pending approvals |
| Construction Manager | Construction overview, progress, work fronts, constraints, review queue sesuai scope |
| Site Engineer | Daily/weekly progress, target vs actual, S-curve, site photos, manpower dan kondisi lapangan jika tersedia |
| Procurement | Requisition/procurement queue, BOQ references, purchasing status dan dokumen procurement |
| Finance | Cash position, cash-in/out, pending transactions, expense breakdown dan supporting documents |
| Storekeeper | Goods received/issued, current stock, low-stock alerts, material requests dan movement history |
| HSE Officer | Toolbox meetings, work permits, hazard/incident reports, safety actions dan HSE documents |
| Document Controller | Document register, versions, review status, issuance, BATAL/GANTI lifecycle dan distribution sesuai scope |
| Viewer | Read-only widgets yang secara eksplisit diizinkan; tidak ada hak baca otomatis |

Matriks modul hanyalah template UX. Hak create/read/update/delete/review/approve/sign harus ditetapkan per permission dan diuji pada backend. Nama persona atau jabatan tidak boleh menjadi satu-satunya dasar authorization.

##### 16.4.1a Workflow Initiator, Approver Eligibility, dan notifikasi paralel

Pembuat dokumen wajib memiliki Workflow Initiator Permission. Company Super Admin menetapkan Approver Eligibility Pool/guardrail per proses/dokumen/scope melalui assignment individual; pembuat memilih dan mengurutkan kandidat dari pool tersebut secara fleksibel per dokumen. Backend memvalidasi membership aktif, eligibility, permission, authority bila relevan, project/resource scope, status aktif, aturan dokumen, serta konflik kepentingan jika policy mengatur. Initial notification dikirim paralel saat workflow dimulai, tetapi hanya step aktif yang actionable. SLA setiap step dimulai ketika step aktif. Perubahan pool tidak retroaktif; perubahan approver pada workflow aktif memerlukan proses terkendali, revalidasi, dan audit.



### 16.4.2 Workflow operasional

Menu My Approvals hanya menampilkan item yang berhubungan dengan aktor dan konteksnya. Tindakan approve/reject/return hanya tersedia dan diterima backend ketika workflow step yang sesuai sedang aktif, aktor memenuhi membership/persona/permission/authority/scope, dan seluruh prasyarat terpenuhi. Tahap approval berjalan serial; notifikasi kepada tahap berikutnya tidak membuka tindakan sebelum gilirannya, kecuali delegasi/pengganti resmi yang tervalidasi.

Final signatory ditunjuk eksplisit Company Super Admin. Dasar signing adalah User Identity terautentikasi + Company Membership aktif + appointment aktif sesuai jenis dokumen/scope. Employee Record, persona, jabatan, approval level, dan authority tambahan bukan prasyarat universal. Backend memeriksa tenant, appointment, final version/lifecycle, serta approval serial selesai. QR scan/verifikasi memerlukan permission terpisah.

### 16.5 Personal Workspace — General User Type B (Model B)

Personal Workspace disediakan setelah signup umum Google/email yang berhasil. Ini adalah workspace single-owner milik satu User Identity, bukan Company/Tenant. Pengguna tidak memerlukan RFIN untuk signup personal dan tidak memperoleh Company Membership, Company Console, persona perusahaan, authority perusahaan, atau final-signatory appointment secara otomatis.

| Menu/area | Konten frontend (rancangan) | Tanggung jawab backend (target) |
|---|---|---|
| Personal Dashboard | Ringkasan proyek dan aktivitas pribadi | Personal-owned aggregation |
| My Projects | Daftar proyek pribadi | Ownership-bound project CRUD |
| Project Overview | Detail dan status proyek personal | Personal project resources |
| Project Planning | Rencana dan target bila fitur disediakan | Personal planning resources |
| Progress Tracking | Catatan progres pribadi bila fitur disediakan | Personal progress resources |
| Personal Documents | Dokumen milik pengguna | Private personal storage/access |
| Personal Finance | Catatan biaya pribadi/proyek bila diputuskan sebagai fitur | Personal financial resources; bukan cash tenant |
| My Activities | Histori aktivitas personal | Personal activity/audit read |
| Company Readiness | Indikator kesiapan produk jika diaktifkan | Product analytics; bukan authorization input |
| Company Offer | Penawaran informatif dan sukarela | Offer preferences/status; tidak memberikan privilege |
| Account Settings | Profil dan preferensi | User Identity/profile settings |
| Data Management | Export, recovery, deletion/retention sesuai kebijakan | Data lifecycle services dan audit |

Menu seperti Project Planning, Personal Finance, kuota, backup, dan export merupakan kandidat rancangan produk; keberadaannya tidak dianggap sebagai fitur wajib yang sudah disepakati hanya karena dicantumkan di tabel ini. Implementasi memerlukan keputusan fitur, kebijakan retensi/privasi, dan acceptance criteria tersendiri.

Personal Dashboard dapat merangkum My Projects, active projects, progress, recent activities, upcoming tasks, personal documents, kapasitas jika kebijakan kuota ditetapkan, serta Company Readiness/Offer bila fitur tersebut diaktifkan.

Personal Workspace tetap ada ketika User Identity bergabung dengan satu atau beberapa perusahaan. Bergabung dengan perusahaan tidak mengonversi, menghapus, memindahkan, atau menggabungkan data personal. Transfer/copy ke tenant, bila kelak disediakan, harus eksplisit, disetujui pemilik, divalidasi tujuan, dan diaudit. Kolaborasi Personal Workspace belum termasuk cakupan awal.

### 16.6 Perbandingan hak dan batas tiap pengalaman Workspace

| Aspek | Platform Super Admin | Company Super Admin Console | Company Operational / Persona | Personal / General User Type B |
|---|---|---|---|---|
| Konteks | Platform | Satu tenant | Tenant dan scope yang ditugaskan | Personal |
| Pemilik resource | Platform sesuai domain | Company/Tenant | Company/Tenant | Satu User Identity |
| Company administration | Global sesuai policy | Tenant sendiri | Tidak, kecuali permission delegasi terbatas yang disetujui | Tidak |
| Provisioning RFIN-A | Ya, sesuai prosedur | Tidak | Tidak | Tidak |
| Invitation/RFIN-B | Administrasi sesuai policy | Tenant sendiri | Tidak kecuali didelegasikan secara eksplisit | Tidak |
| Persona catalog | Global | Memilih/menugaskan dalam guardrail | Menggunakan persona yang ditugaskan | Tidak ada persona perusahaan |
| Role/permission | Katalog dan guardrail global | Menugaskan dalam batas policy | Menggunakan hak efektif | Tidak ada hak perusahaan |
| Authority | Policy global | Menetapkan dalam guardrail | Menggunakan authority yang ditugaskan | Tidak ada authority perusahaan |
| Project access | Administrasi sesuai policy; bukan bypass operasional | Tata kelola proyek tenant | Proyek/scope yang ditugaskan | Proyek personal sendiri |
| Workflow | Guardrail platform | Konfigurasi tenant | Menjalankan step yang ditugaskan | Bukan workflow perusahaan |
| Audit | Platform audit sesuai policy | Audit tenant sendiri | Sesuai permission | Aktivitas personal sendiri |
| Final signatory/TTE/QR | Administrasi/policy sesuai batas | Menetapkan pihak dan scope | Hanya jika ditunjuk serta memenuhi seluruh syarat | Tidak |
| Akses lintas tenant | Hanya sesuai tugas/policy, beralasan dan diaudit | Tidak | Tidak | Tidak |

### 16.7 Kontrak sinkronisasi frontend-backend

Frontend dan backend wajib menggunakan vocabulary permission, konteks, dan status yang konsisten. Frontend bertanggung jawab menyajikan UI yang sesuai hak efektif; backend/database tetap menjadi enforcement authority.

Kontrak konteks konseptual (ilustrasi TypeScript, bukan schema final atau klaim implementasi):

\`\`\`ts
type WorkspaceType = "PLATFORM" | "COMPANY" | "PERSONAL";

interface ActiveWorkspaceContext {
  userId: string;
  workspaceType: WorkspaceType;
  workspaceId: string;

  companyId?: string;
  membershipId?: string;
  employeeId?: string;

  activePersonaId?: string;
  activeProjectId?: string;

  // Informational effective-access snapshot for UI.
  // Server must independently resolve and enforce every protected action.
  permissionCodes: string[];

  contextStatus: "ACTIVE" | "SUSPENDED" | "INVALID";
}
\`\`\`

Kontrak ini tidak menjadikan nilai dari browser sebagai bukti otorisasi. \`userId\`, \`workspaceId\`, \`companyId\`, \`membershipId\`, \`personaId\`, \`projectId\`, dan permission snapshot dari client harus diverifikasi/di-resolve oleh backend dari identitas autentikasi dan data server-side. Hindari memasukkan authority atau privilege yang dipercaya langsung dari payload client.

Contoh permission code awal untuk menyelaraskan UI dan API (katalog final harus dikelola terpusat dan direview; nama ini bukan bukti permission sudah dibuat):

| UI action/resource | Contoh permission code | Enforcement tambahan |
|---|---|---|
| Read company profile | \`company.profile.read\` | Membership/admin scope tenant |
| Read/manage membership | \`membership.read\` / \`membership.manage\` | Company Super Admin atau delegated permission sah |
| Invite member | \`membership.invite\` | Issuer authority, tenant dan RFIN-B policy |
| Read employee record | \`employee.read\` | Tenant scope dan data classification |
| Read/assign project | \`project.read\` / \`project.assign\` | Tenant/project relationship |
| Read BOQ | \`boq.read\` | Company dan project scope |
| Create progress | \`progress.create\` | Project scope dan kondisi workflow |
| Read inventory | \`inventory.read\` | Company/project scope |
| Create inventory movement | \`inventory.mutation.create\` | Status resource dan business rules |
| Read cash | \`cash.read\` | Company/project scope dan data classification |
| Create cash transaction | \`cash.transaction.create\` | Authority/business constraints jika relevan |
| Read K3 report | \`k3.report.read\` | Company/project scope |
| Issue document | \`document.issue\` | Document lifecycle/workflow policy |
| Sign document | \`document.sign\` | Final-signatory appointment, active step, authority, final version |
| Read audit | \`audit.read\` | Platform atau tenant-scoped audit policy |

Frontend dapat menggunakan permission snapshot untuk menyembunyikan/menonaktifkan menu dan kontrol. Setiap API/RPC/mutasi wajib menghitung/validasi ulang akses saat operasi dilakukan. Hasil penolakan backend harus konsisten dan tidak membocorkan resource lintas tenant.

### 16.8 Tanggung jawab per lapisan

| Lapisan | Tanggung jawab |
|---|---|
| Frontend | Context selector, navigation, widget, form, tombol, empty/error state dan tampilan berdasarkan effective access |
| API/RPC | Validasi identitas, context, membership, persona, permission, authority, attribute, relationship dan scope |
| Authorization Engine | Keputusan hybrid RBAC + ABAC + ReBAC; ACL hanya pengecualian terkontrol bila disetujui |
| Database/RLS | Tenant/personal ownership isolation pada setiap tabel dan operasi yang terekspos |
| Workflow Engine | Urutan serial, active-step gating, SLA, reminder, escalation, delegation dan finalization rules |
| Audit Engine | Append-only event atas perubahan akses, data, workflow, dokumen dan administrasi |
| Storage | Akses privat yang divalidasi terhadap owner/tenant/resource; tidak ada public exposure yang bertentangan dengan kebijakan TTE/QR privat |

Satu definisi katalog permission dan metadata resource sebaiknya dipakai untuk menu frontend, API/RPC, test matrix, dan dokumentasi. Namun definisi UI tidak menggantikan enforcement database/server.

### 16.9 Acceptance criteria minimum untuk setiap Workspace

Sebelum Workspace dinyatakan siap:
1. Pengguna hanya dapat masuk ke konteks Workspace yang kepemilikan/membership-nya valid.
2. Context switch tidak memberi privilege baru dan selalu divalidasi server-side.
3. Semua menu dan tombol yang sensitif berkorespondensi dengan permission/action yang terdefinisi; backend tetap menolak direct API/RPC yang tidak sah.
4. Semua query dan mutasi tenant-scoped terisolasi berdasarkan Company ID yang tervalidasi.
5. Personal resources hanya dapat diakses User Identity pemilik; Personal Workspace tidak menggunakan Company ID fiktif.
6. Persona, role, permission, authority, attributes, relationships, dan project scope diuji secara terpisah serta gabungan.
7. Perubahan membership/assignment/policy segera memengaruhi keputusan akses sesuai strategi invalidasi cache.
8. Workflow approval serial dan active-step gating diuji, termasuk percobaan bertindak di luar giliran.
9. Final signatory dan QR/TTE privat tidak dapat digunakan tanpa appointment dan seluruh syaratnya.
10. Audit merekam actor, tenant/context, persona, scope, aksi, objek, hasil, dan reason relevan tanpa menyimpan secret/token.
11. Pengujian mencakup positive, negative, cross-tenant, cross-project, revoked membership, suspended identity, dan legacy regression.
12. UI menampilkan konteks perusahaan/proyek/persona aktif secara jelas dan menangani context invalid/expired tanpa melanjutkan mutasi.

### 16.10 Status keputusan dan hal yang belum menjadi kontrak final

Isi menu dan widget di bagian ini adalah target arsitektur. Keputusan normatif berikut sudah ditetapkan pada Bagian 17–20 dan tidak boleh dianggap masih terbuka: kebijakan A2F/MFA opsional tenant, lifecycle provisioning dan RFIN-B, baseline permission/action matrix, kontrak workflow dan SLA default, serta lifecycle Personal Workspace. Hal yang masih memerlukan spesifikasi teknis sebelum implementasi:
- Nama final seluruh persona dan role preset serta kombinasi default-nya; permission baseline dan aksi domain tetap mengikuti Bagian 18.
- Mapping permission ke setiap tabel/API/RPC aktual, schema database, payload/error schema, dan strategi cache.
- Widget/dashboard per paket atau lisensi.
- Struktur API/RPC final dan migration plan berdasarkan audit implementasi terkini.
- Kebijakan delegasi administratif di luar delegasi workflow dan pengecualian ACL.
- Acceptance threshold operasional dan metrik Company Readiness.

Keputusan teknis tersebut harus dituangkan pada katalog permission, frontend-backend contract, database mapping, RLS/authorization matrix, dan test matrix sebelum implementasi.


## 17. Autentikasi, A2F/MFA, dan provisioning Company Super Admin

### 17.1 Pemisahan registrasi, autentikasi pemohon, dan signup pemegang kursi

Tiga objek berikut tidak boleh disatukan:
- **Company Application:** permohonan pendaftaran perusahaan yang dikirim oleh seorang actor terautentikasi. Google/email pada tahap ini membuktikan kontrol atas akun pemohon dan mengikat audit actor; tidak membuktikan kewenangan legal mewakili perusahaan.
- **Company/Tenant provisioning:** tindakan administratif Platform setelah aplikasi diputuskan ACCEPTED. Provisioning menyiapkan tenant dalam status onboarding/claim-pending, bukan otomatis memberikan akses kepada pemohon.
- **Company Super Admin account signup/claim:** proses signup baru oleh orang yang akan menjadi pemegang kursi. Proses ini harus dijalankan seperti signup User Identity baru (atau sign-in/reauthentication bila orang tersebut sudah memiliki User Identity), melalui Google/email yang didukung, verifikasi email/provider, persetujuan kebijakan, dan claim kursi melalui RFIN-A/aktivasi terikat. Persetujuan Platform adalah prasyarat; tidak ada auto-provisioning akun hanya karena Company Application diterima.

Pemohon Company Application dan calon pemegang kursi Company Super Admin boleh orang yang sama atau berbeda. Platform Super Admin menetapkan/mengonfirmasi penerima kursi saat provisioning. Jika berbeda, perubahan penerima harus tercatat. Identitas pemohon tidak otomatis menjadi pemegang kursi dan tidak otomatis memperoleh membership.

Lifecycle yang direkomendasikan:
- Company Application: PENDING → ACCEPTED | REJECTED.
- Tenant onboarding: CLAIM_PENDING → ACTIVE; dapat menjadi SUSPENDED atau CLOSED setelah aktif.
- Company Super Admin seat: UNCLAIMED → CLAIM_PENDING → ACTIVE; transfer menggunakan proses khusus dan tidak pernah membuat dua seat aktif.
- RFIN-A: ACTIVE → REDEEMED, atau REVOKED | EXPIRED.

Pada penerimaan aplikasi, Platform membuat tenant/record provisioning dan menerbitkan RFIN-A yang terikat pada tenant serta calon pemegang kursi. Calon pemegang melakukan signup/sign-in, memverifikasi identitas provider/email yang terikat, menyelesaikan claim, lalu backend dalam satu transaksi mengikat auth.users.id ke kursi. Tenant menjadi ACTIVE setelah claim sukses dan seluruh pemeriksaan provisioning selesai. Bila RFIN-A tidak digunakan, Platform dapat memakai alur claim setara yang aman dan teraudit. Pengajuan yang ditolak tidak menghasilkan tenant aktif atau seat.

### 17.2 Sign-in Company Super Admin

Sign-up/claim menggunakan email atau Google sebagai metode pembuatan/pengaitan User Identity. Sign-in berikutnya menggunakan NPWP perusahaan sebagai login identifier dan kata sandi sebagai credential rahasia sesuai keputusan v2.7. NPWP tidak pernah diperlakukan sebagai secret. Backend harus menyelesaikan NPWP ke tenant/seat aktif secara aman, memverifikasi password melalui mekanisme Auth yang aman, lalu membuat sesi yang terikat ke User Identity pemegang seat dan tenant yang tepat. Jangan mengandalkan NPWP atau company_id dari client sebagai otorisasi.

### 17.3 A2F/MFA sebagai fitur platform opsional dan kebijakan tenant

A2F/MFA bukan kewajiban universal pada baseline. Platform menyediakan katalog metode yang telah didukung dan diuji, misalnya TOTP authenticator, passkey/WebAuthn/security key, serta MFA provider eksternal bila integrasi dan sinyal assurance-nya benar-benar tersedia. Company Super Admin dapat mengaktifkan metode yang ditawarkan Platform untuk tenant, menetapkan kelompok pengguna, tindakan sensitif, grace period, recovery policy, dan tingkat kewajiban. Platform dapat menetapkan baseline minimum atau mewajibkan MFA untuk tindakan platform/global tertentu.

Aturan:
1. Tenant hanya dapat memilih metode yang sudah diaktifkan dan didukung Platform; tenant tidak dapat memasukkan provider arbitrer atau mengubah protokol keamanan global.
2. Google sign-in/OAuth adalah metode autentikasi primer. Ia tidak otomatis menjadi faktor kedua ProyekCair. Hanya MFA provider yang dapat diverifikasi atau challenge ProyekCair yang sukses yang dihitung sebagai A2F.
3. A2F dapat diwajibkan untuk Company Super Admin, administrator/delegated admin, akses finansial/dokumen/signing, atau tindakan berisiko tinggi sesuai policy tenant.
4. Pengguna diberi masa enrollment dan recovery yang jelas. Kehilangan faktor kedua menggunakan recovery codes sekali pakai atau prosedur pemulihan terverifikasi dan teraudit; dukungan tidak boleh menonaktifkan MFA tanpa pemeriksaan.
5. Perubahan metode MFA, reset faktor, dan pengecualian wajib diaudit. Rate limiting, anti-enumeration, lockout/throttling, device/session management, dan notifikasi keamanan berlaku.
6. Tenant dapat memilih OFF, OPTIONAL, atau REQUIRED untuk kelompok/tindakan yang diizinkan Platform. Platform dapat mengunci kebijakan minimum untuk peran atau tindakan platform tertentu.

## 18. Permission model dan baseline matriks aplikasi konvensional

Permission model ProyekCair adalah authorization aplikasi bisnis konvensional, bukan sistem kewenangan pemerintah. Tujuannya membatasi siapa dapat melihat dan mengelola data, menjalankan transaksi, memeriksa/mengotorisasi proses, serta menandatangani dokumen. Nama jabatan/persona tidak memberikan akses otomatis. Matriks berikut adalah baseline katalog permission; Platform dapat menambah permission terkontrol, sedangkan tenant hanya menugaskan permission yang tersedia dalam guardrail.

### 18.1 Pola permission standar

Setiap resource menggunakan aksi sesuai kebutuhan: read, create, update, archive, delete (hanya bila aman), dan aksi domain seperti submit, review, verify, approve, reject, return, issue, sign, void, reverse, export, assign, manage. Hak list/detail juga tunduk pada tenant, project/resource scope, klasifikasi data, dan hubungan aktor-resource.

**Prinsip delete:** transaksi kas, mutasi stok, BOQ yang sudah dipakai, dokumen terbit/ditandatangani, approval event, membership historis, dan audit event tidak dihapus fisik melalui CRUD biasa. Gunakan void/reversal/correction/superseding record dengan alasan dan audit. Hard delete hanya untuk draft/resource yang belum direferensikan dan sesuai retention policy.

### 18.2 Baseline matriks per modul

| Modul/resource | Read | Create | Update | Archive/delete | Aksi domain khusus |
|---|---|---|---|---|---|
| Company Profile | company.profile.read | — | company.profile.update_request | — | company.profile.change_approve oleh Platform bila field platform-controlled |
| Member & Membership | membership.read | membership.invite | membership.update | revoke/suspend, bukan hard delete | membership.manage, membership.reactivate |
| Invite/RFIN-B | invitation.read | invitation.create | revise via revoke+reissue | invitation.revoke | invitation.resend, invitation.preview |
| Employee Record | employee.read | employee.create | employee.update | archive; hard delete hanya sebelum dipakai | employee.manage |
| Persona/Role/Permission | access_assignment.read | access_assignment.create | access_assignment.update | revoke/expire | access_assignment.manage, role.assign |
| Project | project.read | project.create | project.update | archive, bukan hapus bila ada histori | project.assign, project.close |
| BOQ | boq.read | boq.create | boq.update | archive bila belum direferensikan | boq.submit, boq.review, boq.approve, boq.addition.create, boq.revision |
| Progress | progress.read | progress.create | progress.update pada draft | archive draft | progress.submit, progress.review, progress.verify, progress.approve, progress.return |
| Procurement | procurement.read | procurement.create | procurement.update pada status yang diizinkan | archive draft | procurement.submit, procurement.review, procurement.approve, procurement.issue_order, procurement.receive |
| Inventory | inventory.read | inventory.movement.create | koreksi melalui event baru | tidak hard delete | inventory.movement.review, inventory.movement.approve, inventory.movement.reverse, inventory.count |
| Cash/Finance | cash.read | cash.transaction.create | update draft saja | tidak hard delete | cash.transaction.submit, cash.transaction.review, cash.transaction.approve, cash.transaction.void, cash.transaction.reverse, cash.export |
| K3/HSE | k3.read | k3.report.create | k3.report.update pada draft | archive sesuai policy | k3.report.submit, k3.report.review, k3.report.close, k3.incident.manage |
| Documents | document.read | document.create | document.update pada draft | archive draft; terbit menggunakan supersede/void | document.submit, document.review, document.approve, document.issue, document.sign, document.void, document.replace |
| QR/TTE | read hanya melalui document permission | — | — | — | document.qr.scan, document.qr.verify, document.sign |
| Workflow | workflow.read | workflow.definition.create | workflow.definition.update | deactivate definition | workflow.start, workflow.cancel, workflow.step.act, workflow.delegate, workflow.reassign |
| Audit | audit.read | server-generated | — | tidak boleh | audit.export jika diizinkan |
| Notifications | notification.read | server-generated | notification.preference.update | dismiss milik sendiri | notification.manage terbatas |
| Personal Workspace | personal.resource.read | personal.resource.create | personal.resource.update | archive/delete sesuai lifecycle personal | personal.export, personal.delete_request, personal.restore |

Tanda "—" berarti tidak tersedia sebagai operasi langsung atau menggunakan alur khusus. Permission tambahan dapat dipisah lebih granular saat modul memerlukannya, tetapi harus mengikuti prinsip least privilege dan mempunyai deskripsi, resource scope, risk level, serta test case.

### 18.3 Guardrail role dan akses efektif

- **Company Super Admin** memiliki hak administrasi tenant melalui seat khusus, bukan melalui role operasional yang dapat diberikan ke orang lain. Seat ini tidak otomatis memberi hak melakukan transaksi operasional atau final signing.
- Role preset awal (Project Manager, Site Engineer, Procurement, Finance, Storekeeper, HSE Officer, Document Controller, Viewer) hanyalah bundel rekomendasi. Platform menyediakan definisi awal; Company Super Admin dapat memilih/customize kombinasi yang diizinkan.
- Hindari role universal "Admin" yang otomatis memiliki semua permission operasional. Hak Console dan hak operasional harus terpisah.
- Permission untuk approve/review/sign tidak otomatis mengikuti create/update. Pembuat transaksi tidak boleh menyetujui transaksinya sendiri bila policy menetapkan segregation of duties; baseline melarang self-approval untuk transaksi finansial dan dokumen formal.
- Effective access dihitung dari membership aktif + persona aktif + role assignment + permission + attributes + resource relationship + project scope + authority + workflow state. Deny pada status tenant/member/resource atau policy global mengalahkan grant.
- Company Super Admin hanya dapat memberi permission dalam batas yang ia miliki/yang diizinkan policy. Tidak boleh privilege escalation lewat invitation, custom role, atau project assignment.

## 19. Workflow Engine: kontrak, SLA, delegasi, dan eskalasi

Workflow adalah rangkaian state transition bisnis yang dijalankan backend. Frontend hanya meminta tindakan; backend/RPC menentukan apakah transisi sah. Approval serial dan notifikasi awal paralel tetap berlaku.

### 19.1 State dan invariants

Workflow instance: DRAFT → ACTIVE → COMPLETED, dengan cabang RETURNED, REJECTED, CANCELLED, atau EXPIRED sesuai jenis proses. Step: PENDING → ACTIVE → APPROVED, atau REJECTED | RETURNED | SKIPPED bila policy mengizinkan. Hanya satu step serial yang boleh berstatus ACTIVE pada satu waktu, kecuali jenis workflow secara eksplisit mendukung parallel approval melalui keputusan policy terpisah; baseline ProyekCair tetap serial.

Invariants:
- Workflow dimulai hanya jika initiator memiliki permission, tenant/member aktif, resource scope benar, dokumen/transaksi eligible, dan approver chain tervalidasi.
- Setiap step mempunyai assignee User Identity tertentu atau eligible pool yang diselesaikan menjadi assignee konkret sebelum step aktif.
- Hanya assignee aktif atau delegate sah yang boleh bertindak; notifikasi tidak memberikan permission.
- Backend memeriksa ulang membership, permission, authority, project/resource scope, konflik kepentingan, resource version/status, dan current step pada setiap mutasi.
- Mutasi step menggunakan transaksi atomik/optimistic concurrency (expected version) agar dua request bersamaan tidak menghasilkan dua keputusan.
- Rejection/return memerlukan reason; resubmission membuat event/attempt baru tanpa menghapus histori.
- Workflow tidak otomatis menyetujui ketika SLA lewat.

### 19.2 Kontrak API/RPC konseptual

Nama di bawah adalah kontrak semantik, bukan klaim fungsi tersebut sudah ada atau nama final implementasi. Semua endpoint/RPC memerlukan autentikasi dan server-side Active Context Resolver.

| Operasi | Input minimum | Validasi dan hasil |
|---|---|---|
| workflow_definition.create/update | tenant, process_type, version, step templates, SLA policy | hanya admin/workflow manager berizin; validasi permission/authority guardrail; versi aktif immutable |
| workflow.preview | resource_type/id, proposed approvers, context | simulasi eligibility, urutan, authority, konflik, SLA; tidak membuat workflow |
| workflow.start | resource_type/id, expected_resource_version, ordered_approver_ids, idempotency_key | validasi initiator, resource, tenant, seluruh approver; snapshot chain; buat instance dan step pertama ACTIVE |
| workflow.step.act | workflow_id, step_id, action, reason/comment, expected_version, idempotency_key | hanya current active assignee/delegate; action approve/reject/return; simpan event; aktifkan step berikutnya atau finalisasi |
| workflow.delegate | workflow_id, step_id, delegate_user_id, start/end, reason | delegator berwenang; delegate eligible dalam tenant/scope; batas waktu; approval policy; audit |
| workflow.reassign | workflow_id, step_id, new_assignee_id, reason | hanya actor berwenang; revalidasi; cabut assignee lama; audit dan notifikasi |
| workflow.cancel | workflow_id, reason, expected_version | initiator/admin berizin; cek status dan policy; audit |
| workflow.remind/escalate | workflow_id/step_id, trigger | internal scheduler/service identity; tidak memberi hak approval; audit event |
| workflow.read | resource/workflow id | tenant/scope/participant authorization; redaksi data sensitif |

Setiap operasi mutasi harus mengembalikan status terkini, active step, next due date, event id, dan error code stabil seperti NOT_AUTHORIZED, WRONG_ACTIVE_STEP, STALE_VERSION, INVALID_TRANSITION, RESOURCE_NOT_ELIGIBLE, atau POLICY_VIOLATION. Jangan mengembalikan detail resource lintas tenant.

### 19.3 SLA default, reminder, dan eskalasi

Default awal jika tenant tidak mengatur lain:
- SLA setiap step: **2 hari kerja** sejak step menjadi ACTIVE; hari kerja Senin–Jumat, 08.00–17.00 pada timezone tenant (default Asia/Jakarta), tidak termasuk hari libur yang dimasukkan tenant.
- Reminder: saat aktivasi, 1 hari kerja sebelum due, dan pada saat due.
- Eskalasi: 1 hari kerja setelah due ke atasan workflow yang ditetapkan atau Company Super Admin/monitor yang diberi permission workflow.escalation.read; eskalasi kedua setiap 2 hari kerja jika masih tertunda.
- Eskalasi hanya notifikasi/monitoring dan tidak otomatis mengubah assignee, melewati step, atau menyetujui.
- Pause SLA hanya pada status RETURNED/menunggu perbaikan oleh initiator atau ketika workflow resmi ditangguhkan; clock aktif kembali saat resubmission/step diaktifkan.
- Tenant dapat mengatur SLA, kalender kerja, reminder, dan escalation recipients dalam guardrail Platform. Perubahan berlaku untuk instance baru kecuali perubahan aktif disetujui dan dicatat.
- Keterlambatan tidak mengubah validitas approval. Tidak ada auto-approval.

### 19.4 Delegasi dan penggantian approver

- Delegasi harus eksplisit, memiliki alasan, tanggal mulai/akhir, scope proses/proyek, dan audit.
- Delegate harus User Identity aktif dengan Company Membership aktif pada tenant yang sama, permission dan authority yang cukup, serta project/resource scope yang sesuai.
- Delegasi tidak dapat memperluas authority delegator, tidak lintas tenant, tidak dapat mendelegasikan final signing kecuali policy signing secara eksplisit mendukung dan appointment signatory juga valid.
- Default masa delegasi maksimum 30 hari; perpanjangan memerlukan persetujuan ulang.
- Self-delegation, delegasi ke akun suspended/revoked, dan delegasi yang menciptakan konflik kepentingan dilarang.
- Delegasi dapat ditetapkan sebelumnya untuk rentang tanggal atau pada active step. Untuk active step, sistem mencatat siapa delegator dan delegate; tindakan delegate dicatat atas identitas delegate dengan relasi delegasi.
- Reassignment bukan delegation. Reassignment membatalkan assignment lama, menetapkan approver baru setelah validasi, mencatat alasan, dan memberi notifikasi kepada pihak terdampak. Perubahan approver tidak menghapus event terdahulu.
- Company Super Admin dapat melakukan reassignment dalam guardrail tenant; approver tidak dapat mengganti dirinya sendiri tanpa permission/policy yang mengizinkan.

## 20. Personal Workspace: lifecycle, recovery, export, retention, deletion

Personal Workspace adalah ruang kerja milik satu User Identity. Kebijakan ini tidak mengubah Company Workspace, Company Membership, tenant-owned resources, atau histori tindakan perusahaan.

### 20.1 Kepemilikan dan batas data

- Setiap Personal Workspace dimiliki satu auth.users.id; tidak ada akses kolaboratif pada baseline.
- Personal project, dokumen, lampiran, dan aktivitas personal tidak otomatis dapat dibaca perusahaan tempat user bekerja.
- Bergabung/keluar dari perusahaan tidak memindahkan, menggabungkan, atau menghapus data personal.
- Data perusahaan yang dibuat oleh user tetap milik tenant dan tunduk pada retention perusahaan meskipun user menghapus akun personal atau keluar dari perusahaan. Actor historis dipseudonimkan bila perlu, bukan menghapus audit event.
- Transfer personal-to-company hanya melalui export/import atau copy eksplisit dengan persetujuan pemilik, konfirmasi tenant tujuan, pemeriksaan klasifikasi, dan audit; tidak ada transfer ownership otomatis.

### 20.2 Retention default

- Data Personal Workspace aktif dipertahankan selama akun aktif atau sampai pemilik menghapusnya.
- Akun tidak dihapus otomatis hanya karena tidak aktif. Setelah 12 bulan tidak aktif, sistem boleh mengirim pengingat keamanan/aktivitas; setelah 24 bulan dapat mengirim pengingat kedua dan meminta konfirmasi, tetapi penghapusan tetap memerlukan kebijakan eksplisit dan pemberitahuan yang memadai.
- Item yang diarsipkan tetap dimiliki user dan dipertahankan sampai user menghapusnya atau menghapus akun sesuai proses.
- Soft-deleted personal resources masuk masa pemulihan **30 hari**, kemudian dihapus permanen dari database aktif dan storage utama, kecuali legal hold atau kewajiban keamanan yang terdokumentasi.
- Backup terenkripsi yang immutable dapat menyimpan salinan terhapus sampai siklus rotasi maksimum **90 hari**; data tidak dipulihkan ke aplikasi aktif kecuali proses disaster recovery dan tombstone deletion diterapkan kembali.
- Retensi dokumen/log minimum yang diwajibkan untuk keamanan, pencegahan penyalahgunaan, sengketa, atau kewajiban hukum dapat dipisahkan, diminimalkan, dibatasi akses, dan dijelaskan dalam privacy notice.

### 20.3 Recovery dan pemulihan

- Recovery akun dimulai melalui provider autentikasi (Google/email) atau prosedur account recovery resmi dengan bukti kontrol yang memadai. Support tidak boleh meminta password, OTP, recovery code, atau token.
- Jika faktor autentikasi hilang, gunakan recovery codes sekali pakai atau prosedur verifikasi alternatif yang ditetapkan Platform; seluruh reset faktor diaudit.
- Pemulihan item yang dihapus dapat dilakukan pemilik dalam grace period 30 hari. Setelah purge final, pemulihan individual tidak dijanjikan; hanya backup/disaster recovery sesuai prosedur.
- Jika akun dinonaktifkan karena dugaan kompromi, sesi dicabut dan pemilik harus menyelesaikan verifikasi sebelum akses dipulihkan.

### 20.4 Export dan portability

- Pemilik dapat meminta export data personal dari Account Settings/Data Management.
- Export mencakup data personal yang dimiliki: metadata proyek, progres, lampiran/dokumen milik sendiri, serta histori aktivitas yang boleh diekspor. Tidak mencakup data tenant, data pengguna lain, secret, token, atau data pihak ketiga yang tidak berhak dibawa.
- Format baseline: JSON/CSV untuk data terstruktur dan file asli untuk lampiran; disediakan sebagai arsip terenkripsi atau tautan unduh sementara yang memerlukan autentikasi ulang.
- Link export berlaku maksimal 7 hari, satu pemilik, tidak publik, dan setiap permintaan/unduhan dicatat. Target pemenuhan standar maksimal 7 hari kalender; permintaan besar dapat diberi estimasi baru.
- Export tidak menghapus sumber data dan tidak memberikan akses ke data perusahaan.

### 20.5 Deletion dan penutupan akun

- Pemilik mengajukan deletion request dengan reauthentication dan konfirmasi dampak. Sistem menjelaskan bahwa data tenant dan audit perusahaan tidak ikut terhapus.
- Akun masuk status DELETION_PENDING, sesi dicabut, login dinonaktifkan, dan masa pembatalan **30 hari kalender** dimulai. Pemilik dapat membatalkan dengan autentikasi ulang selama grace period.
- Setelah 30 hari, sistem menghapus/pseudonimkan data personal dari database aktif dan storage utama sesuai data map. Backup mengikuti batas maksimum 90 hari. Pengecualian legal/security hold dicatat dengan alasan, data minimum, pemilik keputusan, dan tanggal review.
- Sebelum deletion final, pengguna dapat mengunduh export. Akun yang masih memegang Company Super Admin seat atau kewenangan aktif harus menyelesaikan transfer/revocation terlebih dahulu.
- Penghapusan User Identity tidak boleh menghapus atau merusak transaksi, dokumen, approval, atau audit milik tenant. Foreign key historis menggunakan tombstone/pseudonymous actor reference sesuai kebutuhan audit.
- Setelah purge selesai, identitas autentikasi dihapus sesuai dukungan provider; identifier minimum yang diperlukan untuk mencegah penyalahgunaan/duplikasi hanya boleh dipertahankan dengan dasar, masa retensi, dan akses yang terdokumentasi.

## 21. Existing implementation audit baseline dan aturan migrasi

Bagian ini mencatat temuan audit implementasi terhadap SSOT lama (v2.3) yang diberikan dalam percakapan pada 2026-11-14. Ini adalah **baseline temuan historis**, bukan hasil audit ulang terhadap HEAD saat ini dan bukan bukti bahwa kondisi tersebut masih persis sama. Sebelum perubahan kode/database/deployment, lakukan re-audit terhadap repository, Supabase Auth, migrations, RLS, RPC, Storage, frontend dan test.

### 21.1 Ringkasan kondisi historis

Audit lama melaporkan:
- Fondasi tersedia/sebagian: Supabase User Identity, Personal Workspace owner-only, Personal Projects CRUD/RLS, Company/Tenant structure, Company Onboarding approval, Company Membership dasar, Platform Super Admin dasar, Company Super Admin seat constraint, RFIN-A foundation, RFIN-B dasar, dan Unified Audit sebagian.
- Belum lengkap/teruji: multi-company, multi-persona, RBAC, ABAC, ReBAC, Employee Record, Authority Policy, Company Console, serial Workflow, Final Signatory, tenant isolation operasional, dan RFIN-B access configuration.
- Risiko kritis yang dilaporkan: akses publik QR/dokumen, policy read authenticated yang terlalu permisif, Workspace Switcher yang hanya client-side, tenant isolation legacy/global, dan validasi Platform Owner.
- Risiko tambahan: rate limit RFIN belum berbasis IP/device, permission admin RFIN belum granular, leaked-password protection Supabase Auth belum aktif, enam fungsi SECURITY DEFINER legacy belum diaudit mendalam, dan audit trail terpisah.

### 21.2 P0 yang harus diaudit dan ditangani terlebih dahulu

1. **QR/dokumen publik:** audit documents_public_verify, documents_read_authenticated, signatures_read_authenticated, Storage policies, signed/public URLs, QR routes dan metadata. Tutup akses anonim terhadap dokumen/TTE/QR privat; terapkan verifikasi autentikasi, permission document.qr.scan/document.qr.verify, tenant dan scope. Jangan mengungkap keberadaan dokumen lintas tenant.
2. **Active Context Resolver:** jangan percaya localStorage, workspace_id, company_id, persona_id, atau permission snapshot dari client. Server resolve user, tenant, membership, persona, role, permission, project/resource scope, authority, status dan session.
3. **Company registration/NPWP:** cocokkan schema aktual dengan keputusan v3.0. Enkripsi NPWP, key management, masking, access controls, duplicate checks, unique constraint, redaction logs, declaration/version, dan lifecycle application/provisioning harus diverifikasi. Tidak menambahkan persyaratan legal/KYC yang belum diputuskan.
4. **Platform Owner:** validasi identitas provider terverifikasi terhadap email bootstrap yang ditetapkan, gunakan stable auth.users.id, prosedur recovery/transfer terlindungi, dan audit tindakan sensitif.
5. **Tenant isolation:** petakan seluruh tabel, view, RPC, SECURITY DEFINER, Storage bucket/policy, edge function, dan modul legacy; buktikan cross-tenant deny dengan negative tests.

### 21.3 Temuan implementasi lanjutan

- **Membership administration:** Company Super Admin perlu RPC/service tenant-scoped untuk read/manage anggota tanpa membuka SELECT global membership ke semua authenticated users.
- **RFIN-B:** audit invitation binding, snapshot akses, one-time redemption atomik, expiry/revoke, recipient verification, rate limit akun/IP/device, dan audit.
- **Authorization engine:** migrasikan bertahap dari role legacy ke RBAC + ABAC + ReBAC; pertahankan kompatibilitas sampai modul diuji. ACL hanya pengecualian terkontrol.
- **Employee Record:** jangan mengonversi project_personnel menjadi Auth User otomatis; Employee Record terkait membership dan use case, bukan identitas login.
- **Workflow/final signatory:** implementasi serial active-step gating, SLA, delegasi, reassign, immutable event, final signatory appointment dan QR privat.
- **Unified Audit:** satukan konteks actor/tenant/persona/project/resource/action/result/reason; backend menentukan asal/tujuan context switch. Jangan simpan password, token, plaintext RFIN atau secret.
- **Legacy SECURITY DEFINER:** audit khusus enam fungsi create_boq_addition, current_user_role, record_cash_mutation, record_inventory_mutation, record_inventory_mutation_v2, reverse_inventory_transaction; jangan ubah terburu-buru, lakukan regression tests BOQ/inventory/cash.
- **Auth security:** tinjau rate limits per akun/IP/device, brute-force/credential stuffing, leaked-password protection, session revocation, recovery dan MFA policy.

### 21.4 Legacy data dan migrasi

Pertahankan keputusan historis berikut sampai ownership diputuskan eksplisit:
- CV Menara Megah tidak otomatis menjadi Company Workspace.
- PT IMK tidak otomatis menjadi tenant kedua.
- Data BOQ, stok, kas, progres, K3 dan dokumen legacy tidak dipindahkan tanpa kesepakatan ownership/scope.
- project_personnel bukan User Identity dan tidak dikonversi otomatis menjadi Auth User.
- Migrasi schema sebisa mungkin additive, mempunyai backup, rollback plan, data reconciliation, positive/negative tests, cross-tenant tests, dan regression tests.

### 21.5 Urutan implementasi berdasarkan dependensi

| Fase | Pekerjaan | Prioritas |
|---|---|---|
| 0 | Tutup jalur publik QR/dokumen dan audit Storage/RPC | P0 |
| 1 | Active Context Resolver, tenant isolation, Platform Owner verification | P0 |
| 2 | Company registration, NPWP protection, provisioning claim lifecycle | P0 |
| 3 | Membership administration dan RFIN-B access configuration | P1 |
| 4 | Persona, RBAC, permission catalog, ABAC/ReBAC enforcement | P1 |
| 5 | Employee Record (conditional) dan project membership/scope | P1 |
| 6 | Authority policy dan assignment | P1 |
| 7 | Workflow serial, SLA, delegation dan escalation | P1 |
| 8 | Final Signatory dan TTE/QR privat | P1 |
| 9 | Unified Audit Trail dan Company Console | P1/P2 |
| 10 | Personal data lifecycle/export/recovery/deletion | P2 |
| 11 | Growth Journey dan fitur lanjutan | P3 |

Setiap fase wajib memiliki migration, backend enforcement, RLS, positive/negative tests, cross-tenant/cross-project tests, legacy regression, documentation, backup dan rollback. Deployment hanya setelah pemeriksaan dan approval perubahan yang sesuai.

## 22. Keputusan v3.0 dan hal yang tetap memerlukan spesifikasi lanjutan

Keputusan normatif yang kini ditetapkan:
- A2F/MFA adalah fitur platform opsional yang dapat diaktifkan tenant dalam katalog dan guardrail Platform.
- Company Application, tenant provisioning, dan Company Super Admin signup/claim adalah proses terpisah; keputusan Platform mendahului signup/claim pemegang kursi.
- RFIN-B diterbitkan setelah penerima dan konfigurasi akses disiapkan; redemption mengikat identitas terverifikasi, membuat membership, dan menerapkan snapshot akses secara atomik.
- Baseline permission konvensional per modul/action ditetapkan pada Bagian 18.
- Workflow contract, SLA default, delegation, reassignment dan escalation ditetapkan pada Bagian 19.
- Personal Workspace retention, recovery, export dan deletion baseline ditetapkan pada Bagian 20.
- Audit implementasi v2.3 dipertahankan sebagai temuan historis untuk re-audit, bukan dianggap sebagai kondisi HEAD terkini.

Hal yang masih memerlukan spesifikasi teknis sebelum implementasi (bukan keputusan bisnis yang dibiarkan ambigu):
- Mapping permission baseline ke setiap tabel/API/RPC aktual dan katalog final granular per modul.
- Schema database final, indeks, constraint, trigger, RPC names/payloads, error schema, dan cache invalidation.
- Kalender hari libur, SLA khusus tiap workflow, batas transaksi dan authority per tenant.
- Provider MFA yang benar-benar tersedia pada deployment dan cara memvalidasi assurance signal.
- Data map final, backup architecture, legal hold, privacy notice dan retensi legal sesuai yurisdiksi.
- Migrasi legacy dan acceptance tests per modul berdasarkan audit ulang.

### Versi 3.0 — 2026-11-14
- Menetapkan A2F/MFA sebagai fitur opsional dari katalog Platform yang dapat diaktifkan tenant, bukan persyaratan universal; membedakan Google OAuth sebagai sign-in dari faktor kedua.
- Memisahkan Company Application, provisioning tenant, dan signup/claim baru Company Super Admin yang memerlukan persetujuan Platform.
- Menetapkan alur RFIN-B berbasis invitee, konfigurasi akses sebelum issuance, Effective Access Preview, email binding, signup/sign-in, redemption atomik, dan lifecycle Invitation/Membership yang terpisah.
- Menambahkan baseline matriks permission untuk aplikasi bisnis konvensional dan prinsip least privilege/non-destructive correction.
- Menambahkan kontrak Workflow Engine, SLA default, reminder/escalation, delegation, reassignment, concurrency, dan audit.
- Menetapkan lifecycle Personal Workspace untuk retention, recovery, export, deletion, serta pemisahan data personal dan tenant.
- Memasukkan audit v2.3 sebagai baseline historis yang wajib diverifikasi ulang, bukan klaim kondisi implementasi terkini.


### Versi 2.7 — 2026-11-14
- Autentikasi Company Super Admin diperjelas: sign-up melalui email/Google; sign-in menggunakan NPWP + kata sandi. Sesi dipetakan ke User Identity internal dan tenant yang benar. Kontrol password hashing, rate limiting, proteksi brute-force, reset/recovery, dan audit diwajibkan.

### Versi 3.0 — 2026-11-14
- Finalisasi keputusan bisnis dan spesifikasi normatif tambahan sebagaimana Bagian 17–22.

### Versi 2.6 — 2026-11-14
- Company Identity Registration menggunakan NPWP + Google; status PENDING sampai Platform Super Admin memutuskan ACCEPTED/REJECTED. Review bukan verifikasi legal independen/KYC; identitas pemohon terpisah dan dokumen legal bukan syarat standar.
- Sign-up Company Super Admin menggunakan email/Google; sign-in berikutnya menggunakan NPWP + kata sandi. NPWP adalah login identifier, bukan password. Sesi tetap terikat pada User Identity internal dan tenant; password hashing, rate limiting, brute-force protection, reset/recovery, serta audit autentikasi wajib diterapkan.
- Perubahan field tenant platform-controlled diajukan melalui Console dan Platform Administration Engine.
- Final signing didasarkan pada User Identity terautentikasi + Company Membership aktif + appointment eksplisit aktif. Employee Record/persona/jabatan/approval level/senioritas/department/authority tambahan bukan prasyarat universal. QR scan/verifikasi terpisah.
- Mandatory/optional/future organization scope ditegaskan; Organization Structure Builder bukan mandatory.
- Workflow Initiator Permission dan Approver Eligibility Pool membatasi pemilihan approver per dokumen.
- Initial notification paralel, eksekusi serial, dan SLA dimulai ketika masing-masing step aktif.
- Lifecycle Company Application, Company/Tenant, Invitation dan Membership dipisahkan; RFIN bukan permission, authority, atau signing key.
- Glossary, onboarding, data model, editorial, dan referensi antarbagian dirapikan.

### Versi 2.5 — 2026-11-14
- Memperjelas Company Identity Registration berbasis nama perusahaan, NPWP, business email, identitas pemohon, dan pernyataan kebenaran; membedakan deklarasi/pemeriksaan format dari verifikasi legal independen, serta menegaskan ProyekCair bukan otoritas pemerintah.
- Menambahkan Workspace Switcher di Navbar untuk Personal/Umum, daftar perusahaan yang memiliki membership sah, dan persona yang ditugaskan; server-side context tetap menjadi sumber otorisasi.
- Menetapkan pendekatan Company Console berbasis penugasan individu dan menghapus Org Structure Builder/departemen/divisi/bagan organisasi sebagai kebutuhan wajib; Employee Record hanya untuk kebutuhan operasional tertentu dan Project Membership/Scope tetap wajib.
- Menegaskan label jabatan/approval level merupakan preset/atribut deskriptif yang dapat disesuaikan perusahaan, bukan pemberi permission atau authority otomatis.
- Memperjelas bahwa seluruh approver menerima notifikasi secara paralel, sedangkan eksekusi approve/reject/return tetap serial dan hanya step aktif yang dapat bertindak; pembuat dokumen dapat memilih urutan approver per dokumen dengan validasi backend.
- Menyelaraskan penunjukan final signatory/TTE/QR: perusahaan bertanggung jawab atas verifikasi dan pemilihan internal; syarat platform adalah User Identity terautentikasi dan Company Membership aktif yang didaftarkan Company Super Admin. Tidak ada persyaratan jabatan/senioritas atau KTP/NIK/KYC independen oleh ProyekCair.
- Menegaskan kembali TTE/QR privat, non-publik, dan batas akses tenant; tidak mengubah keputusan tentang approval serial, notifikasi paralel, atau akses scan/verifikasi privat.


### Versi 2.4 — 2026-11-14
- Menambahkan Workspace Architecture Specification untuk empat pengalaman: Platform Super Admin, Company Super Admin Console, Company Operational/Persona, dan Personal Workspace (General User Type B).
- Menegaskan bahwa Persona Workspace adalah pengalaman operasional dalam Company/Tenant, bukan tenant atau jenis kepemilikan terpisah.
- Merinci target menu, konten frontend, tanggung jawab backend, dashboard, invitation configuration, monitoring, dan workflow per konteks.
- Menambahkan prinsip satu kerangka aplikasi operasional yang menampilkan menu/widget berdasarkan effective access; permission tetap ditegakkan backend/database.
- Menambahkan contoh Active Workspace Context, permission mapping, tanggung jawab lapisan, dan acceptance criteria minimum sinkronisasi frontend-backend.
- Memisahkan rancangan fitur personal yang telah ditetapkan SSOT dari kandidat fitur produk yang masih memerlukan keputusan.
- Menegaskan bahwa seluruh menu, tabel, permission, endpoint, dan widget di bagian baru merupakan target specification, bukan bukti implementasi.
