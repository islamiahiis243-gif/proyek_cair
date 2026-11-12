import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ItemBarang,
  MutasiBarang,
  MutasiKas,
  DokumenLaporan,
  UserProfile,
  SupabaseConfig,
  AvailabilityStatus,
} from '../types';
import {
  INITIAL_ITEMS,
  INITIAL_STOCK_MUTATIONS,
  INITIAL_CASH_MUTATIONS,
  INITIAL_DOCUMENTS,
} from '../data/seedData';
import {
  getStoredConfig,
  saveStoredConfig,
  getStoredUser,
  saveStoredUser,
  initiateGoogleSignIn,
  DEFAULT_USER,
} from '../lib/supabase';

interface AppContextType {
  items: ItemBarang[];
  stockMutations: MutasiBarang[];
  cashMutations: MutasiKas[];
  documents: DokumenLaporan[];
  user: UserProfile;
  supabaseConfig: SupabaseConfig;
  currentView: string;
  setCurrentView: (view: string) => void;
  verifyingDocId: string | null;
  setVerifyingDocId: (id: string | null) => void;
  // Actions
  addStockMutation: (mutation: Omit<MutasiBarang, 'id' | 'stok_sebelum' | 'stok_sesudah'>) => { success: boolean; message: string };
  addCashMutation: (cash: Omit<MutasiKas, 'id' | 'saldo_setelah'>) => { success: boolean; message: string };
  addItem: (item: Omit<ItemBarang, 'id' | 'status'>) => void;
  updateItem: (id: string, updates: Partial<ItemBarang>) => void;
  deleteItem: (id: string) => void;
  addDocument: (doc: DokumenLaporan) => void;
  importCSVText: (csvText: string) => { count: number; ignoredImk: number };
  resetToDefaultData: () => void;
  loginGoogle: () => Promise<void>;
  logout: () => void;
  saveConfig: (config: SupabaseConfig) => void;
  // Stats
  totalStockAssetValue: number;
  currentCashBalance: number;
  outOfStockCount: number;
  lowStockCount: number;
  availableStockCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_ITEMS = 'proyek_cair_items';
const STORAGE_KEY_STOCK_MUT = 'proyek_cair_stock_mutations';
const STORAGE_KEY_CASH_MUT = 'proyek_cair_cash_mutations';
const STORAGE_KEY_DOCS = 'proyek_cair_documents';

export function computeItemStatus(stok: number, minStok: number): AvailabilityStatus {
  if (stok <= 0) return 'Tidak Tersedia';
  if (stok <= minStok) return 'Stok Menipis';
  return 'Tersedia';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state with localStorage fallbacks
  const [items, setItems] = useState<ItemBarang[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading stored items', e);
    }
    return INITIAL_ITEMS;
  });

  const [stockMutations, setStockMutations] = useState<MutasiBarang[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STOCK_MUT);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading stored stock mutations', e);
    }
    return INITIAL_STOCK_MUTATIONS;
  });

  const [cashMutations, setCashMutations] = useState<MutasiKas[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CASH_MUT);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading stored cash mutations', e);
    }
    return INITIAL_CASH_MUTATIONS;
  });

  const [documents, setDocuments] = useState<DokumenLaporan[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error reading stored documents', e);
    }
    return INITIAL_DOCUMENTS;
  });

  const [user, setUser] = useState<UserProfile>(() => getStoredUser());
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(() => getStoredConfig());
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  // Check URL query on load for document verification deep links (from QR code scans)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyDoc = params.get('verify_doc');
    if (verifyDoc) {
      setVerifyingDocId(verifyDoc);
      setCurrentView('verification');
    }
  }, []);

  // Sync to local storage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STOCK_MUT, JSON.stringify(stockMutations));
  }, [stockMutations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CASH_MUT, JSON.stringify(cashMutations));
  }, [cashMutations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(documents));
  }, [documents]);

  // Calculated Stats
  const totalStockAssetValue = items.reduce((acc, it) => acc + it.stok_saat_ini * it.harga_satuan, 0);

  const currentCashBalance = cashMutations.length > 0
    ? cashMutations[cashMutations.length - 1].saldo_setelah
    : 0;

  const outOfStockCount = items.filter((it) => it.stok_saat_ini <= 0).length;
  const lowStockCount = items.filter((it) => it.stok_saat_ini > 0 && it.stok_saat_ini <= it.stok_minimum).length;
  const availableStockCount = items.filter((it) => it.stok_saat_ini > it.stok_minimum).length;

  // Add Stock Mutation
  const addStockMutation = (
    data: Omit<MutasiBarang, 'id' | 'stok_sebelum' | 'stok_sesudah'>
  ): { success: boolean; message: string } => {
    const itemIndex = items.findIndex((it) => it.id === data.barang_id);
    if (itemIndex === -1) {
      return { success: false, message: 'Item barang tidak ditemukan!' };
    }

    const currentItem = items[itemIndex];
    const stokSebelum = currentItem.stok_saat_ini;

    if (data.jenis === 'KELUAR' && stokSebelum < data.jumlah) {
      return {
        success: false,
        message: `Stok tidak mencukupi! Sisa stok saat ini: ${stokSebelum} ${currentItem.satuan}, diminta: ${data.jumlah} ${currentItem.satuan}`,
      };
    }

    const delta = data.jenis === 'MASUK' ? data.jumlah : -data.jumlah;
    const stokSesudah = Math.max(0, stokSebelum + delta);
    const newStatus = computeItemStatus(stokSesudah, currentItem.stok_minimum);

    // Update item
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...currentItem,
      stok_saat_ini: stokSesudah,
      status: newStatus,
      terakhir_mutasi: data.tanggal || new Date().toISOString(),
    };
    setItems(updatedItems);

    // Create record
    const newMutation: MutasiBarang = {
      id: 'MUT-STK-' + Date.now().toString(36).toUpperCase(),
      barang_id: data.barang_id,
      nama_barang: currentItem.nama_barang,
      jenis: data.jenis,
      jumlah: data.jumlah,
      satuan: currentItem.satuan,
      tujuan_keperluan: data.tujuan_keperluan,
      pic_penerima_penyerah: data.pic_penerima_penyerah,
      nomor_surat_jalan: data.nomor_surat_jalan,
      tanggal: data.tanggal || new Date().toISOString(),
      stok_sebelum: stokSebelum,
      stok_sesudah: stokSesudah,
      catatan: data.catatan,
    };

    setStockMutations((prev) => [newMutation, ...prev]);

    return {
      success: true,
      message: `Mutasi ${data.jenis === 'MASUK' ? 'Masuk' : 'Keluar'} berhasil dicatat. Stok ${currentItem.nama_barang} kini: ${stokSesudah} ${currentItem.satuan} (${newStatus})`,
    };
  };

  // Add Cash Mutation (Kas Terpisah: In / Out / Untuk Apa / Saldo)
  const addCashMutation = (
    data: Omit<MutasiKas, 'id' | 'saldo_setelah'>
  ): { success: boolean; message: string } => {
    if (data.jumlah_rp <= 0) {
      return { success: false, message: 'Nominal mutasi kas harus lebih besar dari 0!' };
    }

    const previousSaldo = cashMutations.length > 0 ? cashMutations[cashMutations.length - 1].saldo_setelah : 0;
    const delta = data.jenis === 'MASUK' ? data.jumlah_rp : -data.jumlah_rp;
    const newSaldo = previousSaldo + delta;

    const newRecord: MutasiKas = {
      id: 'KAS-' + Date.now().toString(36).toUpperCase(),
      jenis: data.jenis,
      jumlah_rp: data.jumlah_rp,
      untuk_apa: data.untuk_apa,
      kategori_keperluan: data.kategori_keperluan,
      pic: data.pic,
      nomor_kuitansi: data.nomor_kuitansi,
      tanggal: data.tanggal || new Date().toISOString(),
      saldo_setelah: newSaldo,
      catatan: data.catatan,
    };

    setCashMutations((prev) => [...prev, newRecord]);

    return {
      success: true,
      message: `Kas ${data.jenis} sebesar Rp ${data.jumlah_rp.toLocaleString('id-ID')} berhasil dicatat. Saldo kas saat ini: Rp ${newSaldo.toLocaleString('id-ID')}`,
    };
  };

  // Add Item
  const addItem = (item: Omit<ItemBarang, 'id' | 'status'>) => {
    const id = 'ITEM-' + (items.length + 1).toString().padStart(3, '0');
    const status = computeItemStatus(item.stok_saat_ini, item.stok_minimum);
    const newItem: ItemBarang = {
      ...item,
      id,
      status,
    };
    setItems((prev) => [newItem, ...prev]);
  };

  // Update Item
  const updateItem = (id: string, updates: Partial<ItemBarang>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, ...updates };
          updated.status = computeItemStatus(updated.stok_saat_ini, updated.stok_minimum);
          return updated;
        }
        return it;
      })
    );
  };

  // Delete Item
  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Add Document
  const addDocument = (doc: DokumenLaporan) => {
    setDocuments((prev) => [doc, ...prev]);
  };

  // Import CSV text
  const importCSVText = (csvText: string): { count: number; ignoredImk: number } => {
    const lines = csvText.split('\n');
    let imported = 0;
    let ignored = 0;
    const newItems: ItemBarang[] = [];

    for (let i = 1; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      if (/by imk/i.test(line)) {
        ignored++;
        continue; // abaikan By IMK
      }
      line = line.replace(/;+$/, '');
      const parts = line.split(',');
      if (parts.length >= 4) {
        const desc = parts[3].replace(/"/g, '').trim();
        if (!desc) continue;
        const uom = parts[5]?.trim() || 'ea';
        const rate = parseFloat(parts[6]?.replace(/[^0-9.]/g, '') || '0') || 0;
        newItems.push({
          id: 'ITEM-CSV-' + (items.length + imported + 1),
          kode_boq: parts[2] || String(imported + 1),
          nama_barang: desc,
          kategori: 'Material Impor CSV',
          satuan: uom,
          harga_satuan: rate,
          stok_saat_ini: 0,
          stok_minimum: 5,
          status: 'Tidak Tersedia', // otomatis tidak tersedia
          keterangan: 'Diimpor dari CSV',
        });
        imported++;
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }

    return { count: imported, ignoredImk: ignored };
  };

  // Reset to initial
  const resetToDefaultData = () => {
    setItems(INITIAL_ITEMS);
    setStockMutations(INITIAL_STOCK_MUTATIONS);
    setCashMutations(INITIAL_CASH_MUTATIONS);
    setDocuments(INITIAL_DOCUMENTS);
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_STOCK_MUT);
    localStorage.removeItem(STORAGE_KEY_CASH_MUT);
    localStorage.removeItem(STORAGE_KEY_DOCS);
  };

  // Google Login
  const loginGoogle = async () => {
    const loggedInUser = await initiateGoogleSignIn();
    setUser(loggedInUser);
  };

  // Logout
  const logout = () => {
    setUser(DEFAULT_USER);
    saveStoredUser(DEFAULT_USER);
  };

  // Save Supabase Config
  const saveConfig = (config: SupabaseConfig) => {
    setSupabaseConfigState(config);
    saveStoredConfig(config);
  };

  return (
    <AppContext.Provider
      value={{
        items,
        stockMutations,
        cashMutations,
        documents,
        user,
        supabaseConfig,
        currentView,
        setCurrentView,
        verifyingDocId,
        setVerifyingDocId,
        addStockMutation,
        addCashMutation,
        addItem,
        updateItem,
        deleteItem,
        addDocument,
        importCSVText,
        resetToDefaultData,
        loginGoogle,
        logout,
        saveConfig,
        totalStockAssetValue,
        currentCashBalance,
        outOfStockCount,
        lowStockCount,
        availableStockCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
