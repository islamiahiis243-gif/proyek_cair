import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Boxes,
  WalletCards,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  FileText,
  ShieldCheck,
  TrendingUp,
  PackageX,
  PackageCheck,
  Clock,
  ChevronRight,
  Building,
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '../lib/pdfGenerator';

interface DashboardViewProps {
  onOpenStockModal: (type?: 'MASUK' | 'KELUAR') => void;
  onOpenCashModal: (type?: 'MASUK' | 'KELUAR') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenStockModal,
  onOpenCashModal,
}) => {
  const {
    items,
    stockMutations,
    cashMutations,
    totalStockAssetValue,
    currentCashBalance,
    cashAccess,
    outOfStockCount,
    lowStockCount,
    availableStockCount,
    setCurrentView,
  } = useApp();

  // Cash stats
  const totalCashIn = cashMutations
    .filter((c) => c.jenis === 'MASUK')
    .reduce((sum, c) => sum + c.jumlah_rp, 0);

  const totalCashOut = cashMutations
    .filter((c) => c.jenis === 'KELUAR')
    .reduce((sum, c) => sum + c.jumlah_rp, 0);

  // Stock mutation stats
  const totalStockInQty = stockMutations
    .filter((m) => m.jenis === 'MASUK')
    .reduce((sum, m) => sum + m.jumlah, 0);

  const totalStockOutQty = stockMutations
    .filter((m) => m.jenis === 'KELUAR')
    .reduce((sum, m) => sum + m.jumlah, 0);

  const totalItemCount = items.filter((item) => item.is_stock_item).length;
  const availablePercent = totalItemCount > 0 ? Math.round((availableStockCount / totalItemCount) * 100) : 0;
  const lowPercent = totalItemCount > 0 ? Math.round((lowStockCount / totalItemCount) * 100) : 0;
  const outPercent = totalItemCount > 0 ? Math.round((outOfStockCount / totalItemCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Dashboard Analitik Proyek Cair
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Data Supabase
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Monitoring arus barang keluar-masuk dan mutasi kas proyek pembangunan Trainer & UDU Office.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenStockModal('MASUK')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-200" />
            <span>+ Stok Masuk</span>
          </button>

          <button
            onClick={() => onOpenStockModal('KELUAR')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>- Stok Keluar</span>
          </button>

          {cashAccess && <>
          <button
            onClick={() => onOpenCashModal('MASUK')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>+ Kas Masuk</span>
          </button>

          <button
            onClick={() => onOpenCashModal('KELUAR')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors border border-rose-200 dark:border-rose-800"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>- Kas Keluar</span>
          </button>
          </>}
        </div>
      </div>

      {/* Stock Zero Warning Notice */}
      {outOfStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3 transition-colors">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Otomasi Status Stok Aktif: {outOfStockCount} item berstatus "Tidak Tersedia" (stok = 0).
            </span>{' '}
            <span className="text-amber-800 dark:text-amber-300/80">
              Saldo fisik saat ini dihitung dari ledger mutasi, bukan dari Qty BOQ. Saat barang benar-benar diterima di lokasi proyek via menu{' '}
              <strong className="underline cursor-pointer" onClick={() => onOpenStockModal('MASUK')}>
                Mutasi Masuk
              </strong>
              , status item akan otomatis beralih menjadi Tersedia.
            </span>
          </div>
          <button
            onClick={() => setCurrentView('inventory')}
            className="text-xs font-semibold text-amber-900 dark:text-amber-300 hover:underline shrink-0"
          >
            Lihat Katalog →
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Kas */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo Kas Proyek</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <WalletCards className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {cashAccess?formatRupiah(currentCashBalance):'Akses terbatas'}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Masuk: {cashAccess?formatRupiah(totalCashIn):'—'}</span>
            <span>Keluar: {cashAccess?formatRupiah(totalCashOut):'—'}</span>
          </div>
        </div>

        {/* Card 2: Valuasi Aset Stok */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Valuasi Stok Fisik</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatRupiah(totalStockAssetValue)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Total Item BOQ: {items.length} item</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium cursor-pointer" onClick={() => setCurrentView('inventory')}>
              Lihat Detail
            </span>
          </div>
        </div>

        {/* Card 3: Status Ketersediaan */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Ketersediaan Barang</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{availableStockCount}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Tersedia ({availablePercent}%)</span>
          </div>
          <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div style={{ width: `${availablePercent}%` }} className="bg-emerald-500" title={`Tersedia: ${availableStockCount}`} />
            <div style={{ width: `${lowPercent}%` }} className="bg-amber-500" title={`Menipis: ${lowStockCount}`} />
            <div style={{ width: `${outPercent}%` }} className="bg-rose-500" title={`Kosong: ${outOfStockCount}`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">Tersedia: {availableStockCount}</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">Menipis: {lowStockCount}</span>
            <span className="text-rose-700 dark:text-rose-400 font-medium">Kosong: {outOfStockCount}</span>
          </div>
        </div>

        {/* Card 4: Volume Transaksi */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Aktivitas Mutasi</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {stockMutations.length + cashMutations.length}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>Stok: {stockMutations.length} trx</span>
            <span>Kas: {cashMutations.length} trx</span>
          </div>
        </div>
      </div>

      {/* Two-Column Analytics: Recent Stock vs Recent Cash Mutations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Stock Mutations */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Mutasi Barang Terkini</h2>
            </div>
            <button
              onClick={() => setCurrentView('stock-mutations')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {stockMutations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                Belum ada transaksi mutasi barang.
              </div>
            ) : (
              stockMutations.slice(0, 5).map((mut) => (
                <div key={mut.id} className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        mut.jenis === 'MASUK'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {mut.jenis === 'MASUK' ? 'IN' : 'OUT'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {mut.nama_barang}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {mut.tujuan_keperluan}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>PIC: {mut.pic_penerima_penyerah}</span>
                        <span>·</span>
                        <span>{formatDateTime(mut.tanggal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold font-mono tabular-nums ${
                        mut.jenis === 'MASUK' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {mut.jenis === 'MASUK' ? '+' : '-'} {mut.jumlah} {mut.satuan}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                      Sisa: {mut.stok_sesudah} {mut.satuan}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Recent Cash Mutations (Kas Masuk/Keluar/Untuk Apa/Saldo) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-colors">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletCards className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Buku Mutasi Kas Terkini</h2>
            </div>
            <button
              onClick={() => setCurrentView('cashflow')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1"
            >
              <span>Lihat Semua</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {cashMutations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                {cashAccess?'Belum ada transaksi kas.':'Data kas tidak tersedia untuk role akun ini.'}
              </div>
            ) : (
              cashMutations.slice(-5).reverse().map((c) => (
                <div key={c.id} className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        c.jenis === 'MASUK'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {c.jenis === 'MASUK' ? 'IN' : 'OUT'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {c.untuk_apa}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{c.kategori_keperluan}</span>
                        <span>·</span>
                        <span>PIC: {c.pic}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatDateTime(c.tanggal)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold font-mono tabular-nums ${
                        c.jenis === 'MASUK' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {c.jenis === 'MASUK' ? '+' : '-'} {formatRupiah(c.jumlah_rp)}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                      Saldo: {formatRupiah(c.saldo_setelah)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Export PDF Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold">Cetak Laporan Otomatis & QR Code Validasi</h3>
          </div>
          <p className="mt-1 text-xs text-slate-300 max-w-xl">
            Buat PDF dari transaksi nyata, dengan QR registrasi dan checksum snapshot data. Fitur ini bukan tanda tangan digital.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('reports')}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Buka Studio Laporan PDF</span>
        </button>
      </div>
    </div>
  );
};
