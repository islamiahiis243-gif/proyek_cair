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
import { ItemBarang, JenisMutasiBarang, JenisMutasiKas } from './types';
import { AuthGate } from './components/AuthGate';

const MainApp: React.FC = () => {
  const { currentView, setCurrentView } = useApp();

  // Stock mutation modal state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [preselectedStockItem, setPreselectedStockItem] = useState<ItemBarang | null>(null);
  const [preselectedStockType, setPreselectedStockType] = useState<JenisMutasiBarang>('MASUK');

  // Cashflow mutation modal state
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [preselectedCashType, setPreselectedCashType] = useState<JenisMutasiKas>('KELUAR');

  const handleOpenStockModal = (type: JenisMutasiBarang = 'MASUK', item: ItemBarang | null = null) => {
    setPreselectedStockType(type);
    setPreselectedStockItem(item);
    setIsStockModalOpen(true);
  };

  const handleOpenCashModal = (type: JenisMutasiKas = 'KELUAR') => {
    setPreselectedCashType(type);
    setIsCashModalOpen(true);
  };

  const handleQuickMutateFromInventory = (item: ItemBarang, type: JenisMutasiBarang) => {
    handleOpenStockModal(type, item);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Header />

      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              onOpenStockModal={handleOpenStockModal}
              onOpenCashModal={handleOpenCashModal}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView onQuickMutate={handleQuickMutateFromInventory} />
          )}

          {currentView === 'stock-mutations' && (
            <StockMutationView
              isModalOpen={isStockModalOpen}
              setIsModalOpen={setIsStockModalOpen}
              preselectedItem={preselectedStockItem}
              preselectedType={preselectedStockType}
            />
          )}

          {currentView === 'cashflow' && (
            <CashflowView
              isModalOpen={isCashModalOpen}
              setIsModalOpen={setIsCashModalOpen}
              defaultType={preselectedCashType}
            />
          )}

          {currentView === 'reports' && <ReportsView />}

          {currentView === 'verification' && <VerificationPortal />}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Modals rendered when triggered from views other than dedicated tab */}
      {currentView !== 'stock-mutations' && (
        <StockMutationView
          isModalOpen={isStockModalOpen}
          setIsModalOpen={setIsStockModalOpen}
          preselectedItem={preselectedStockItem}
          preselectedType={preselectedStockType}
          modalOnly={true}
        />
      )}

      {currentView !== 'cashflow' && (
        <CashflowView
          isModalOpen={isCashModalOpen}
          setIsModalOpen={setIsCashModalOpen}
          defaultType={preselectedCashType}
          modalOnly={true}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AuthGate><MainApp /></AuthGate>
    </AppProvider>
  );
}
