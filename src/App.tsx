import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { StockMutationView } from './components/StockMutationView';
import { CashflowView } from './components/CashflowView';
import { ReportsView } from './components/ReportsView';
import { VerificationPortal } from './components/VerificationPortal';
import { SettingsView } from './components/SettingsView';
import { ProjectControlView } from './components/ProjectControlView';
import { OperationsHub } from './components/OperationsHub';
import { PrivateDocumentVerify } from './components/PrivateDocumentVerify';
import { ItemBarang, JenisMutasiBarang, JenisMutasiKas } from './types';
import { AuthGate } from './components/AuthGate';
import { WorkspaceCenter } from './components/WorkspaceCenter';
const MainApp:React.FC=()=>{
 const {currentView,stockWriteAccess}=useApp();
 const [isStockModalOpen,setIsStockModalOpen]=useState(false);
 const [preselectedStockItem,setPreselectedStockItem]=useState<ItemBarang|null>(null);
 const [preselectedStockType,setPreselectedStockType]=useState<JenisMutasiBarang>('MASUK');
 const [isCashModalOpen,setIsCashModalOpen]=useState(false);
 const [preselectedCashType,setPreselectedCashType]=useState<JenisMutasiKas>('KELUAR');
 const handleOpenStockModal=(type:JenisMutasiBarang='MASUK',item:ItemBarang|null=null)=>{setPreselectedStockType(type);setPreselectedStockItem(item);setIsStockModalOpen(true);};
 const handleOpenCashModal=(type:JenisMutasiKas='KELUAR')=>{setPreselectedCashType(type);setIsCashModalOpen(true);};
 return <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors"><Header/><div className="flex-1 flex flex-col md:flex-row"><Sidebar/><main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
 {currentView==='workspaces'&&<WorkspaceCenter/>}
 {currentView==='dashboard'&&<DashboardView onOpenStockModal={handleOpenStockModal} onOpenCashModal={handleOpenCashModal}/>}
 {currentView==='operations'&&<OperationsHub/>}{currentView==='project-control'&&<ProjectControlView/>}
 {currentView==='inventory'&&<InventoryView onQuickMutate={(item,type)=>handleOpenStockModal(type,item)} canMutate={stockWriteAccess}/>}
 {currentView==='stock-mutations'&&<StockMutationView isModalOpen={isStockModalOpen} setIsModalOpen={setIsStockModalOpen} preselectedItem={preselectedStockItem} preselectedType={preselectedStockType}/>}
 {currentView==='cashflow'&&<CashflowView isModalOpen={isCashModalOpen} setIsModalOpen={setIsCashModalOpen} defaultType={preselectedCashType}/>}
 {currentView==='reports'&&<ReportsView/>}{currentView==='verification'&&<VerificationPortal/>}{currentView==='settings'&&<SettingsView/>}
 </main></div>
 {currentView!=='stock-mutations'&&<StockMutationView isModalOpen={isStockModalOpen} setIsModalOpen={setIsStockModalOpen} preselectedItem={preselectedStockItem} preselectedType={preselectedStockType} modalOnly/>}
 {currentView!=='cashflow'&&<CashflowView isModalOpen={isCashModalOpen} setIsModalOpen={setIsCashModalOpen} defaultType={preselectedCashType} modalOnly/>}</div>;
};
export default function App(){if(window.location.pathname==='/verify')return <AuthGate><PrivateDocumentVerify/></AuthGate>;return <AuthGate><AppProvider><MainApp/></AppProvider></AuthGate>;}
