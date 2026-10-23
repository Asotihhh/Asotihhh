import Link from 'next/link';

const price = process.env.NEXT_PUBLIC_PACK_PRICE || '20 000 FCFA';
const months = process.env.NEXT_PUBLIC_PACK_MONTHS || '6';

export default function Home() {
  return (
    <main className="container">
      <section className="hero">
        <span className="kicker">Agroéconomie · Phytotechnie · Zootechnie</span>
        <h1>Rédige ton mémoire de stage sans te perdre dans le plan.</h1>
        <p>
          Sillon te guide section par section, vérifie la cohérence entre tes objectifs, tes hypothèses et tes
          analyses, et produit un document Word prêt à imprimer. Tu restes l&apos;auteur de ton travail : Sillon
          guide et corrige, il n&apos;écrit pas à ta place.
        </p>
        <div className="row">
          <Link href="/connexion?mode=inscription" className="btn primary">Commencer gratuitement</Link>
          <Link href="/connexion" className="btn">J&apos;ai déjà un compte</Link>
        </div>
      </section>

      <section className="features">
        <div className="card"><h3>Le plan officiel, déjà prêt</h3><p className="muted small">Des pages liminaires aux annexes, chaque section arrive avec sa consigne et un conseil propre à ton parcours.</p></div>
        <div className="card"><h3>Vérifications en direct</h3><p className="muted small">Objectifs sans verbe d&apos;action, hypothèse manquante, test statistique absent : les erreurs s&apos;affichent pendant que tu écris.</p></div>
        <div className="card"><h3>Ton encadreur dans la boucle</h3><p className="muted small">Invite-le par email : il lit ton mémoire, commente chaque section et valide quand c&apos;est prêt.</p></div>
        <div className="card"><h3>Export Word en un clic</h3><p className="muted small">Page de garde, sommaire, titres numérotés, tableaux et figures : le document suit la mise en page attendue.</p></div>
      </section>

      <section className="pricing">
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Gratuit</h3>
          <div className="price">0 FCFA</div>
          <p className="muted small">Un mémoire, l&apos;éditeur guidé et toutes les vérifications. Sans export.</p>
        </div>
        <div className="card stack" style={{ borderColor: 'var(--accent)' }}>
          <h3 style={{ margin: 0 }}>Pack mémoire</h3>
          <div className="price">{price}</div>
          <p className="muted small">Pendant {months} mois : export Word, espace encadreur, figures, assistant de conseil et mémoires illimités.</p>
        </div>
      </section>
    </main>
  );
}
