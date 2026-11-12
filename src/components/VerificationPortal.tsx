import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  CheckCircle2,
  QrCode,
  FileText,
  Calendar,
  User,
  KeyRound,
  Download,
  Search,
  ArrowLeft,
  Building2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import QRCode from 'qrcode';
import { formatDateTime, formatDateOnly, formatRupiah } from '../lib/pdfGenerator';

export const VerificationPortal: React.FC = () => {
  const { documents, verifyingDocId, setVerifyingDocId, setCurrentView, stockMutations, cashMutations } = useApp();

  const [inputSearchDoc, setInputSearchDoc] = useState('');
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Default to verifyingDocId or the first available document
  const activeDocId = verifyingDocId || documents[0]?.id || '';
  const currentDoc = documents.find((d) => d.id === activeDocId) || documents[0];

  useEffect(() => {
    if (currentDoc) {
      const url = `${window.location.origin}/?verify_doc=${encodeURIComponent(currentDoc.id)}`;
      QRCode.toDataURL(url, {
        margin: 1,
        width: 200,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then(setActiveQrDataUrl);
    }
  }, [currentDoc]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSearchDoc.trim()) return;
    const found = documents.find(
      (d) => d.id.toLowerCase() === inputSearchDoc.trim().toLowerCase()
    );
    if (found) {
      setVerifyingDocId(found.id);
    } else {
      alert(`Dokumen dengan nomor registrasi "${inputSearchDoc}" tidak ditemukan.`);
    }
  };

  const handleCopyVerificationLink = () => {
    const url = `${window.location.origin}/?verify_doc=${encodeURIComponent(activeDocId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('reports')}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Portal Validasi Dokumen Digital
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Pemeriksaan keaslian Berita Acara Mutasi Barang dan Buku Kas resmi Proyek Cair.
            </p>
          </div>
        </div>

        {/* Search document box */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari No. Registrasi Dokumen..."
              value={inputSearchDoc}
              onChange={(e) => setInputSearchDoc(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
          >
            Periksa
          </button>
        </form>
      </div>

      {!currentDoc ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-xs text-slate-400">
          Belum ada arsip dokumen yang diterbitkan untuk divalidasi. Silakan buat dokumen baru di menu Laporan.
        </div>
      ) : (
        /* Certificate Box */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
          {/* Certificate Header Banner */}
          <div className="bg-slate-900 text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>DOKUMEN TERVERIFIKASI RESMI</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Sertifikat Keabsahan Dokumen Digital
              </h2>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                <span>Proyek: Trainer & UDU Office (Master BOQ Kontraktor)</span>
              </div>
            </div>

            {/* QR Code Preview Box */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-inner flex flex-col items-center justify-center shrink-0 w-32">
              {activeQrDataUrl && (
                <img
                  src={activeQrDataUrl}
                  alt="QR Code Verifikasi"
                  className="w-24 h-24 object-contain"
                />
              )}
              <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                Scan Keaslian
              </span>
            </div>
          </div>

          {/* Certificate Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <div className="text-slate-400 text-[11px] font-medium">Nomor Registrasi Dokumen</div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {currentDoc.id}
                </div>
              </div>

              <div>
                <div className="text-slate-400 text-[11px] font-medium">Judul Berita Acara</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {currentDoc.judul}
                </div>
              </div>

              <div>
                <div className="text-slate-400 text-[11px] font-medium">Periode Transaksi</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                  {formatDateOnly(currentDoc.periode_awal)} s/d {formatDateOnly(currentDoc.periode_akhir)}
                </div>
              </div>

              <div>
                <div className="text-slate-400 text-[11px] font-medium">Tanggal & Waktu Penerbitan</div>
                <div className="text-xs font-semibold text-slate-800 mt-0.5 font-mono">
                  {formatDateTime(currentDoc.dibuat_pada)}
                </div>
              </div>
            </div>

            {/* Signer Info */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <span>Otoritas Penandatangan Digital</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Nama Lengkap</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentDoc.penandatangan_nama}</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Jabatan Struktural</div>
                  <div className="font-semibold text-slate-800 mt-0.5">{currentDoc.penandatangan_jabatan}</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Identitas Akun Google PIC</div>
                  <div className="font-mono text-slate-800 mt-0.5">{currentDoc.penandatangan_email}</div>
                </div>
              </div>
            </div>

            {/* Security Checksum */}
            <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hash Integritas Kriptografis (SHA-256)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">VALID & MATCHED</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {currentDoc.hash_keamanan}
              </div>
              <div className="text-[10px] text-slate-400">
                Hash di atas mengunci struktur data transaksi mutasi dan menjamin lembar PDF tidak mengalami pemalsuan atau perubahan setelah ditandatangani.
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={handleCopyVerificationLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>{copiedLink ? 'Tautan Disalin!' : 'Salin Tautan Validasi'}</span>
              </button>

              <button
                onClick={() => setCurrentView('reports')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Cetak / Ekspor Ulang Dokumen PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
