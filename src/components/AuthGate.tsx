import React, { useEffect, useState } from 'react';
import { getSupabaseClient, saveStoredUser } from '../lib/supabase';
import { UserProfile } from '../types';

const roleMap: Record<string, UserProfile['role']> = {
  admin: 'Admin',
  site_manager: 'Site Manager',
  storekeeper: 'Logistik & Gudang',
  finance: 'Finance',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const client = getSupabaseClient();
    const sync = async (session: any) => {
      if (!session?.user) {
        setAuthed(false);
        localStorage.removeItem('proyek_cair_user');
        setReady(true);
        return;
      }
      const { data: profile, error } = await client
        .from('profiles')
        .select('id,full_name,role,is_active')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        setError('Gagal memuat profil akses: ' + error.message);
        setAuthed(false);
        setReady(true);
        return;
      }
      if (profile && !profile.is_active) {
        await client.auth.signOut();
        setError('Akun dinonaktifkan. Hubungi administrator.');
        setAuthed(false);
        setReady(true);
        return;
      }
      const role = profile?.role || 'viewer';
      saveStoredUser({
        id: session.user.id,
        name: profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Pengguna',
        email: session.user.email || '',
        avatar_url: session.user.user_metadata?.avatar_url,
        role: roleMap[role] || 'Viewer',
        databaseRole: role,
        provider: session.user.app_metadata?.provider === 'google' ? 'google' : 'guest',
      });
      setAuthed(true);
      setReady(true);
    };
    client.auth.getSession().then(({ data }) => sync(data.session));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { void sync(session); });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const client = getSupabaseClient();
      if (mode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (!data.session) setNotice('Pendaftaran berhasil. Periksa email untuk konfirmasi, lalu masuk kembali.');
      }
    } catch (e: any) {
      setError(e.message || 'Autentikasi gagal.');
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || 'Google sign-in gagal.');
      setBusy(false);
    }
  };

  if (!ready) return <div className="min-h-screen grid place-items-center bg-slate-950 text-white">Memeriksa sesi UDU…</div>;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen grid place-items-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-4">
          <img
            src="/android-chrome-192x192.png"
            alt="Logo Menara Megah"
            className="h-16 w-16 rounded-xl bg-white object-contain p-1"
          />
          <div>
            <div className="text-xs font-bold tracking-[.25em] text-blue-400">MENARA MEGAH</div>
            <h1 className="mt-1 text-2xl font-bold">Proyek Cair</h1>
            <p className="mt-1 text-sm text-slate-400">Kontrol BOQ, stok, kas, dan proyek.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <label className="block text-sm">Nama lengkap
              <input required value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" />
            </label>
          )}
          <label className="block text-sm">Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" />
          </label>
          <label className="block text-sm">Password
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" />
          </label>
          {error && <div role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-300">{notice}</div>}
          <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Memproses…' : mode === 'signin' ? 'Masuk' : 'Daftar akun'}
          </button>
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" /><span>ATAU</span><span className="h-px flex-1 bg-slate-800" />
        </div>
        <button onClick={google} disabled={busy} className="w-full rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-800">
          Lanjutkan dengan Google
        </button>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }} className="mt-5 w-full text-sm text-blue-400">
          {mode === 'signin' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </div>
    </div>
  );
};
