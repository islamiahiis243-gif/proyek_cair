import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  CloudCheck,
  CloudOff,
  Database,
  LogIn,
  LogOut,
  Upload,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { testSupabaseConnection } from '../lib/supabase';

export const SettingsView: React.FC = () => {
  const {
    supabaseConfig,
    saveConfig,
    user,
    loginGoogle,
    logout,
    resetToDefaultData,
    importCSVText,
    items,
    stockMutations,
    cashMutations,
  } = useApp();

  const [url, setUrl] = useState(supabaseConfig.url || '');
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey || '');
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [importNotice, setImportNotice] = useState<string | null>(null);

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingStatus('testing');
    setTestMessage(null);

    const res = await testSupabaseConnection(url.trim(), anonKey.trim());
    if (res.success) {
      setTestingStatus('success');
      setTestMessage(res.message);
      saveConfig({
        url: url.trim(),
        anonKey: anonKey.trim(),
        isConnected: true,
        lastSynced: new Date().toISOString(),
      });
    } else {
      setTestingStatus('error');
      setTestMessage(res.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importCSVText(content);
        setImportNotice(
          `Berhasil mengimpor ${result.count} material dari file CSV. (${result.ignoredImk} item bertanda By IMK otomatis diabaikan, stok diatur = 0 & Tidak Tersedia).`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = () => {
    const data = {
      project: 'Proyek Cair',
      timestamp: new Date().toISOString(),
      items,
      stockMutations,
      cashMutations,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `Proyek_Cair_Backup_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Pengaturan & Sinkronisasi
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Kelola koneksi cloud Supabase, akun Google PIC, dan manajemen basis data lokal.
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <Settings className="w-5 h-5" />
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Profil Pengguna & Autentikasi Google</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=ProyekCair'}
              alt={user.name}
              className="w-12 h-12 rounded-full border border-slate-200 bg-white"
            />
            <div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {user.name}
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  Google Auth
                </span>
              </div>
              <div className="text-xs text-slate-500">{user.email}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Peran: {user.role}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loginGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Ganti Akun Google</span>
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Connection Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Koneksi Supabase Cloud Database</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hubungkan project Supabase Anda untuk sinkronisasi data antar perangkat secara mulus dan penyimpanan persisten cloud.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {supabaseConfig.isConnected ? (
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <CloudCheck className="w-3.5 h-3.5" />
                <span>Terhubung</span>
              </span>
            ) : (
              <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Offline / Local Storage</span>
              </span>
            )}
          </div>
        </div>

        {testMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              testingStatus === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {testingStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{testMessage}</span>
          </div>
        )}

        <form onSubmit={handleTestAndSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzproject.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Supabase Anon / Public Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              *Jika dikosongkan, aplikasi tetap berjalan 100% menggunakan browser storage offline-first yang aman.
            </span>
            <button
              type="submit"
              disabled={testingStatus === 'testing'}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {testingStatus === 'testing' ? 'Memeriksa Koneksi...' : 'Simpan & Uji Koneksi'}
            </button>
          </div>
        </form>
      </div>

      {/* CSV Import & Backup Management Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          <span>Manajemen Data Master BOQ & Cadangan</span>
        </h2>

        {importNotice && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>{importNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Re-import CSV */}
          <label className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer flex flex-col justify-between transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">Impor File CSV BOQ</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Upload CSV baru. Baris By IMK diabaikan, stok diatur = 0 otomatis Tidak Tersedia.
              </div>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Backup JSON */}
          <button
            onClick={handleExportBackup}
            className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex flex-col justify-between transition-colors"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <Download className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">Cadangkan Data (JSON)</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Unduh seluruh data stok, mutasi barang, dan mutasi kas untuk arsip cadangan.
              </div>
            </div>
          </button>

          {/* Reset to Initial */}
          <button
            onClick={() => {
              if (confirm('Apakah Anda yakin ingin mengatur ulang data ke data awal bawaan BOQ Trainer & UDU Office?')) {
                resetToDefaultData();
                alert('Data berhasil di-reset ke data awal master BOQ!');
              }
            }}
            className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-left flex flex-col justify-between transition-colors"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900">Reset ke Data Default</div>
              <div className="text-[11px] text-slate-500 mt-1">
                Mengembalikan item master BOQ kontraktor ke kondisi awal sistem.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
