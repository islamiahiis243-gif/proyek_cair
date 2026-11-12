import React, { createContext, useContext, useEffect, useState } from 'react';
import { ItemBarang, MutasiBarang, MutasiKas, DokumenLaporan, UserProfile, SupabaseConfig, AvailabilityStatus } from '../types';
import { getStoredConfig, getStoredUser, saveStoredUser, initiateGoogleSignIn, DEFAULT_USER, getSupabaseClient, signOutSupabase } from '../lib/supabase';

interface AppContextType {
  items: ItemBarang[];
  stockMutations: MutasiBarang[];
  cashMutations: MutasiKas[];
  documents: DokumenLaporan[];
  user: UserProfile;
  supabaseConfig: SupabaseConfig;
  currentView: string;
  setCurrentView: (view:string)=>void;
  verifyingDocId: string | null;
  setVerifyingDocId: (id:string|null)=>void;
  addStockMutation: (mutation:Omit<MutasiBarang,'id'|'stok_sebelum'|'stok_sesudah'>)=>Promise<{success:boolean;message:string}>;
  addCashMutation: (cash:Omit<MutasiKas,'id'|'saldo_setelah'>)=>Promise<{success:boolean;message:string}>;
  addDocument: (doc:DokumenLaporan)=>Promise<void>;
  logout: ()=>Promise<void>;
  totalStockAssetValue:number;
  currentCashBalance:number;
  outOfStockCount:number;
  lowStockCount:number;
  availableStockCount:number;
  theme:'light'|'dark';
  toggleTheme:()=>void;
  dataReady:boolean;
  dataError:string|null;
  cashAccess:boolean;
  cashWriteAccess:boolean;
  cashHasEntries:boolean;
  recordedStockCount:number;
  unrecordedStockCount:number;
  stockWriteAccess:boolean;
}
const AppContext=createContext<AppContextType|undefined>(undefined);
const THEME_KEY='proyek_cair_theme';
export function computeItemStatus(stok:number,minStok:number,hasHistory=true):AvailabilityStatus {
  if(!hasHistory)return 'Belum Dicatat';
  if(stok<=0)return 'Tidak Tersedia';
  if(stok<=minStok)return 'Stok Menipis';
  return 'Tersedia';
}
export const AppProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [items,setItems]=useState<ItemBarang[]>([]);
 const [stockMutations,setStockMutations]=useState<MutasiBarang[]>([]);
 const [cashMutations,setCashMutations]=useState<MutasiKas[]>([]);
 const [documents,setDocuments]=useState<DokumenLaporan[]>([]);
 const [user,setUser]=useState<UserProfile>(()=>getStoredUser());
 const [supabaseConfig]=useState<SupabaseConfig>(()=>getStoredConfig());
 const [currentView,setCurrentView]=useState('dashboard');
 const [verifyingDocId,setVerifyingDocId]=useState<string|null>(null);
 const [dataReady,setDataReady]=useState(false);
 const [dataError,setDataError]=useState<string|null>(null);
 const [cashAccess,setCashAccess]=useState(false);
 const cashWriteAccess=['admin','site_manager','finance'].includes(user.databaseRole||'');
 const stockWriteAccess=['admin','site_manager','storekeeper'].includes(user.databaseRole||'');
 const [theme,setTheme]=useState<'light'|'dark'>(()=>{try{const v=localStorage.getItem(THEME_KEY);if(v==='dark'||v==='light')return v;}catch{}return 'dark';});
 useEffect(()=>{document.documentElement.classList.toggle('dark',theme==='dark');localStorage.setItem(THEME_KEY,theme);},[theme]);
 const toggleTheme=()=>setTheme(v=>v==='light'?'dark':'light');
 useEffect(()=>{const p=new URLSearchParams(window.location.search);const id=p.get('verify_doc');if(id){setVerifyingDocId(id);setCurrentView('verification');}},[]);
 const refreshData=async()=>{
  const client=getSupabaseClient();
  const canReadCash=['admin','site_manager','finance','auditor'].includes(user.databaseRole||'');
  const [boqRes,stockRes,cashRes,docsRes]=await Promise.all([
   client.from('boq_items').select('*').eq('is_active',true).order('source_row'),
   client.from('inventory_transactions').select('*').order('occurred_at',{ascending:true}).order('created_at',{ascending:true}),
   canReadCash?client.from('cash_transactions').select('*').order('occurred_at',{ascending:true}).order('created_at',{ascending:true}):Promise.resolve({data:[],error:null}),
   client.from('documents').select('*').order('created_at',{ascending:false})
  ]);
  if(boqRes.error)throw boqRes.error;
  if(stockRes.error)throw stockRes.error;
  if(cashRes.error)throw cashRes.error;
  if(docsRes.error)throw docsRes.error;
  const balance=new Map<string,number>();
  const received=new Map<string,number>();
  const consumed=new Map<string,number>();
  const stockHistory=new Set<string>((stockRes.data||[]).map((t:any)=>t.item_id));
  const stockRows:MutasiBarang[]=(stockRes.data||[]).map((t:any)=>{
   const before=balance.get(t.item_id)||0;
   const incoming=['MASUK','PENYESUAIAN_MASUK'].includes(t.transaction_type);
   const delta=incoming?Number(t.quantity):-Number(t.quantity);
   const after=before+delta;balance.set(t.item_id,after);
   if(t.transaction_type==='MASUK')received.set(t.item_id,(received.get(t.item_id)||0)+Number(t.quantity));
   if(t.transaction_type==='KELUAR')consumed.set(t.item_id,(consumed.get(t.item_id)||0)+Number(t.quantity));
   return {id:t.id,barang_id:t.item_id,nama_barang:'',jenis:incoming?'MASUK':'KELUAR',jumlah:Number(t.quantity),satuan:t.uom,tujuan_keperluan:t.location||t.notes||'-',pic_penerima_penyerah:t.counterparty||'-',nomor_surat_jalan:t.reference_no||undefined,tanggal:t.occurred_at,stok_sebelum:before,stok_sesudah:after,catatan:t.notes||undefined};
  });
  const mappedItems:ItemBarang[]=(boqRes.data||[]).map((b:any)=>{const target=Number(b.quantity)||0;const masuk=received.get(b.id)||0;const keluar=consumed.get(b.id)||0;const progress=target>0?(masuk/target)*100:0;const statusPemenuhan:ItemBarang['status_pemenuhan']=masuk>target?'Melebihi BOQ':masuk>=target&&target>0?'Terpenuhi':masuk>0?'Dalam pemenuhan':'Belum dipenuhi';return {id:b.id,kode_boq:b.boq_code,source_sheet:b.source_sheet,source_row:b.source_row,nama_barang:b.description,kategori:b.category||'Tanpa kategori',qty_boq:target,is_stock_item:Boolean(b.is_stock_item),has_stock_history:stockHistory.has(b.id),qty_masuk_total:masuk,qty_keluar_total:keluar,qty_pemenuhan_sisa:Math.max(target-masuk,0),progress_pemenuhan:progress,status_pemenuhan:statusPemenuhan,satuan:b.uom,harga_satuan:Number(b.unit_rate||0),stok_saat_ini:balance.get(b.id)||0,stok_minimum:0,status:computeItemStatus(balance.get(b.id)||0,0,stockHistory.has(b.id)),keterangan:b.remarks||''};});
  const nameById=new Map(mappedItems.map(x=>[x.id,x.nama_barang]));
  stockRows.forEach(x=>{x.nama_barang=nameById.get(x.barang_id)||'Item BOQ';});
  let cashBalance=0;
  const cashRows:MutasiKas[]=(cashRes.data||[]).map((t:any)=>{
   const incoming=t.transaction_type==='MASUK';cashBalance+=incoming?Number(t.amount):-Number(t.amount);
   return {id:t.id,jenis:t.transaction_type,jumlah_rp:Number(t.amount),untuk_apa:t.description,kategori_keperluan:(t.category||'Lainnya') as MutasiKas['kategori_keperluan'],pic:t.pic||'-',nomor_kuitansi:t.reference_no||undefined,tanggal:t.occurred_at,saldo_setelah:cashBalance,catatan:t.notes||undefined};
  });
  const docs:DokumenLaporan[]=(docsRes.data||[]).map((d:any)=>({id:d.document_no,judul:d.title,jenis:d.document_type==='MUTASI_KAS'?'MUTASI_KAS':'MUTASI_STOK',status:d.status||'DRAFT',periode_awal:d.period_start||'',periode_akhir:d.period_end||'',dibuat_pada:d.created_at,penandatangan_nama:d.signer_name||'',penandatangan_jabatan:d.signer_role||'',penandatangan_email:d.signer_email||'',hash_keamanan:d.content_sha256||'',total_transaksi:Number(d.total_transactions||0),ringkasan_nilai_rp:Number(d.amount_summary||0),qr_payload:d.qr_payload||'',snapshot_json:d.snapshot?JSON.stringify(d.snapshot):undefined}));
  setItems(mappedItems);setStockMutations(stockRows.reverse());setCashMutations(cashRows.reverse());setCashAccess(canReadCash);setDocuments(docs);setDataError(null);setDataReady(true);
 };
 useEffect(()=>{if(!user.id)return;let live=true;setDataReady(false);refreshData().catch((e:any)=>{if(live){setDataError(e.message||'Gagal memuat data dari Supabase.');setDataReady(true);}});return()=>{live=false;};},[user.id]);
 const addStockMutation=async(data:Omit<MutasiBarang,'id'|'stok_sebelum'|'stok_sesudah'>)=>{
  try{const {error}=await getSupabaseClient().rpc('record_inventory_mutation',{p_idempotency_key:crypto.randomUUID(),p_item_id:data.barang_id,p_type:data.jenis,p_quantity:data.jumlah,p_occurred_at:data.tanggal||new Date().toISOString(),p_reference_no:data.nomor_surat_jalan||null,p_counterparty:data.pic_penerima_penyerah||null,p_location:data.tujuan_keperluan||null,p_notes:data.catatan||null});if(error)throw error;await refreshData();return {success:true,message:'Mutasi tersimpan di database UDU.'};}catch(e:any){return {success:false,message:e.message||'Gagal menyimpan mutasi.'};}
 };
 const addCashMutation=async(data:Omit<MutasiKas,'id'|'saldo_setelah'>)=>{
  try{const {error}=await getSupabaseClient().rpc('record_cash_mutation',{p_idempotency_key:crypto.randomUUID(),p_type:data.jenis,p_amount:data.jumlah_rp,p_occurred_at:data.tanggal||new Date().toISOString(),p_category:data.kategori_keperluan,p_description:data.untuk_apa,p_reference_no:data.nomor_kuitansi||null,p_pic:data.pic||user.name,p_notes:data.catatan||null});if(error)throw error;await refreshData();return {success:true,message:'Mutasi kas tersimpan di database UDU.'};}catch(e:any){return {success:false,message:e.message||'Gagal menyimpan mutasi kas.'};}
 };
 const addDocument=async(doc:DokumenLaporan)=>{
  const {error}=await getSupabaseClient().from('documents').insert({document_no:doc.id,title:doc.judul,document_type:doc.jenis,status:doc.status||'DRAFT',content_sha256:doc.hash_keamanan,period_start:doc.periode_awal,period_end:doc.periode_akhir,signer_name:doc.penandatangan_nama,signer_role:doc.penandatangan_jabatan,signer_email:doc.penandatangan_email,total_transactions:doc.total_transaksi,amount_summary:doc.ringkasan_nilai_rp,qr_payload:doc.qr_payload,snapshot:doc.snapshot_json?JSON.parse(doc.snapshot_json):null,created_by:user.id});
  if(error)throw error;await refreshData();
 };
 const logout=async()=>{try{await signOutSupabase();}finally{setUser({...DEFAULT_USER,id:'',email:''});}};
 const stockItems=items.filter(x=>x.is_stock_item);
 const totalStockAssetValue=stockItems.reduce((s,x)=>s+x.stok_saat_ini*x.harga_satuan,0);
 const currentCashBalance=cashMutations[0]?.saldo_setelah??0;
 const cashHasEntries=cashMutations.length>0;
 const recordedStockCount=stockItems.filter(x=>x.has_stock_history).length;
 const unrecordedStockCount=stockItems.length-recordedStockCount;
 const outOfStockCount=stockItems.filter(x=>x.has_stock_history&&x.stok_saat_ini<=0).length;
 const lowStockCount=stockItems.filter(x=>x.stok_saat_ini>0&&x.stok_saat_ini<=x.stok_minimum).length;
 const availableStockCount=stockItems.filter(x=>x.has_stock_history&&x.stok_saat_ini>x.stok_minimum).length;
 return <AppContext.Provider value={{items,stockMutations,cashMutations,documents,user,supabaseConfig,currentView,setCurrentView,verifyingDocId,setVerifyingDocId,addStockMutation,addCashMutation,addDocument,logout,totalStockAssetValue,currentCashBalance,outOfStockCount,lowStockCount,availableStockCount,theme,toggleTheme,dataReady,dataError,cashAccess,cashWriteAccess,stockWriteAccess,cashHasEntries,recordedStockCount,unrecordedStockCount}}>{children}</AppContext.Provider>;
};
export const useApp=()=>{const c=useContext(AppContext);if(!c)throw new Error('useApp must be used within AppProvider');return c;};
