import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getUserAndProfile } from '@/lib/supabase/server';

async function activate(formData: FormData) {
  'use server';
  const { supabase, profile } = await getUserAndProfile();
  if (profile?.role !== 'admin') redirect('/');
  const email = String(formData.get('email') || '').trim();
  const months = Math.max(1, Math.min(24, Number(formData.get('months') || 6)));
  const { data, error } = await supabase.rpc('activate_plan', { target_email: email, months });
  revalidatePath('/admin');
  if (error) redirect(`/admin?erreur=${encodeURIComponent(email)}`);
  redirect(`/admin?ok=${encodeURIComponent(email)}&jusqu=${encodeURIComponent(String(data))}`);
}

export default async function Admin({ searchParams }: { searchParams: { ok?: string; erreur?: string; jusqu?: string } }) {
  const { supabase, profile } = await getUserAndProfile();
  if (profile?.role !== 'admin') redirect('/tableau-de-bord');

  const { data: users } = await supabase
    .from('profiles')
    .select('email,full_name,plan_until,created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const now = new Date();
  const rows = (users || []) as { email: string; full_name: string; plan_until: string | null; created_at: string }[];
  const active = rows.filter((u) => u.plan_until && new Date(u.plan_until) > now).length;

  return (
    <main className="container page stack" style={{ gap: 24 }}>
      <h1 style={{ margin: 0 }}>Administration</h1>
      <div className="row">
        <div className="card"><div className="big">{rows.length}</div><div className="small muted">comptes (200 derniers)</div></div>
        <div className="card"><div className="big">{active}</div><div className="small muted">Packs mémoire actifs</div></div>
      </div>

      <form action={activate} className="card stack" style={{ maxWidth: 560 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Activer un Pack mémoire</h2>
        <p className="small muted" style={{ margin: 0 }}>Après réception du paiement, saisis l&apos;email du compte. La durée s&apos;ajoute à l&apos;offre en cours.</p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label htmlFor="email" style={{ flex: '1 1 260px' }}>Email du compte
            <input id="email" name="email" type="email" required />
          </label>
          <label htmlFor="months" style={{ width: 120 }}>Durée (mois)
            <input id="months" name="months" type="number" min={1} max={24} defaultValue={Number(process.env.NEXT_PUBLIC_PACK_MONTHS || 6)} />
          </label>
          <button className="btn primary" type="submit">Activer</button>
        </div>
        {searchParams.ok && (
          <p className="success" style={{ margin: 0 }}>
            Pack activé pour {searchParams.ok}
            {searchParams.jusqu ? ` jusqu'au ${new Date(searchParams.jusqu).toLocaleDateString('fr-FR')}` : ''}.
          </p>
        )}
        {searchParams.erreur && <p className="error" style={{ margin: 0 }}>Aucun compte trouvé pour {searchParams.erreur}. Vérifie l&apos;adresse.</p>}
      </form>

      <div className="tablewrap">
        <table>
          <thead><tr><th>Email</th><th>Nom</th><th>Inscription</th><th>Pack mémoire</th></tr></thead>
          <tbody>
            {rows.map((u) => {
              const on = u.plan_until && new Date(u.plan_until) > now;
              return (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td>{u.full_name}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>{on ? <span className="pill ok">Jusqu&apos;au {new Date(u.plan_until!).toLocaleDateString('fr-FR')}</span> : <span className="pill neutral">Gratuit</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
