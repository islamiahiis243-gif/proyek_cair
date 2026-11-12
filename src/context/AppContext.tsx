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
  getSupabaseClient,
  signOutSupabase,
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
  addStockMutation: (mutation: Omit<MutasiBarang, 'id' | 'stok_sebelum' | 'stok_sesudah'>) => Promise<{ success: boolean; message: string }>;
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
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_ITEMS = 'proyek_cair_items';
const STORAGE_KEY_STOCK_MUT = 'proyek_cair_stock_mutations';
const STORAGE_KEY_CASH_MUT = 'proyek_cair_cash_mutations';
const STORAGE_KEY_DOCS = 'proyek_cair_documents';
const STORAGE_KEY_THEME = 'proyek_cair_theme';

export function computeItemStatus(stok: number, minStok: number): AvailabilityStatus {
  if (stok <= 0) return 'Tidak Tersedia';
  if (stok <= minStok) return 'Stok Menipis';
  return 'Tersedia';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state with localStorage fallbacks
  const [items, setItems] = useState<ItemBarang[]>([]);
  const [stockMutations, setStockMutations] = useState<MutasiBarang[]>([]);
  const [cashMutations, setCashMutations] = useState<MutasiKas[]>([]);
  const [documents, setDocuments] = useState<DokumenLaporan[]>([]);

  const [user, setUser] = useState<UserProfile>(() => getStoredUser());
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(() => getStoredConfig());
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  // Theme state: dark / light
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {}
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Check URL query on load for document verification deep links (from QR code scans)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyDoc = params.get('verify_doc');
    if (verifyDoc) {
      setVerifyingDocId(verifyDoc);
      setCurrentView('verification');
    }
  }, []);

  // Supabase is the operational source of truth. BOQ quantities are references; stock is ledger-derived.
  useEffect(() => {
    if (!user.id) return;
    let active = true;
    const load = async () => {
      try {
        const client = getSupabaseClient();
        const [{ data: boq, error: boqError }, { data: tx, error: txError }] = await Promise.all([
          client.from('boq_items').select('*').eq('is_active', true).order('source_row'),
          client.from('inventory_transactions').select('*').order('occurred_at', { ascending: false })
        ]);
        if (boqError) throw boqError;
        if (txError) throw txError;
        if (!active) return;
        const balances = new Map<string, number>();
        const mutations: MutasiBarang[] = (tx || []).map((t: any) => {
          const delta = ['MASUK','PENYESUAIAN_MASUK'].includes(t.transaction_type) ? Number(t.quantity) : -Number(t.quantity);
          balances.set(t.item_id, (balances.get(t.item_id) || 0) + delta);
          return { id:t.id, barang_id:t.item_id, nama_barang:'', jenis:t.transaction_type.includes('MASUK')?'MASUK':'KELUAR', jumlah:Number(t.quantity), satuan:t.uom, tujuan_keperluan:t.location || t.notes || '-', pic_penerima_penyerah:t.counterparty || '-', nomor_surat_jalan:t.reference_no || undefined, tanggal:t.occurred_at, stok_sebelum:0, stok_sesudah:0, catatan:t.notes || undefined };
        });
        const mapped: ItemBarang[] = (boq || []).map((b: any) => ({ id:b.id, kode_boq:b.boq_code, source_sheet:b.source_sheet, source_row:b.source_row, nama_barang:b.description, kategori:b.category || 'BOQ', satuan:b.uom, harga_satuan:Number(b.unit_rate || 0), stok_saat_ini:balances.get(b.id) || 0, stok_minimum:0, status:computeItemStatus(balances.get(b.id)||0,0), keterangan:b.remarks || '' }));
        const names = new Map(mapped.map(x=>[x.id,x.nama_barang]));
        mutations.forEach(m=>{m.nama_barang=names.get(m.barang_id)||'Item BOQ';});
        setItems(mapped);
        setStockMutations(mutations);
      } catch (error) { console.error('Gagal memuat data UDU dari Supabase:', error); }
    };
    void load();
    return () => { active = false; };
  }, [user.id]);



  // Calculated Stats
  const totalStockAssetValue = items.reduce((acc, it) => acc + it.stok_saat_ini * it.harga_satuan, 0);

  const currentCashBalance = cashMutations.length > 0
    ? cashMutations[cashMutations.length - 1].saldo_setelah
    : 0;

  const outOfStockCount = items.filter((it) => it.stok_saat_ini <= 0).length;
  const lowStockCount = items.filter((it) => it.stok_saat_ini > 0 && it.stok_saat_ini <= it.stok_minimum).length;
  const availableStockCount = items.filter((it) => it.stok_saat_ini > it.stok_minimum).length;

  // Add Stock Mutation
  const addStockMutation = async (
    data: Omit<MutasiBarang, 'id' | 'stok_sebelum' | 'stok_sesudah'>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.rpc('record_inventory_mutation', {
        p_idempotency_key: crypto.randomUUID(),
        p_item_id: data.barang_id,
        p_type: data.jenis,
        p_quantity: data.jumlah,
        p_occurred_at: data.tanggal || new Date().toISOString(),
        p_reference_no: data.nomor_surat_jalan || null,
        p_counterparty: data.pic_penerima_penyerah || null,
        p_location: data.tujuan_keperluan || null,
        p_notes: data.catatan || null
      });
      if (error) throw error;
      const [{data:boq,error:boqError},{data:tx,error:txError}] = await Promise.all([
        client.from('boq_items').select('*').eq('is_active',true).order('source_row'),
        client.from('inventory_transactions').select('*').order('occurred_at',{ascending:false})
      ]);
      if (boqError) throw boqError;
      if (txError) throw txError;
      const balances = new Map<string,number>();
      (tx||[]).forEach((t:any)=>balances.set(t.item_id,(balances.get(t.item_id)||0)+(['MASUK','PENYESUAIAN_MASUK'].includes(t.transaction_type)?Number(t.quantity):-Number(t.quantity))));
      setItems((boq||[]).map((x:any)=>({id:x.id,kode_boq:x.boq_code,source_sheet:x.source_sheet,source_row:x.source_row,nama_barang:x.description,kategori:x.category||'BOQ',satuan:x.uom,harga_satuan:Number(x.unit_rate||0),stok_saat_ini:balances.get(x.id)||0,stok_minimum:0,status:computeItemStatus(balances.get(x.id)||0,0),keterangan:x.remarks||''})));
      setStockMutations((tx||[]).map((t:any)=>({id:t.id,barang_id:t.item_id,nama_barang:(boq||[]).find((x:any)=>x.id===t.item_id)?.description||'Item BOQ',jenis:t.transaction_type.includes('MASUK')?'MASUK':'KELUAR',jumlah:Number(t.quantity),satuan:t.uom,tujuan_keperluan:t.location||t.notes||'-',pic_penerima_penyerah:t.counterparty||'-',nomor_surat_jalan:t.reference_no||undefined,tanggal:t.occurred_at,stok_sebelum:0,stok_sesudah:0,catatan:t.notes||undefined})));
      return { success:true, message:'Mutasi berhasil disimpan di database UDU.' };
    } catch (error:any) {
      return { success:false, message:error.message || 'Gagal menyimpan mutasi ke Supabase.' };
    }
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
  const loginGoogle = async () => { await initiateGoogleSignIn(); };

  // Logout
  const logout = async () => {
    try { await signOutSupabase(); } finally { setUser({ ...DEFAULT_USER, id: '', email: '' }); }
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
        theme,
        toggleTheme,
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
