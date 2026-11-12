import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Download,
  QrCode,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Printer,
  Boxes,
  WalletCards,
} from 'lucide-react';
import {
  generateStockMutationPDF,
  generateCashflowPDF,
  formatDateTime,
  formatDateOnly,
  formatRupiah,
} from '../lib/pdfGenerator';

export const ReportsView: React.FC = () => {
  const { stockMutations, cashMutations, documents, addDocument, user, setVerifyingDocId, setCurrentView } = useApp();

  const [reportType, setReportType] = useState<'stock' | 'cash'>('stock');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [signerName, setSignerName] = useState(user.name);
  const [signerRole, setSignerRole] = useState(user.role);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);

  const handleGeneratePDF = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerationSuccess(null);

    try {
      const docCounter = documents.length + 1;
      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const docId = `DOC-PC-${dateTag}-${String(docCounter).padStart(3, '0')}`;

      const activeUser = {
        ...user,
        name: signerName.trim() || user.name,
        role: signerRole as any,
      };

      if (reportType === 'stock') {
        const filtered = stockMutations.filter((m) => {
          const dateOnly = m.tanggal.split('T')[0];
          return dateOnly >= startDate && dateOnly <= endDate;
        });

        if (filtered.length === 0) throw new Error('Tidak ada transaksi stok pada periode yang dipilih. Laporan tidak dibuat.');
        const newDoc = await generateStockMutationPDF({
          docId,
          startDate,
          endDate,
          mutations: filtered,
          signer: activeUser,
        });

        await await addDocument(newDoc);
        setGenerationSuccess(`Laporan Mutasi Barang (${docId}) berhasil dicetak dan diunduh.`);
      } else {
        const filtered = cashMutations.filter((c) => {
          const dateOnly = c.tanggal.split('T')[0];
          return dateOnly >= startDate && dateOnly <= endDate;
        });

        if (filtered.length === 0) throw new Error('Tidak ada transaksi kas pada periode yang dipilih. Laporan tidak dibuat.');
        const newDoc = await generateCashflowPDF({
          docId,
          startDate,
          endDate,
          cashMutations: filtered,
          signer: activeUser,
        });

        await addDocument(newDoc);
        setGenerationSuccess(`Laporan Buku Kas (${docId}) berhasil dicetak dan diunduh.`);
      }
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Gagal menghasilkan PDF: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerifyDoc = (docId: string) => {
    setVerifyingDocId(docId);
    setCurrentView('verification');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Studio Laporan & Ekspor PDF
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ekspor laporan resmi berkode QR verifikasi keaslian digital otomatis yang dicetak langsung di lembar dokumen PDF.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/60">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Tanda Tangan & QR Code Terverifikasi</span>
        </div>
      </div>

      {generationSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{generationSuccess}</span>
          </div>
          <button
            onClick={() => setGenerationSuccess(null)}
            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Generator Form */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-colors">
        <form onSubmit={handleGeneratePDF} className="space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Konfigurasi Dokumen Laporan</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tentukan jenis laporan, rentang tanggal transaksi, serta pihak penandatangan digital.
            </p>
          </div>

          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Pilih Jenis Laporan <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportType('stock')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  reportType === 'stock'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    reportType === 'stock'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Laporan Mutasi Keluar / Masuk Barang
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Rekapitulasi keluar-masuk stok material fisik proyek, tujuan pemakaian, volume, dan nama PIC lapangan.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportType('cash')}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
                  reportType === 'cash'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 dark:border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    reportType === 'cash'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <WalletCards className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Laporan Mutasi Kas Keuangan Proyek
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Buku kas mutasi: Kas masuk (IN), Kas keluar (OUT), peruntukan belanja ("Untuk Apa"), dan saldo kas berjalan.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dari Tanggal (Periode Awal)
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sampai Tanggal (Periode Akhir)
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Signer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Penandatangan Resmi (Site Manager / PIC)
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Jabatan / Kedudukan Proyek
              </label>
              <input
                type="text"
                required
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Features info bar */}
          <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Fitur QR Code Otomatis:</span>{' '}
              Setiap kali dokumen PDF dibuat, sistem secara otomatis merender gambar QR Code beresolusi tinggi di pojok kanan bawah. Saat di-scan, QR Code tersebut mengarahkan pembaca ke Halaman Validasi Digital resmi untuk memastikan dokumen asli dan belum dimanipulasi.
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Memproses Dokumen PDF...' : 'Ekspor & Unduh PDF Sekarang'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Issued Documents Archive */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Arsip Dokumen Resmi yang Diterbitkan</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar dokumen laporan yang tersimpan dalam sistem dengan tanda tangan QR Code terdaftar.
            </p>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
            {documents.length} Dokumen
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {documents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
              Belum ada dokumen yang diterbitkan.
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{doc.judul}</span>
                      <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                        {doc.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Periode: {formatDateOnly(doc.periode_awal)} - {formatDateOnly(doc.periode_akhir)}</span>
                      <span>·</span>
                      <span>Penandatangan: {doc.penandatangan_nama} ({doc.penandatangan_jabatan})</span>
                      <span>·</span>
                      <span>{formatDateTime(doc.dibuat_pada)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleVerifyDoc(doc.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/60"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Validasi QR Dokumen</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
