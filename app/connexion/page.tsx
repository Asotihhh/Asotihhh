'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

function Form() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'connexion' | 'inscription'>(params.get('mode') === 'inscription' ? 'inscription' : 'connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const next = params.get('suite') || '/tableau-de-bord';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    const supabase = createClient();
    if (mode === 'inscription') {
      const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${site}/auth/callback?suite=${encodeURIComponent(next)}` },
      });
      setBusy(false);
      if (error) return setError(traduire(error.message));
      if (!data.session) return setInfo('Compte créé. Ouvre l\'email de confirmation que tu viens de recevoir, puis reviens te connecter.');
      router.push(next); router.refresh();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(traduire(error.message));
      router.push(next); router.refresh();
    }
  }

  return (
    <main className="container page" style={{ maxWidth: 440 }}>
      <form className="card stack" onSubmit={submit}>
        <h1 style={{ margin: 0, fontSize: 26 }}>{mode === 'inscription' ? 'Créer ton compte' : 'Te connecter'}</h1>
        {mode === 'inscription' && (
          <label htmlFor="full_name">Nom et prénoms
            <input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label htmlFor="email">Email
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label htmlFor="password">Mot de passe
          <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'} />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="success">{info}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Un instant…' : mode === 'inscription' ? 'Créer mon compte' : 'Me connecter'}
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          {mode === 'inscription' ? 'Tu as déjà un compte ? ' : 'Pas encore de compte ? '}
          <button type="button" className="linkbtn" onClick={() => setMode(mode === 'inscription' ? 'connexion' : 'inscription')}>
            {mode === 'inscription' ? 'Te connecter' : 'Créer un compte'}
          </button>
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Encadreur ? Crée ton compte avec l&apos;email auquel ton étudiant t&apos;a invité : son mémoire apparaîtra dans ton espace.
        </p>
      </form>
    </main>
  );
}

function traduire(msg: string) {
  if (/invalid login/i.test(msg)) return 'Email ou mot de passe incorrect.';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet email : connecte-toi.';
  if (/password/i.test(msg)) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (/email not confirmed/i.test(msg)) return "Ton email n'est pas encore confirmé : ouvre le lien reçu par email.";
  return msg;
}

export default function Page() {
  return <Suspense><Form /></Suspense>;
}
