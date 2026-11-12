import React,{useEffect,useMemo,useState} from 'react';
import {CalendarClock,ClipboardList,History,Plus,Save,RefreshCw,AlertTriangle} from 'lucide-react';
import {getSupabaseClient} from '../lib/supabase';
import {useApp} from '../context/AppContext';

type ProjectRow={id:string;project_name:string;contract_start_date:string|null;contract_end_date:string|null;actual_start_date:string|null;actual_end_date:string|null;status:string};
type ScheduleRow={item_id:string;need_start_date:string|null;target_receipt_date:string|null;target_use_start_date:string|null;target_use_end_date:string|null;actual_last_receipt_at:string|null;actual_last_use_at:string|null;notes:string|null};
type AdditionRow={id:string;addition_code:string;item_id:string|null;description:string;quantity:number;uom:string;unit_rate:number;requester_type:string;chargeable_to_client:boolean;reason:string;requested_by_name:string;approval_status:string;billing_status:string;approval_reference:string|null;notes:string|null;created_at:string};
const input="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const label="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300";
export const ProjectControlView:React.FC=()=>{
 const {items,user}=useApp(); const db=getSupabaseClient();
 const [tab,setTab]=useState<'jadwal'|'tambahan'|'audit'>('jadwal');
 const [project,setProject]=useState<ProjectRow|null>(null);
 const [schedules,setSchedules]=useState<ScheduleRow[]>([]);
 const [additions,setAdditions]=useState<AdditionRow[]>([]);
 const [audit,setAudit]=useState<any[]>([]);
 const [selected,setSelected]=useState('');
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
 const [form,setForm]=useState({need_start_date:'',target_receipt_date:'',target_use_start_date:'',target_use_end_date:'',notes:'',is_stock_item:true,owner_type:'KONTRAKTOR'});
 const [addition,setAddition]=useState({item_id:'',description:'',quantity:'',uom:'',unit_rate:'',requester_type:'CLIENT',reason:'',requested_by_name:user.name,approval_reference:'',notes:'',is_stock_item:true,owner_type:'KONTRAKTOR'});
 const canManage=['admin','site_manager'].includes(user.databaseRole||'');
 const load=async()=>{
  setError(''); const [p,s,a]=await Promise.all([
   db.from('project_control').select('*').limit(1).maybeSingle(),
   db.from('item_schedules').select('*'),
   db.from('boq_additions').select('*').order('created_at',{ascending:false})
  ]);
  if(p.error)throw p.error;if(s.error)throw s.error;if(a.error)throw a.error;
  setProject(p.data);setSchedules(s.data||[]);setAdditions(a.data||[]);
  if(['admin','auditor'].includes(user.databaseRole||'')){const l=await db.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(200);if(!l.error)setAudit(l.data||[]);else setAudit([]);}
 };
 useEffect(()=>{load().catch(e=>setError(e.message||'Gagal memuat data kontrol proyek.'));},[]);
 const selectedItem=items.find(x=>x.id===selected);
 useEffect(()=>{const row=schedules.find(x=>x.item_id===selected);setForm({need_start_date:row?.need_start_date||'',target_receipt_date:row?.target_receipt_date||'',target_use_start_date:row?.target_use_start_date||'',target_use_end_date:row?.target_use_end_date||'',notes:row?.notes||''});},[selected,schedules]);
 const dateFmt=(v:string|null)=>v?new Date(v).toLocaleDateString('id-ID'):'—';
 const saveProject=async(e:React.FormEvent)=>{
  e.preventDefault();if(!project)return;setBusy(true);setError('');setNotice('');
  const {error}=await db.from('project_control').update({project_name:project.project_name,contract_start_date:project.contract_start_date||null,contract_end_date:project.contract_end_date||null,actual_start_date:project.actual_start_date||null,actual_end_date:project.actual_end_date||null,status:project.status,updated_by:user.id}).eq('id',project.id);
  setBusy(false);if(error){setError(error.message);return;}setNotice('Data proyek disimpan. Riwayat perubahan otomatis tercatat.');await load();
 };
 const saveSchedule=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selected){setError('Pilih item BOQ.');return;}setBusy(true);setError('');setNotice('');
  const {error}=await db.from('item_schedules').upsert({item_id:selected,...form,updated_by:user.id},{onConflict:'item_id'});
  setBusy(false);if(error){setError(error.message);return;}setNotice('Jadwal item disimpan dan versi sebelumnya tercatat di audit.');await load();
 };
 const addVariation=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');setNotice('');
  let item=items.find(x=>x.id===addition.item_id);
  const code='ADD-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
  if(!addition.item_id){const {data:newItem,error:itemError}=await db.from('boq_items').insert({boq_code:code,description:addition.description,category:'PEKERJAAN TAMBAH',quantity:0,uom:addition.uom,unit_rate:Number(addition.unit_rate||0),remarks:addition.owner_type==='IMK'?'By IMK':'By kontraktor',source_sheet:'PEKERJAAN TAMBAH',is_active:true,is_stock_item:addition.is_stock_item}).select('*').single();if(itemError){setBusy(false);setError(itemError.message);return;}item=newItem;}
  const {error}=await db.from('boq_additions').insert({addition_code:code,item_id:item?.id||null,description:addition.description||item?.description,quantity:Number(addition.quantity),uom:addition.uom||item?.uom,unit_rate:Number(addition.unit_rate||item?.unit_rate||0),requester_type:addition.requester_type,chargeable_to_client:addition.requester_type==='CLIENT',reason:addition.reason,requested_by_name:addition.requested_by_name,approval_reference:addition.approval_reference||null,notes:addition.notes||null,created_by:user.id,billing_status:addition.requester_type==='CLIENT'?'BELUM_DITAGIHKAN':'TIDAK_DITAGIHKAN'});
  setBusy(false);if(error){setError(error.message);return;}setNotice('Pekerjaan tambah tercatat. Status awal DIAJUKAN; belum menambah target pemenuhan sampai disetujui.');setAddition({item_id:'',description:'',quantity:'',uom:'',unit_rate:'',requester_type:'CLIENT',reason:'',requested_by_name:user.name,approval_reference:'',notes:'',is_stock_item:true,owner_type:'KONTRAKTOR'});await load();
 };
 const changeAddition=async(id:string,patch:Record<string,any>)=>{
  if(!canManage)return;setBusy(true);const {error}=await db.from('boq_additions').update(patch).eq('id',id);setBusy(false);if(error){setError(error.message);return;}setNotice('Pekerjaan tambah diperbarui. Perubahan tercatat di audit.');await load();
 };
 const sortedItems=useMemo(()=>items.filter(x=>x.is_stock_item),[items]);
 return <div className="space-y-5">
  <header className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h1 className="text-xl font-bold text-slate-900 dark:text-white">Kontrol Proyek, Pekerjaan Tambah & Audit</h1><p className="mt-1 text-xs text-slate-500">Jadwal proyek dan material, variasi BOQ, serta jejak perubahan dari database Supabase.</p>
   <div className="mt-4 flex flex-wrap gap-2">{[['jadwal','Jadwal proyek & item'],['tambahan','Pekerjaan tambah'],['audit','Riwayat audit']].map(([id,name])=><button key={id} onClick={()=>setTab(id as any)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab===id?'bg-blue-600 text-white':'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{name}</button>)}</div>
  </header>
  {error&&<div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
  {notice&&<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</div>}
  {tab==='jadwal'&&<div className="space-y-4">
   {project&&<form onSubmit={saveProject} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-4 w-4"/>Durasi proyek</h2><div className="grid gap-3 md:grid-cols-3">
    <label><span className={label}>Nama proyek</span><input className={input} value={project.project_name} onChange={e=>setProject({...project,project_name:e.target.value})}/></label>
    <label><span className={label}>Mulai kontrak</span><input type="date" className={input} value={project.contract_start_date||''} onChange={e=>setProject({...project,contract_start_date:e.target.value})}/></label>
    <label><span className={label}>Selesai kontrak</span><input type="date" className={input} value={project.contract_end_date||''} onChange={e=>setProject({...project,contract_end_date:e.target.value})}/></label>
    <label><span className={label}>Mulai aktual</span><input type="date" className={input} value={project.actual_start_date||''} onChange={e=>setProject({...project,actual_start_date:e.target.value})}/></label>
    <label><span className={label}>Selesai aktual</span><input type="date" className={input} value={project.actual_end_date||''} onChange={e=>setProject({...project,actual_end_date:e.target.value})}/></label>
    <label><span className={label}>Status</span><select className={input} value={project.status} onChange={e=>setProject({...project,status:e.target.value})}>{['PERSIAPAN','BERJALAN','DITUNDA','SELESAI','DIBATALKAN'].map(x=><option key={x}>{x}</option>)}</select></label>
   </div><button disabled={!canManage||busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4"/>Simpan data proyek</button>{!canManage&&<p className="mt-2 text-[11px] text-amber-600">Hanya admin/site manager yang dapat mengubah data proyek.</p>}</form>}
   <form onSubmit={saveSchedule} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 text-sm font-bold">Jadwal kebutuhan setiap item</h2><label className="mb-3 block"><span className={label}>Item BOQ</span><select required className={input} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Pilih item material…</option>{sortedItems.map(x=><option key={x.id} value={x.id}>{x.kode_boq} — {x.nama_barang}</option>)}</select></label>{selectedItem&&<p className="mb-3 text-[11px] text-slate-500">Target BOQ {selectedItem.qty_boq} {selectedItem.satuan}; jadwal aktual penerimaan terakhir: {dateFmt(schedules.find(x=>x.item_id===selected)?.actual_last_receipt_at||null)}; penggunaan terakhir: {dateFmt(schedules.find(x=>x.item_id===selected)?.actual_last_use_at||null)}.</p>}<div className="grid gap-3 md:grid-cols-2">
    <label><span className={label}>Mulai kebutuhan</span><input type="date" className={input} value={form.need_start_date} onChange={e=>setForm({...form,need_start_date:e.target.value})}/></label>
    <label><span className={label}>Batas seluruh material harus masuk</span><input type="date" className={input} value={form.target_receipt_date} onChange={e=>setForm({...form,target_receipt_date:e.target.value})}/></label>
    <label><span className={label}>Target mulai penggunaan</span><input type="date" className={input} value={form.target_use_start_date} onChange={e=>setForm({...form,target_use_start_date:e.target.value})}/></label>
    <label><span className={label}>Batas seluruh material selesai digunakan/keluar</span><input type="date" className={input} value={form.target_use_end_date} onChange={e=>setForm({...form,target_use_end_date:e.target.value})}/></label>
    <label className="md:col-span-2"><span className={label}>Catatan / alasan revisi jadwal</span><textarea required className={input} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
   </div><button disabled={!canManage||busy||!selected} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save className="h-4 w-4"/>Simpan jadwal & audit</button></form>
   <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-3 text-sm font-bold">Ringkasan tenggat item</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Item</th><th className="p-2">Target masuk</th><th className="p-2">Target mulai pakai</th><th className="p-2">Target selesai pakai</th><th className="p-2">Realisasi masuk terakhir</th><th className="p-2">Realisasi pakai terakhir</th></tr></thead><tbody>{schedules.map(s=><tr key={s.item_id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2">{items.find(x=>x.id===s.item_id)?.nama_barang||s.item_id}</td><td className="p-2">{dateFmt(s.target_receipt_date)}</td><td className="p-2">{dateFmt(s.target_use_start_date)}</td><td className="p-2">{dateFmt(s.target_use_end_date)}</td><td className="p-2">{dateFmt(s.actual_last_receipt_at)}</td><td className="p-2">{dateFmt(s.actual_last_use_at)}</td></tr>)}</tbody></table></div></div>
  </div>}
  {tab==='tambahan'&&<div className="space-y-4">
   <form onSubmit={addVariation} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4"/>Catat pekerjaan / kebutuhan tambahan</h2><p className="mb-4 text-[11px] text-slate-500">Permintaan klien berstatus dapat ditagihkan; inisiatif kontraktor otomatis tidak ditagihkan. Tambahan baru menambah target setelah disetujui.</p><div className="grid gap-3 md:grid-cols-2">
    <label><span className={label}>Terkait item BOQ (opsional untuk item baru)</span><select className={input} value={addition.item_id} onChange={e=>{const x=items.find(i=>i.id===e.target.value);setAddition({...addition,item_id:e.target.value,description:x?.nama_barang||addition.description,uom:x?.satuan||addition.uom,unit_rate:String(x?.harga_satuan||addition.unit_rate)})}}><option value="">Item baru / tidak ada di BOQ</option>{items.map(x=><option key={x.id} value={x.id}>{x.kode_boq} — {x.nama_barang}</option>)}</select></label>
    <label><span className={label}>Nama item / uraian tambahan</span><input required className={input} value={addition.description} onChange={e=>setAddition({...addition,description:e.target.value})}/></label>
    <label><span className={label}>Qty tambahan</span><input required type="number" min="0.0001" step="any" className={input} value={addition.quantity} onChange={e=>setAddition({...addition,quantity:e.target.value})}/></label>
    <label><span className={label}>UOM</span><input required className={input} value={addition.uom} onChange={e=>setAddition({...addition,uom:e.target.value})}/></label>
    <label><span className={label}>Harga satuan (Rp)</span><input required type="number" min="0" step="any" className={input} value={addition.unit_rate} onChange={e=>setAddition({...addition,unit_rate:e.target.value})}/></label>
    <label><span className={label}>Kepemilikan item</span><select className={input} value={addition.owner_type} onChange={e=>setAddition({...addition,owner_type:e.target.value})}><option value="KONTRAKTOR">By Kontraktor</option><option value="IMK">By IMK</option></select></label>
    <label><span className={label}>Jenis item</span><select className={input} value={addition.is_stock_item?'STOK':'JASA'} onChange={e=>setAddition({...addition,is_stock_item:e.target.value==='STOK'})}><option value="STOK">Material / barang stok</option><option value="JASA">Jasa / non-stok</option></select></label>
    <label><span className={label}>Pihak pengaju</span><select className={input} value={addition.requester_type} onChange={e=>setAddition({...addition,requester_type:e.target.value})}><option value="CLIENT">Klien (dapat ditagihkan)</option><option value="CONTRACTOR">Kontraktor (tidak ditagihkan)</option></select></label>
    <label><span className={label}>Diminta oleh</span><input required className={input} value={addition.requested_by_name} onChange={e=>setAddition({...addition,requested_by_name:e.target.value})}/></label>
    <label><span className={label}>Referensi permintaan / persetujuan</span><input className={input} value={addition.approval_reference} onChange={e=>setAddition({...addition,approval_reference:e.target.value})}/></label>
    <label className="md:col-span-2"><span className={label}>Alasan penambahan</span><textarea required className={input} rows={2} value={addition.reason} onChange={e=>setAddition({...addition,reason:e.target.value})}/></label>
   </div><button disabled={!canManage||busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Simpan pengajuan tambahan</button></form>
   <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-3 text-sm font-bold">Daftar pekerjaan tambah</h2><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Kode / Item</th><th className="p-2">Qty</th><th className="p-2">Pengaju</th><th className="p-2">Tagihan</th><th className="p-2">Persetujuan</th><th className="p-2">Alasan</th><th className="p-2">Aksi</th></tr></thead><tbody>{additions.map(a=><tr key={a.id} className="border-b border-slate-100 dark:border-slate-800"><td className="p-2"><b>{a.addition_code}</b><div>{a.description}</div></td><td className="p-2">{a.quantity} {a.uom}<div>Rp {Number(a.unit_rate).toLocaleString('id-ID')}/unit</div></td><td className="p-2">{a.requester_type==='CLIENT'?'Klien':'Kontraktor'}</td><td className="p-2">{a.billing_status}</td><td className="p-2">{a.approval_status}</td><td className="p-2">{a.reason}</td><td className="p-2"><div className="flex gap-1"><button disabled={!canManage||busy||a.approval_status!=='DIAJUKAN'} onClick={()=>changeAddition(a.id,{approval_status:'DISETUJUI'})} className="rounded bg-emerald-100 px-2 py-1 text-emerald-700 disabled:opacity-30">Setujui</button><button disabled={!canManage||busy||a.approval_status!=='DIAJUKAN'} onClick={()=>changeAddition(a.id,{approval_status:'DITOLAK'})} className="rounded bg-rose-100 px-2 py-1 text-rose-700 disabled:opacity-30">Tolak</button>{a.requester_type==='CLIENT'&&a.approval_status==='DISETUJUI'&&<select className="rounded border p-1" value={a.billing_status} onChange={e=>changeAddition(a.id,{billing_status:e.target.value})}><option value="BELUM_DITAGIHKAN">Belum tagih</option><option value="DITAGIHKAN">Ditagihkan</option><option value="DIBAYAR">Dibayar</option></select>}</div></td></tr>)}</tbody></table></div></div>
  </div>}
  {tab==='audit'&&<div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4"/>Jejak perubahan terbaru</h2><button onClick={()=>load().catch(e=>setError(e.message))} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"><RefreshCw className="h-3 w-3"/>Muat ulang</button></div>{!['admin','auditor'].includes(user.databaseRole||'')?<p className="text-xs text-amber-600">Riwayat audit lengkap hanya dapat dilihat admin/auditor.</p>:<div className="space-y-2">{audit.map(a=><details key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer text-xs"><b>{a.action}</b> · {a.entity_type} #{a.entity_id} · {new Date(a.created_at).toLocaleString('id-ID')} · Pelaku: {a.details?.actor_name||a.actor_id||'sistem'}</summary><pre className="mt-2 overflow-auto rounded bg-slate-50 p-3 text-[10px] dark:bg-slate-950">{JSON.stringify(a.details,null,2)}</pre></details>)}{audit.length===0&&<p className="text-xs text-slate-500">Belum ada catatan audit yang dapat ditampilkan.</p>}</div>}</div>}
  <p className="text-[10px] text-slate-400">Seluruh perubahan pada data proyek, jadwal, BOQ dan pekerjaan tambah dicatat otomatis di audit log. Transaksi ledger bersifat append-only; koreksi dilakukan dengan transaksi pembalik.</p>
 </div>;
};
