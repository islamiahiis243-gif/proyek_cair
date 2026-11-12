import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig, UserProfile } from '../types';

const STORAGE_KEY_USER = 'proyek_cair_user';
export const DEFAULT_USER: UserProfile = { id:'', name:'Pengguna', email:'', role:'Viewer', provider:'guest' };
const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseInstance: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Konfigurasi Supabase belum tersedia. Hubungi administrator UDU.');
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return supabaseInstance;
}

export function getStoredConfig(): SupabaseConfig {
  return { url: SUPABASE_URL || '', anonKey: SUPABASE_KEY || '', isConnected: Boolean(SUPABASE_URL && SUPABASE_KEY) };
}
export function saveStoredConfig(_config: SupabaseConfig): void {
  // Runtime credentials are deployment environment variables, never browser localStorage.
}
export function getStoredUser(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { id: '', name: 'Pengguna', email: '', role: 'Viewer', provider: 'guest' };
}
export function saveStoredUser(user: UserProfile): void {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
}
export async function initiateGoogleSignIn(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  if (error) throw error;
}
export async function signOutSupabase(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
  localStorage.removeItem(STORAGE_KEY_USER);
}
export async function testSupabaseConnection(_url?: string, _anonKey?: string): Promise<{success:boolean;message:string}> {
  try {
    const { error } = await getSupabaseClient().from('boq_items').select('id').limit(1);
    if (error) return { success:false, message:error.message };
    return { success:true, message:'Terhubung ke database UDU.' };
  } catch (error:any) {
    return { success:false, message:error.message || 'Koneksi gagal.' };
  }
}
