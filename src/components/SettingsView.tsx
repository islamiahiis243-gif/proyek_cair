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
  Sun,
  Moon,
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
    theme,
    toggleTheme,
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
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between transition-colors">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Pengaturan & Sinkronisasi
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Kelola koneksi cloud Supabase, akun Google PIC, tema tampilan, dan manajemen basis data lokal.
          </p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
          <Settings className="w-5 h-5" />
        </div>
      </div>

      {/* Theme Appearance Mode Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>Mode Tampilan (Gelap / Terang)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sesuaikan kontras dan kenyamanan mata saat bekerja di lapangan siang hari maupun malam hari.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {theme === 'dark' ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (theme !== 'light') toggleTheme();
            }}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              theme === 'light' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Mode Terang (Light)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Kontras bersih untuk pemantauan siang hari</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (theme !== 'dark') toggleTheme();
            }}
            className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-950/40 ring-2 ring-blue-500/30 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              theme === 'dark' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Mode Gelap (Dark)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Kenyamanan visual minim silau di malam hari</div>
            </div>
          </button>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Profil Pengguna & Autentikasi Google</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=ProyekCair'}
              alt={user.name}
              className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {user.name}
                <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  Google Auth
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Peran: {user.role}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loginGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/60"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Ganti Akun Google</span>
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors border border-rose-200 dark:border-rose-800/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Supabase Connection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Koneksi Supabase Cloud Database</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hubungkan project Supabase Anda untuk sinkronisasi data antar perangkat secara mulus dan penyimpanan persisten cloud.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {supabaseConfig.isConnected ? (
              <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                <CloudCheck className="w-3.5 h-3.5" />
                <span>Terhubung</span>
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1">
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
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {testingStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{testMessage}</span>
          </div>
        )}

        <form onSubmit={handleTestAndSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzproject.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Supabase Anon / Public Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              *Jika dikosongkan, aplikasi tetap berjalan 100% menggunakan browser storage offline-first yang aman.
            </span>
            <button
              type="submit"
              disabled={testingStatus === 'testing'}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {testingStatus === 'testing' ? 'Memeriksa Koneksi...' : 'Simpan & Uji Koneksi'}
            </button>
          </div>
        </form>
      </div>

      {/* CSV Import & Backup Management Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Manajemen Data Master BOQ & Cadangan</span>
        </h2>

        {importNotice && (
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>{importNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Re-import CSV */}
          <label className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex flex-col justify-between transition-colors">
            <div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Impor File CSV BOQ</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
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
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left flex flex-col justify-between transition-colors"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <Download className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Cadangkan Data (JSON)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
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
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left flex flex-col justify-between transition-colors"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Reset ke Data Default</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Mengembalikan item master BOQ kontraktor ke kondisi awal sistem.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

