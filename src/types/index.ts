export type AvailabilityStatus = 'Belum Dicatat' | 'Tersedia' | 'Stok Menipis' | 'Tidak Tersedia';

export interface ItemBarang {
  id: string;
  kode_boq: string;
  source_sheet?: string;
  source_row?: number;
  nama_barang: string;
  kategori: string;
  satuan: string;
  qty_boq: number;
  is_stock_item: boolean;
  has_stock_history: boolean;
  qty_tambahan_disetujui: number;
  target_kebutuhan_total: number;
  qty_masuk_total: number;
  qty_keluar_total: number;
  qty_pemenuhan_sisa: number;
  progress_pemenuhan: number;
  status_pemenuhan: 'Belum dipenuhi' | 'Dalam pemenuhan' | 'Terpenuhi' | 'Melebihi BOQ';
  harga_satuan: number;
  stok_saat_ini: number;
  stok_minimum: number;
  status: AvailabilityStatus;
  terakhir_mutasi?: string;
  keterangan?: string;
}

export type JenisMutasiBarang = 'MASUK' | 'KELUAR';

export interface MutasiBarang {
  id: string;
  barang_id: string;
  nama_barang: string;
  jenis: JenisMutasiBarang;
  jumlah: number;
  satuan: string;
  tujuan_keperluan: string; // misal: "Pengecoran sloof 6x8", "Pemasangan kabel ruang rapat"
  pic_penerima_penyerah: string;
  nomor_surat_jalan?: string;
  tanggal: string; // ISO String
  stok_sebelum: number;
  stok_sesudah: number;
  catatan?: string;
  source_name?: string;
  destination_name?: string;
  recipient_name?: string;
  owner_type?: 'KONTRAKTOR'|'IMK';
  purpose?: string;
  addition_id?: string;
}

export type JenisMutasiKas = 'MASUK' | 'KELUAR';

export interface MutasiKas {
  id: string;
  jenis: JenisMutasiKas; // IN / OUT
  jumlah_rp: number;
  untuk_apa: string; // Uraian peruntukan / alasan kas
  kategori_keperluan: 'Material' | 'Upah & Konsumsi' | 'Operasional' | 'Sewa Alat & Angkut' | 'Dana Termin Proyek' | 'Lainnya';
  pic: string;
  nomor_kuitansi?: string;
  tanggal: string; // ISO String
  saldo_setelah: number; // Running balance
  catatan?: string;
}

export interface DokumenLaporan {
  id: string; // e.g. "DOC-PC-202611-001"
  judul: string;
  jenis: 'MUTASI_STOK' | 'MUTASI_KAS' | 'GABUNGAN_PROYEK';
  status: string;
  periode_awal: string;
  periode_akhir: string;
  dibuat_pada: string;
  penandatangan_nama: string;
  penandatangan_jabatan: string;
  penandatangan_email: string;
  hash_keamanan: string;
  total_transaksi: number;
  ringkasan_nilai_rp: number;
  qr_payload: string;
  snapshot_json?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: 'Admin' | 'Project Manager' | 'Logistik & Gudang' | 'Site Manager' | 'Finance' | 'Auditor' | 'Viewer';
  provider: 'google' | 'guest';
  databaseRole?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastSynced?: string;
}
