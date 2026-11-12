import React from 'react';
import {useApp} from '../context/AppContext';
import {LayoutDashboard,Boxes,ArrowLeftRight,WalletCards,FileText,QrCode,Settings,HardHat,AlertCircle,CalendarClock,ClipboardList} from 'lucide-react';
export const Sidebar:React.FC=()=>{const{currentView,setCurrentView,outOfStockCount}=useApp();const navItems=[
{id:'dashboard',label:'Dashboard Analitik',icon:LayoutDashboard},
{id:'operations',label:'Operasi Terintegrasi',icon:ClipboardList},
{id:'project-control',label:'Jadwal, Tambahan & Audit',icon:CalendarClock},
{id:'inventory',label:'Katalog & Stok Barang',icon:Boxes,badge:outOfStockCount>0?`${outOfStockCount} Kosong`:null},
{id:'stock-mutations',label:'Mutasi Keluar / Masuk',icon:ArrowLeftRight},
{id:'cashflow',label:'Mutasi Kas Keuangan',icon:WalletCards},
{id:'reports',label:'Laporan & Ekspor PDF',icon:FileText,badge:'Checksum'},
{id:'verification',label:'Pemeriksaan Checksum Laporan',icon:QrCode},
{id:'settings',label:'Sinkronisasi & Supabase',icon:Settings}];
return <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-57px)] border-r border-slate-800"><div className="p-4 border-b border-slate-800"><div className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-lg border border-slate-700/60"><div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0"><HardHat className="w-4 h-4"/></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white truncate">Trainer & UDU Office</div><div className="text-[11px] text-slate-400 truncate">PT IMK · CV Menara Megah</div></div></div>{outOfStockCount>0&&<div className="mt-3 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/50 rounded-md px-2.5 py-1.5 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/>{outOfStockCount} item belum tersedia</div>}</div><nav className="flex-1 p-3 space-y-1">{navItems.map(item=>{const Icon=item.icon;const active=currentView===item.id;return <button key={item.id} onClick={()=>setCurrentView(item.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${active?'bg-blue-600 text-white':'text-slate-300 hover:text-white hover:bg-slate-800/70'}`}><span className="flex items-center gap-3 min-w-0"><Icon className="w-4 h-4 shrink-0"/><span className="truncate">{item.label}</span></span>{item.badge&&<span className="text-[10px]">{item.badge}</span>}</button>})}</nav><div className="p-4 border-t border-slate-800 text-[11px] text-slate-500"><div className="flex justify-between"><span>Sumber data</span><span className="font-mono text-slate-400">Supabase</span></div><div className="mt-1 text-[10px]">Data operasional tersimpan di database</div></div></aside>};
