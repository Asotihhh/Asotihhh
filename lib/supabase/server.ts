import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un composant serveur : le middleware rafraîchit la session.
          }
        },
      },
    }
  );
}

export async function getUserAndProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return { supabase, user, profile: profile as Profile | null };
}

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'etudiant' | 'encadreur' | 'admin';
  plan_until: string | null;
  created_at: string;
};

export function hasPlan(p: Profile | null) {
  if (!p) return false;
  if (p.role === 'admin') return true;
  return !!p.plan_until && new Date(p.plan_until) > new Date();
}
