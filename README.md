# UDU / Proyek Cair — Kontrol BOQ, Stok, dan Kas

Aplikasi ini menggunakan Supabase sebagai sumber data operasional. Tidak ada seed/demo transaksi, akun demo, atau fallback data contoh pada frontend.

## Sumber data BOQ

- Workbook sumber: `BOQ UDU & TIM TRAINER (CV.MENARA MEGAH).xlsx`
- Sheet yang dipakai: `Trainer & UDU Office`
- Sheet `Trainer & UDU Office (2)`: **tidak dipakai**.
- Dataset: `supabase/seed/boq_trainer_udu_office_sheet1.csv`
- Hasil import: 275 baris BOQ, 275 nomor baris Excel unik.
- Klasifikasi: 263 item material yang dikontrol melalui mutasi fisik; 12 baris jasa/non-stok yang hanya menjadi referensi BOQ.
- Kolom Qty BOQ dan UOM adalah referensi kontrak. Keduanya bukan saldo gudang.
- Saldo fisik dimulai dari 0 karena tidak ada data stok awal terverifikasi yang diberikan. Saldo hanya berubah melalui ledger `inventory_transactions`.

Kepemilikan `By IMK` dan `By kontraktor` dipertahankan dari workbook sumber.

## Sumber data operasional

- `boq_items`: master BOQ.
- `inventory_transactions`: ledger barang masuk/keluar; saat ini belum ada transaksi.
- `cash_transactions`: ledger kas; saat ini belum ada transaksi.
- `documents`: metadata laporan dan snapshot checksum; saat ini belum ada laporan.
- `profiles`: akun autentikasi riil; tidak ada akun demo.
- `audit_logs`: jejak tindakan sistem.

Jangan membuat transaksi awal, saldo, kuitansi, laporan, progres, atau insiden fiktif untuk mengisi dashboard.

## Autentikasi dan izin

Frontend menggunakan Supabase Auth. Profil baru otomatis dibuat dengan role awal `viewer`.

- Mutasi stok: `admin`, `site_manager`, `storekeeper`.
- Baca buku kas: `admin`, `site_manager`, `finance`, `auditor`.
- Mutasi kas: `admin`, `site_manager`, `finance`.
- Registrasi metadata laporan: `admin`, `site_manager`, `finance`, `auditor`.

Mutasi stok dan kas wajib melalui RPC database dengan validasi role, saldo, dan idempotency key. Jangan pernah menaruh Supabase `service_role` key di frontend.

## Environment

Atur di Vercel untuk Production, Preview, dan Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable/anon key)

Google OAuth callback untuk Supabase:
`https://sjwheagxwpnqckmqxyme.supabase.co/auth/v1/callback`

## Database migrations

Migration SQL pada `supabase/migrations/` harus disimpan di repository dan dijalankan berurutan. BOQ import disimpan sebagai migration serta CSV seed agar sumber datanya dapat diaudit dan direproduksi.

## Status implementasi — jangan menganggap fitur belum ada sebagai data

Sudah terpasang:
- Supabase Auth email/password dan Google OAuth.
- Master BOQ sheet 1, Qty, UOM, kepemilikan, dan klasifikasi material/non-stok.
- Ledger mutasi stok dan kas melalui RPC database.
- Pembacaan data Supabase dan kontrol akses berbasis role.
- Registrasi laporan dengan checksum snapshot SHA-256.

Belum tersedia / belum boleh diklaim aktif:
- Offline-first queue dan sinkronisasi IndexedDB.
- Progres fisik, Kurva-S, foto lapangan, dan persetujuan progres.
- Modul K3, work permit, hazard, dan insiden.
- Tanda tangan digital yang mengautentikasi identitas (mis. Ed25519).
- Verifikasi publik tanpa login dan verifikasi byte PDF tersimpan di storage.
- Upload foto bukti surat jalan/kuitansi ke Supabase Storage.

Laporan PDF saat ini berstatus **DRAFT**. QR hanya membuka catatan laporan internal dan memeriksa checksum snapshot data; ini bukan tanda tangan digital dan tidak membuktikan keaslian byte PDF.

## Build

```bash
npm run lint
npm run build
```

Build production menjalankan `tsc --noEmit` sebelum `vite build`.
