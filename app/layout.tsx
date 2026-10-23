import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { getUserAndProfile } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Sillon : rédige ton mémoire de stage',
  description: "Rédaction guidée et vérification du mémoire de stage pour les étudiants en agronomie.",
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getUserAndProfile();
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Instrument+Sans:wght@400;500;600;700&family=Literata:opsz,wght@7..72,400;7..72,500&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="topbar">
          <div className="container">
            <Link href="/" className="logo">Sillon<span>.</span></Link>
            <nav className="topnav">
              {user ? (
                <>
                  <Link href="/tableau-de-bord">Mes mémoires</Link>
                  {profile?.role === 'admin' && <Link href="/admin">Administration</Link>}
                  <span className="muted small">{profile?.full_name || user.email}</span>
                  <form action="/auth/deconnexion" method="post">
                    <button className="btn small" type="submit">Se déconnecter</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/connexion">Se connecter</Link>
                  <Link href="/connexion?mode=inscription" className="btn primary small">Créer un compte</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
