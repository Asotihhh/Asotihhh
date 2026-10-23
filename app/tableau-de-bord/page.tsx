import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserAndProfile, hasPlan } from '@/lib/supabase/server';
import { PARCOURS, type Parcours } from '@/lib/plan';
import { createProject } from './actions';

type ProjectRow = {
  id: string; title: string; parcours: Parcours; status: string; owner_id: string;
  owner_name: string; structure_accueil: string; updated_at: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'neutral' },
  soumis: { label: "Soumis à l'encadreur", cls: 'warn' },
  valide: { label: 'Validé', cls: 'ok' },
};

const ERRORS: Record<string, string> = {
  limite: "L'offre gratuite permet un seul mémoire. Passe au Pack mémoire pour en créer d'autres.",
  creation: "Le mémoire n'a pas pu être créé. Réessaie dans un instant.",
  parcours: 'Choisis un parcours.',
  confirmation: 'Tape SUPPRIMER pour confirmer la suppression.',
};

export default async function Dashboard({ searchParams }: { searchParams: { erreur?: string } }) {
  const { supabase, user, profile } = await getUserAndProfile();
  if (!user) redirect('/connexion');

  const { data } = await supabase
    .from('projects')
    .select('id,title,parcours,status,owner_id,owner_name,structure_accueil,updated_at')
    .order('updated_at', { ascending: false });
  const projects = (data || []) as ProjectRow[];
  const mine = projects.filter((p) => p.owner_id === user.id);
  const supervised = projects.filter((p) => p.owner_id !== user.id);
  const paid = hasPlan(profile);
  const canCreate = paid || mine.length < 1;

  return (
    <main className="container page stack" style={{ gap: 28 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Mes mémoires</h1>
        {paid ? (
          <span className="pill ok">
            Pack mémoire actif{profile?.plan_until ? ` jusqu'au ${new Date(profile.plan_until).toLocaleDateString('fr-FR')}` : ''}
          </span>
        ) : (
          <span className="pill neutral">Offre gratuite</span>
        )}
      </div>

      {searchParams.erreur && ERRORS[searchParams.erreur] && <p className="error">{ERRORS[searchParams.erreur]}</p>}

      {mine.length > 0 && (
        <div className="grid-cards">
          {mine.map((p) => (
            <Link key={p.id} href={`/projet/${p.id}`} className="card project-card">
              <span className="kicker">{PARCOURS[p.parcours]}</span>
              <h3>{p.title}</h3>
              {p.structure_accueil && <span className="small muted">Stage : {p.structure_accueil}</span>}
              <span className={`pill ${STATUS[p.status].cls}`} style={{ alignSelf: 'flex-start' }}>{STATUS[p.status].label}</span>
            </Link>
          ))}
        </div>
      )}

      {canCreate ? (
        <form action={createProject} className="card stack" style={{ maxWidth: 640 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>{mine.length ? 'Nouveau mémoire' : 'Commence ton mémoire'}</h2>
          <label htmlFor="title">Titre provisoire
            <input id="title" name="title" placeholder="Effet de… sur… en zone de…" />
          </label>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <label htmlFor="parcours" style={{ flex: '1 1 180px' }}>Parcours
              <select id="parcours" name="parcours" required defaultValue="">
                <option value="" disabled>Choisir…</option>
                {Object.entries(PARCOURS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label htmlFor="annee" style={{ flex: '1 1 140px' }}>Année académique
              <input id="annee" name="annee" placeholder="2026-2027" />
            </label>
          </div>
          <label htmlFor="structure_accueil">Structure d&apos;accueil du stage
            <input id="structure_accueil" name="structure_accueil" placeholder="Nom de l'entreprise, de la station ou de l'ONG" />
          </label>
          <button className="btn primary" type="submit" style={{ alignSelf: 'flex-start' }}>Créer le mémoire</button>
        </form>
      ) : (
        <div className="card stack" style={{ maxWidth: 640 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Passer au Pack mémoire</h2>
          <p className="muted" style={{ margin: 0 }}>
            Export Word, espace encadreur, figures, assistant de conseil et mémoires illimités pendant {process.env.NEXT_PUBLIC_PACK_MONTHS || '6'} mois,
            pour {process.env.NEXT_PUBLIC_PACK_PRICE || '20 000 FCFA'}.
          </p>
          <p className="note" style={{ margin: 0 }}>{process.env.NEXT_PUBLIC_PAYMENT_INSTRUCTIONS}</p>
          <p className="small muted" style={{ margin: 0 }}>Email de ton compte : <strong>{user.email}</strong></p>
        </div>
      )}

      {supervised.length > 0 && (
        <section className="stack">
          <h2 style={{ margin: 0, fontSize: 22 }}>Mémoires que j&apos;encadre</h2>
          <div className="grid-cards">
            {supervised.map((p) => (
              <Link key={p.id} href={`/projet/${p.id}`} className="card project-card">
                <span className="kicker">{PARCOURS[p.parcours]} · {p.owner_name}</span>
                <h3>{p.title}</h3>
                <span className={`pill ${STATUS[p.status].cls}`} style={{ alignSelf: 'flex-start' }}>{STATUS[p.status].label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
