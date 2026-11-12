import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, CloudCheck, CloudOff, LogOut, Plus, ShieldCheck, Sun, Moon } from 'lucide-react';
import { formatRupiah } from '../lib/pdfGenerator';

export const Header: React.FC = () => {
  const { user, supabaseConfig, logout, currentCashBalance, cashAccess, stockWriteAccess, setCurrentView, theme, toggleTheme } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => setCurrentView('dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
          aria-label="Proyek Cair - Dashboard"
        >
          <img
            src="/android-chrome-512x512.png"
            alt="Logo Proyek Cair"
            className="w-10 h-10 rounded-lg object-contain bg-white border border-slate-200"
          />
          <div>
            <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
              Proyek Cair
            </div>
            <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Trainer & UDU Office
            </div>
          </div>
        </button>
      </div>

      <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Gudang & Logistik Kontraktor</span>
        </div>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 dark:text-slate-500">Saldo Kas:</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {cashAccess ? formatRupiah(currentCashBalance) : 'Akses terbatas'}
          </span>
        </div>
        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
        <div className="flex items-center gap-1.5">
          {supabaseConfig.isConnected ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CloudCheck className="w-3.5 h-3.5" />
              <span>Database Supabase</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <CloudOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Database belum terhubung</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          aria-label={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-90 duration-200" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 animate-in spin-in-90 duration-200" />
          )}
        </button>

        {stockWriteAccess && (
          <button
            onClick={() => setCurrentView('stock-mutations')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Mutasi</span>
          </button>
        )}

        {user.id ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=UDU'}
                alt={user.name}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight flex items-center gap-1">
                  {user.name}
                  <ShieldCheck className="w-3 h-3 text-blue-600 inline" />
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">{user.role}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar akun"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
