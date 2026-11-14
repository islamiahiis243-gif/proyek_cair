import React,{useEffect,useState}from'react';
import{getSupabaseClient}from'../lib/supabase';
import{ShieldCheck,ShieldAlert,Loader2,LockKeyhole}from'lucide-react';

type VerifiedDocument={
 document_no:string;
 title:string;
 document_type:string|null;
 status:string;
 content_sha256:string|null;
 issued_at:string|null;
 created_at:string;
 period_start:string|null;
 period_end:string|null;
 signer_name:string|null;
 signer_role:string|null;
 company_name:string|null;
 approval_level:string|null;
};

export const PrivateDocumentVerify:React.FC=()=>{
 const[token]=useState(()=>new URLSearchParams(window.location.search).get('doc')||'');
 const[data,setData]=useState<VerifiedDocument|null>(null);
 const[busy,setBusy]=useState(true);
 const[error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  (async()=>{
   if(!token){
    if(active){setError('Token QR tidak tersedia.');setBusy(false);}
    return;
   }
   try{
    const{data:rows,error:rpcError}=await getSupabaseClient().rpc('verify_private_document_qr',{p_token:token});
    if(rpcError)throw rpcError;
    const row=Array.isArray(rows)?rows[0]:null;
    if(active){
     if(!row)setError('Dokumen tidak tersedia untuk akun ini, token tidak valid, atau akses tidak diizinkan.');
     else setData(row as VerifiedDocument);
    }
   }catch{
    if(active)setError('Verifikasi privat gagal. Pastikan akun memiliki keanggotaan proyek dan izin pemindaian serta verifikasi QR.');
   }finally{
    if(active)setBusy(false);
   }
  })();
  return()=>{active=false;};
 },[token]);

 return <main className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950">
  <div className="mx-auto mt-12 max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
   <div className="bg-slate-900 p-6 text-white">
    <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-blue-300"><LockKeyhole className="h-4 w-4"/> VERIFIKASI QR PRIVAT</div>
    <h1 className="mt-2 text-2xl font-bold">Verifikasi Dokumen</h1>
    <p className="mt-1 text-xs text-slate-400">Hanya anggota proyek dengan izin document.qr.scan dan document.qr.verify yang dapat memeriksa dokumen.</p>
   </div>
   <div className="p-6">
    {busy?<div className="flex items-center gap-2 text-sm"><Loader2 className="h-5 w-5 animate-spin"/>Memeriksa izin dan status dokumen…</div>:data?<>
     <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      <ShieldCheck className="h-8 w-8"/>
      <div><b className="text-sm">DOKUMEN TERVERIFIKASI</b><p className="text-xs">Status: {data.status}. Pemeriksaan tercatat pada audit trail.</p></div>
     </div>
     <dl className="mt-5 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
      {[
       ['Nomor dokumen',data.document_no],['Judul',data.title],['Jenis',data.document_type||'-'],
       ['Periode',String(data.period_start||'-')+' s/d '+String(data.period_end||'-')],
       ['Penanda tangan tercatat',data.signer_name||'-'],['Jabatan',data.signer_role||'-'],
       ['Perusahaan',data.company_name||'-'],['Tanggal terbit',data.issued_at?new Date(data.issued_at).toLocaleString('id-ID'):'-']
      ].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-900 dark:text-white">{value}</dd></div>)}
     </dl>
     <div className="mt-5 break-all rounded-lg bg-slate-950 p-3 font-mono text-[10px] text-slate-300">SHA-256 snapshot: {data.content_sha256||'Tidak tersedia'}</div>
     <p className="mt-3 text-[10px] text-slate-500">Hasil ini mengonfirmasi status registrasi dan hash snapshot yang tersimpan. Ini bukan validasi sertifikat tanda tangan elektronik tersertifikasi atau bukti bahwa salinan file fisik tidak berubah.</p>
    </>:<div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
     <ShieldAlert className="h-6 w-6 shrink-0"/><div><b className="text-sm">DOKUMEN TIDAK DAPAT DIVERIFIKASI</b><p className="mt-1 text-xs">{error}</p><p className="mt-2 text-xs">Akses QR memerlukan login serta permission aktif pada proyek yang sesuai.</p></div>
    </div>}
   </div>
  </div>
 </main>;
};
