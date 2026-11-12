import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { JenisMutasiKas, MutasiKas } from '../types';
import {
  WalletCards,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Plus,
  Receipt,
  AlertTriangle,
  Building,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '../lib/pdfGenerator';

interface CashflowViewProps {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  defaultType?: JenisMutasiKas;
  modalOnly?: boolean;
}

export const CashflowView: React.FC<CashflowViewProps> = ({
  isModalOpen,
  setIsModalOpen,
  defaultType = 'KELUAR',
  modalOnly = false,
}) => {
  const { cashMutations, addCashMutation, currentCashBalance, user, cashAccess } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'MASUK' | 'KELUAR'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Form states
  const [jenis, setJenis] = useState<JenisMutasiKas>(defaultType);
  const [amount, setAmount] = useState<number>(0);
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState<MutasiKas['kategori_keperluan']>('Material');
  const [pic, setPic] = useState(user.name);
  const [receipt, setReceipt] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (defaultType) {
      setJenis(defaultType);
    }
  }, [defaultType]);

  const totalIn = useMemo(() => {
    return cashMutations.filter((c) => c.jenis === 'MASUK').reduce((acc, c) => acc + c.jumlah_rp, 0);
  }, [cashMutations]);

  const totalOut = useMemo(() => {
    return cashMutations.filter((c) => c.jenis === 'KELUAR').reduce((acc, c) => acc + c.jumlah_rp, 0);
  }, [cashMutations]);

  const projectedBalance = jenis === 'MASUK' ? currentCashBalance + Number(amount || 0) : currentCashBalance - Number(amount || 0);

  const filteredList = useMemo(() => {
    return cashMutations.filter((c) => {
      const matchSearch =
        c.untuk_apa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.pic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.nomor_kuitansi && c.nomor_kuitansi.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = filterType === 'ALL' || c.jenis === filterType;
      const matchCat = filterCategory === 'ALL' || c.kategori_keperluan === filterCategory;

      return matchSearch && matchType && matchCat;
    });
  }, [cashMutations, searchQuery, filterType, filterCategory]);

  const handleOpenModal = (t: JenisMutasiKas) => {
    setJenis(t);
    setAmount(0);
    setPurpose('');
    setCategory(t === 'MASUK' ? 'Dana Termin Proyek' : 'Material');
    setPic(user.name);
    setReceipt('');
    setNotes('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmitCash = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (amount <= 0) {
      setErrorMessage('Nominal kas harus lebih besar dari Rp 0!');
      return;
    }

    if (!purpose.trim()) {
      setErrorMessage('Kolom "Untuk Apa" (Uraian keperluan kas) wajib diisi!');
      return;
    }

    const res = await addCashMutation({
      jenis,
      jumlah_rp: Number(amount),
      untuk_apa: purpose.trim(),
      kategori_keperluan: category,
      pic: pic.trim() || user.name,
      nomor_kuitansi: receipt.trim() || undefined,
      tanggal: new Date().toISOString(),
      catatan: notes.trim() || undefined,
    });

    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    setIsModalOpen(false);
  };

  if (modalOnly && !isModalOpen) {
    return null;
  }

  if (!cashAccess) {
    return modalOnly ? null : <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Akses Buku Kas tidak diberikan untuk role akun ini. Hubungi administrator proyek jika Anda memerlukan akses.</div>;
  }

  return (
    <div className={modalOnly ? '' : 'space-y-5'}>
      {!modalOnly && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Mutasi Kas Keuangan Proyek
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Buku kas lapangan terpisah: pencatatan kas masuk, kas keluar, rincian peruntukan belanja/penerimaan, dan saldo berjalan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal('MASUK')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Kas Masuk (IN)</span>
          </button>
          <button
            onClick={() => handleOpenModal('KELUAR')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>- Kas Keluar (OUT)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total In */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Kas Masuk (IN)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatRupiah(totalIn)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {cashMutations.filter((c) => c.jenis === 'MASUK').length} kali penerimaan dana
          </div>
        </div>

        {/* Total Out */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Kas Keluar (OUT)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-rose-700 dark:text-rose-400 tabular-nums">
            {formatRupiah(totalOut)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {cashMutations.filter((c) => c.jenis === 'KELUAR').length} kali pengeluaran lapangan
          </div>
        </div>

        {/* Sisa Saldo */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo Kas Berjalan</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <WalletCards className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatRupiah(currentCashBalance)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Arus kas terverifikasi seimbang
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari keperluan belanja (untuk apa), PIC, atau nomor nota/kuitansi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Jenis Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'MASUK', label: 'Kas Masuk' },
              { id: 'KELUAR', label: 'Kas Keluar' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id as any)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filterType === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Kategori Select */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="Material">Material</option>
            <option value="Upah & Konsumsi">Upah & Konsumsi</option>
            <option value="Operasional">Operasional</option>
            <option value="Sewa Alat & Angkut">Sewa Alat & Angkut</option>
            <option value="Dana Termin Proyek">Dana Termin Proyek</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
      </div>

      {/* Cash Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3.5">Waktu Transaksi</th>
                <th className="py-3 px-3.5 text-center">Jenis</th>
                <th className="py-3 px-3.5">Untuk Apa (Peruntukan Kas)</th>
                <th className="py-3 px-3.5">Kategori</th>
                <th className="py-3 px-3.5">PIC</th>
                <th className="py-3 px-3.5 text-right">Kas Masuk (IN)</th>
                <th className="py-3 px-3.5 text-right">Kas Keluar (OUT)</th>
                <th className="py-3 px-3.5 text-right font-bold">Saldo Berjalan</th>
                <th className="py-3 px-3.5 text-center">Ref / Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Belum ada transaksi kas keuangan.
                  </td>
                </tr>
              ) : (
                filteredList.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {formatDateTime(c.tanggal)}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.jenis === 'MASUK'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                        }`}
                      >
                        {c.jenis === 'MASUK' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {c.jenis}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900 dark:text-slate-100 max-w-sm">
                      <div>{c.untuk_apa}</div>
                      {c.catatan && <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal italic mt-0.5">{c.catatan}</div>}
                    </td>
                    <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                        {c.kategori_keperluan}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300">{c.pic}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {c.jenis === 'MASUK' ? formatRupiah(c.jumlah_rp) : '-'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold tabular-nums text-rose-700 dark:text-rose-400">
                      {c.jenis === 'KELUAR' ? formatRupiah(c.jumlah_rp) : '-'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/30">
                      {formatRupiah(c.saldo_setelah)}
                    </td>
                    <td className="py-3 px-3.5 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {c.nomor_kuitansi || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Menampilkan {filteredList.length} dari {cashMutations.length} entri pembukuan kas</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Saldo Kas Akhir: {formatRupiah(currentCashBalance)}
          </span>
        </div>
      </div>
        </>
      )}

      {/* Modal Add Cash Mutation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="font-bold text-sm flex items-center gap-2">
                <WalletCards className="w-4 h-4 text-emerald-400" />
                <span>
                  Catat Mutasi Kas Keuangan: {jenis === 'MASUK' ? 'Kas Masuk (IN)' : 'Kas Keluar (OUT)'}
                </span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCash} className="p-5 space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Toggle Jenis */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setJenis('MASUK')}
                  className={`py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    jenis === 'MASUK'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Kas Masuk (IN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setJenis('KELUAR')}
                  className={`py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    jenis === 'KELUAR'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Kas Keluar (OUT)</span>
                </button>
              </div>

              {/* Amount Nominal */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nominal Uang (Rupiah) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500">Rp</span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    placeholder="0"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Terbilang: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(amount)}</span>
                </div>
              </div>

              {/* Untuk Apa (Peruntukan) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Untuk Apa (Peruntukan / Keperluan Dana) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Pembelian semen 50 bag tunai toko Surya, Uang makan tukang lembur cor plat..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Kategori & PIC */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori Keperluan</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Material">Material</option>
                    <option value="Upah & Konsumsi">Upah & Konsumsi</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Sewa Alat & Angkut">Sewa Alat & Angkut</option>
                    <option value="Dana Termin Proyek">Dana Termin Proyek</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">PIC / Petugas</label>
                  <input
                    type="text"
                    value={pic}
                    onChange={(e) => setPic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>
              </div>

              {/* No Kuitansi */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor Kuitansi / Bukti Nota</label>
                <input
                  type="text"
                  placeholder="Contoh: NOTA-SURYA-8821 / KWT-TRM-02"
                  value={receipt}
                  onChange={(e) => setReceipt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>

              {/* Saldo Simulation Preview */}
              <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Saldo Saat Ini:</span>
                  <span className="font-mono">{formatRupiah(currentCashBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span>Perubahan ({jenis}):</span>
                  <span className={`font-mono font-semibold ${jenis === 'MASUK' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                    {jenis === 'MASUK' ? '+' : '-'} {formatRupiah(amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                  <span>Proyeksi Saldo Akhir:</span>
                  <span className="font-mono">{formatRupiah(projectedBalance)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-colors ${
                    jenis === 'MASUK'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Simpan Transaksi Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
