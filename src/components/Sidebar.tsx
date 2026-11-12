import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  WalletCards,
  FileText,
  QrCode,
  Settings,
  HardHat,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, outOfStockCount, lowStockCount } = useApp();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Analitik',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'inventory',
      label: 'Katalog & Stok Barang',
      icon: Boxes,
      badge: outOfStockCount > 0 ? `${outOfStockCount} Kosong` : null,
      badgeType: 'danger',
    },
    {
      id: 'stock-mutations',
      label: 'Mutasi Keluar / Masuk',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'cashflow',
      label: 'Mutasi Kas Keuangan',
      icon: WalletCards,
      badge: null,
    },
    {
      id: 'reports',
      label: 'Laporan & Ekspor PDF',
      icon: FileText,
      badge: 'QR Code',
      badgeType: 'info',
    },
    {
      id: 'verification',
      label: 'Validasi Dokumen Digital',
      icon: QrCode,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Sinkronisasi & Supabase',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-57px)] border-r border-slate-800">
      {/* Project Card Context */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <HardHat className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">Trainer & UDU Office</div>
            <div className="text-[11px] text-slate-400 truncate">Master BOQ Kontraktor</div>
          </div>
        </div>

        {outOfStockCount > 0 && (
          <div className="mt-3 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-md px-2.5 py-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{outOfStockCount} item berstatus Tidak Tersedia (stok = 0)</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    item.badgeType === 'danger'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Versi Sistem</span>
          <span className="font-mono text-slate-400">v2.4-PROD</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-600">
          Sinkronisasi cloud & offline-first
        </div>
      </div>
    </aside>
  );
};
