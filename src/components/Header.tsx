import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, CloudCheck, CloudOff, LogIn, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { formatRupiah } from '../lib/pdfGenerator';

export const Header: React.FC = () => {
  const { user, supabaseConfig, loginGoogle, logout, currentCashBalance, setCurrentView } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
      {/* Zone 1: Brand title wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-700 transition-colors">
            PC
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              Proyek Cair
            </div>
            <div className="text-[11px] font-medium text-slate-400">
              Trainer & UDU Office
            </div>
          </div>
        </button>
      </div>

      {/* Zone 2: Navigation contextual status / breadcrumb */}
      <div className="hidden md:flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700">Gudang & Logistik Kontraktor</span>
        </div>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Saldo Kas:</span>
          <span className="font-semibold text-emerald-700 tabular-nums">
            {formatRupiah(currentCashBalance)}
          </span>
        </div>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <div className="flex items-center gap-1.5">
          {supabaseConfig.isConnected ? (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <CloudCheck className="w-3.5 h-3.5" />
              <span>Cloud Sync Aktif</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500">
              <CloudOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Penyimpanan Lokal Aktif</span>
            </span>
          )}
        </div>
      </div>

      {/* Zone 3: 1 Primary user / auth action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setCurrentView('stock-mutations')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Catat Mutasi</span>
        </button>

        {user.provider === 'google' ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=ProyekCair'}
                alt={user.name}
                className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight flex items-center gap-1">
                  {user.name}
                  <ShieldCheck className="w-3 h-3 text-blue-600 inline" />
                </div>
                <div className="text-[10px] text-slate-400 leading-none">{user.role}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar akun"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={loginGoogle}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600" />
            <span>Sign In Google</span>
          </button>
        )}
      </div>
    </header>
  );
};
