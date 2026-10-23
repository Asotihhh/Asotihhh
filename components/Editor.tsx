'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SECTIONS, SECTION_BY_KEY, PARTS, PARCOURS, FORMAT_HELP, type Parcours } from '@/lib/plan';
import { runChecks, score, sectionStatus, lines, words, isInfinitive, overlap, type Check } from '@/lib/checks';

export type Project = {
  id: string; owner_id: string; title: string; parcours: Parcours; structure_accueil: string; annee: string;
  status: 'brouillon' | 'soumis' | 'valide'; owner_name: string; encadreur_name: string; maitre_stage: string;
};
export type Member = { email: string; user_id: string | null; created_at: string };
type Comment = { id: string; section_key: string; author_id: string; author_name: string; body: string; resolved: boolean; created_at: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const VIRTUAL = { infos: 'Informations du mémoire', matrice: 'Matrice de cohérence' } as const;
const STATUS_LABEL = { brouillon: 'Brouillon', soumis: "Soumis à l'encadreur", valide: 'Validé' };
const STATUS_CLS = { brouillon: 'neutral', soumis: 'warn', valide: 'ok' };

export default function Editor(props: {
  project: Project; initialContent: Record<string, string>; members: Member[]; isOwner: boolean;
  paid: boolean; userId: string; userName: string; aiEnabled: boolean;
}) {
  const { isOwner, paid, userId, userName, aiEnabled } = props;
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [project, setProject] = useState(props.project);
  const [content, setContent] = useState<Record<string, string>>(props.initialContent);
  const [current, setCurrent] = useState<string>('infos');
  const [save, setSave] = useState<SaveState>('idle');
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>(props.members);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, string>>({});
  const textRef = useRef<HTMLTextAreaElement>(null);

  const checks = useMemo(() => runChecks(content, project.parcours), [content, project.parcours]);
  const pct = score(checks);

  // ---------- Sauvegarde automatique ----------
  const flush = useCallback(async (key: string) => {
    const value = pending.current[key];
    if (value === undefined) return;
    delete pending.current[key];
    setSave('saving');
    const { error } = await supabase.from('sections').upsert(
      { project_id: project.id, key, content: value, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,key' }
    );
    setSave(error ? 'error' : 'saved');
  }, [supabase, project.id]);

  function edit(key: string, value: string) {
    setContent((c) => ({ ...c, [key]: value }));
    pending.current[key] = value;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => flush(key), 1200);
  }

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  function go(key: string) {
    Object.keys(pending.current).forEach((k) => { clearTimeout(timers.current[k]); flush(k); });
    setCurrent(key);
    if (window.innerWidth < 1100) document.getElementById('sheet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Commentaires ----------
  const loadComments = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*').eq('project_id', project.id).order('created_at');
    setComments((data || []) as Comment[]);
  }, [supabase, project.id]);
  useEffect(() => { loadComments(); }, [loadComments]);

  // ---------- Statut ----------
  async function setStatus(status: Project['status']) {
    const { error } = await supabase.rpc('set_project_status', { p: project.id, new_status: status });
    if (!error) setProject((p) => ({ ...p, status }));
  }

  const sec = SECTION_BY_KEY[current];
  const openCount = (key: string) => comments.filter((c) => c.section_key === key && !c.resolved).length;

  return (
    <main className="container">
      <div className="projhead">
        <div className="stack" style={{ gap: 4 }}>
          <span className="kicker">{PARCOURS[project.parcours]}{!isOwner && ` · ${project.owner_name}`}</span>
          <h1>{project.title}</h1>
        </div>
        <div className="row">
          <span className={`pill ${STATUS_CLS[project.status]}`}>{STATUS_LABEL[project.status]}</span>
          {isOwner && project.status === 'brouillon' && members.length > 0 && (
            <button className="btn small" onClick={() => setStatus('soumis')}>Soumettre à l&apos;encadreur</button>
          )}
          {isOwner && project.status === 'soumis' && (
            <button className="btn small" onClick={() => setStatus('brouillon')}>Reprendre la rédaction</button>
          )}
          {!isOwner && project.status !== 'valide' && (
            <button className="btn small primary" onClick={() => setStatus('valide')}>Valider le mémoire</button>
          )}
          {!isOwner && project.status === 'valide' && (
            <button className="btn small" onClick={() => setStatus('soumis')}>Retirer la validation</button>
          )}
          {(paid || !isOwner) ? (
            <a className="btn small primary" href={`/projet/${project.id}/export`}>Exporter en Word</a>
          ) : (
            <Link className="btn small" href="/tableau-de-bord" title="Réservé au Pack mémoire">Exporter en Word (Pack)</Link>
          )}
        </div>
      </div>

      <div className="editor">
        <nav className="nav" aria-label="Plan du mémoire">
          <p className="part">Projet</p>
          {(['infos', 'matrice'] as const).map((k) => (
            <button key={k} aria-current={current === k} onClick={() => go(k)}>
              <span className={`dot ${k === 'matrice' ? matrixStatus(checks) : ''}`} />{VIRTUAL[k]}
            </button>
          ))}
          {PARTS.map((part) => (
            <div key={part} style={{ display: 'contents' }}>
              <p className="part">{part}</p>
              {SECTIONS.filter((s) => s.part === part).map((s) => (
                <button key={s.key} aria-current={current === s.key} onClick={() => go(s.key)}>
                  <span className={`dot ${sectionStatus(checks, s.key)}`} />
                  <span style={{ flex: 1 }}>{s.title}</span>
                  {openCount(s.key) > 0 && <span className="pill warn">{openCount(s.key)}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <section className="sheet" id="sheet">
          {current === 'infos' && (
            <InfosPanel project={project} setProject={setProject} isOwner={isOwner} supabase={supabase}
              members={members} setMembers={setMembers} paid={paid} onDeleted={() => router.push('/tableau-de-bord')} />
          )}
          {current === 'matrice' && <Matrix content={content} />}
          {sec && (
            <>
              <div className="kicker">{sec.part}</div>
              <h2>{sec.title}</h2>
              <p className="guide">{sec.guide}</p>
              {sec.tips?.[project.parcours] && (
                <div className="tip"><strong>Conseil</strong><span>{sec.tips[project.parcours]}</span></div>
              )}
              <label htmlFor={`f-${sec.key}`} hidden>{sec.title}</label>
              <textarea
                id={`f-${sec.key}`}
                ref={textRef}
                className={`writer ${sec.kind !== 'text' ? 'short' : ''}`}
                value={content[sec.key] || ''}
                onChange={(e) => edit(sec.key, e.target.value)}
                readOnly={!isOwner}
                spellCheck
                placeholder={!isOwner ? 'Cette section est encore vide.' : sec.kind === 'list' ? 'Une entrée par ligne…' : 'Commence à rédiger…'}
              />
              <div className="meta">
                <span>
                  {words(content[sec.key]).length} mots
                  {sec.kind === 'list' ? ` · ${lines(content[sec.key]).length} ligne(s)` : ''}
                </span>
                <span>{isOwner ? saveLabel(save) : 'Lecture seule'}</span>
              </div>
              {isOwner && sec.kind === 'text' && <p className="small muted" style={{ margin: '6px 0 0' }}>{FORMAT_HELP}</p>}
              {sec.kind === 'text' && (
                <Figures projectId={project.id} sectionKey={sec.key} text={content[sec.key] || ''} isOwner={isOwner} paid={paid}
                  supabase={supabase} textRef={textRef} onInsert={(v) => edit(sec.key, v)} />
              )}
              <div className="stack" style={{ gap: 6, marginTop: 16 }}>
                {checks.filter((c) => c.key === sec.key).map((c, i) => <Issue key={i} c={c} />)}
              </div>
              {aiEnabled && isOwner && <Assistant projectId={project.id} sectionKey={sec.key} paid={paid} />}
            </>
          )}
        </section>

        <aside className="side-right">
          <div className="panel">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="big">{pct}%</span><span className="small muted">cohérence du mémoire</span>
            </div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <span className="pill err">{checks.filter((c) => c.level === 'err').length} erreurs</span>
              <span className="pill warn">{checks.filter((c) => c.level === 'warn').length} à revoir</span>
              <span className="pill ok">{checks.filter((c) => c.level === 'ok').length} validés</span>
            </div>
          </div>
          {(sec || current === 'matrice') && (
            <CommentsPanel
              sectionKey={sec ? sec.key : 'matrice'}
              comments={comments.filter((c) => c.section_key === (sec ? sec.key : 'matrice'))}
              projectId={project.id} userId={userId} userName={userName} supabase={supabase} reload={loadComments}
              canComment={!isOwner || members.length > 0}
            />
          )}
          <div className="panel">
            <h3>À corriger</h3>
            <div className="stack" style={{ gap: 6 }}>
              {checks.filter((c) => c.level === 'err').slice(0, 12).map((c, i) => (
                <Issue key={i} c={c} onGo={() => go(c.key)} />
              ))}
              {!checks.some((c) => c.level === 'err') && <p className="small muted" style={{ margin: 0 }}>Aucune erreur bloquante.</p>}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function saveLabel(s: SaveState) {
  return { idle: 'Enregistrement automatique', saving: 'Enregistrement…', saved: 'Enregistré', error: "Échec de l'enregistrement : vérifie ta connexion" }[s];
}

function matrixStatus(checks: Check[]) {
  const hs = checks.filter((c) => c.key === 'hypotheses' || c.key === 'objectifs_specifiques');
  if (hs.some((c) => c.level === 'err')) return 'err';
  if (hs.some((c) => c.level === 'warn')) return 'warn';
  return hs.length ? 'ok' : '';
}

function Issue({ c, onGo }: { c: Check; onGo?: () => void }) {
  const ico = c.level === 'err' ? 'ERR' : c.level === 'warn' ? 'ATT' : 'OK';
  return (
    <div className={`issue ${c.level}`}>
      <span className="ico">{ico}</span>
      <span>
        {c.msg}{' '}
        {onGo && <button className="linkbtn" onClick={onGo}>{SECTION_BY_KEY[c.key]?.title} →</button>}
      </span>
    </div>
  );
}

// ---------- Matrice de cohérence ----------
function Matrix({ content }: { content: Record<string, string> }) {
  const os = lines(content.objectifs_specifiques), hs = lines(content.hypotheses);
  const n = Math.max(os.length, hs.length);
  return (
    <>
      <div className="kicker">Synthèse</div>
      <h2>Matrice de cohérence</h2>
      <p className="guide">Elle aligne chaque objectif spécifique avec l&apos;hypothèse de même numéro. C&apos;est souvent la première chose que regarde l&apos;encadreur.</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>N°</th><th>Objectif spécifique</th><th>Hypothèse</th><th>État</th></tr></thead>
          <tbody>
            {n === 0 && <tr><td colSpan={4} className="muted">Ajoute tes objectifs spécifiques et tes hypothèses pour remplir la matrice.</td></tr>}
            {Array.from({ length: n }, (_, k) => {
              const o = os[k], h = hs[k];
              let cls = 'ok', label = 'Cohérent';
              if (!o || !h) { cls = 'err'; label = !h ? 'Hypothèse manquante' : 'Objectif manquant'; }
              else if (h.includes('?') || isInfinitive(h)) { cls = 'err'; label = 'Hypothèse mal formulée'; }
              else if (overlap(o, h) < 1) { cls = 'warn'; label = 'Lien à vérifier'; }
              return (
                <tr key={k}>
                  <td>{k + 1}</td>
                  <td style={{ fontFamily: 'var(--f-text)' }}>{o || <em className="muted">Aucun objectif</em>}</td>
                  <td style={{ fontFamily: 'var(--f-text)' }}>{h || <em className="muted">Aucune hypothèse</em>}</td>
                  <td><span className={`pill ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Informations, encadreur et suppression ----------
type SB = ReturnType<typeof createClient>;
function InfosPanel({ project, setProject, isOwner, supabase, members, setMembers, paid, onDeleted }: {
  project: Project; setProject: (p: Project) => void; isOwner: boolean; supabase: SB;
  members: Member[]; setMembers: (m: Member[]) => void; paid: boolean; onDeleted: () => void;
}) {
  const [form, setForm] = useState(project);
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [confirm, setConfirm] = useState('');

  async function saveInfos(e: React.FormEvent) {
    e.preventDefault();
    const patch = {
      title: form.title.trim() || 'Mémoire sans titre', structure_accueil: form.structure_accueil, annee: form.annee,
      encadreur_name: form.encadreur_name, maitre_stage: form.maitre_stage, owner_name: form.owner_name,
    };
    const { error } = await supabase.from('projects').update(patch).eq('id', project.id);
    setMsg(error ? "Les informations n'ont pas été enregistrées. Réessaie." : 'Informations enregistrées.');
    if (!error) setProject({ ...project, ...patch });
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setInviteMsg('Saisis une adresse email valide.');
    const { error } = await supabase.from('project_members').insert({ project_id: project.id, email: clean });
    if (error) return setInviteMsg(/duplicate/i.test(error.message) ? 'Cette personne est déjà invitée.' : "L'invitation n'a pas pu être enregistrée.");
    setMembers([...members, { email: clean, user_id: null, created_at: new Date().toISOString() }]);
    setEmail('');
    setInviteMsg(`Invitation enregistrée. Demande à ton encadreur de se connecter (ou de créer un compte) avec ${clean} sur ${window.location.origin}.`);
  }

  async function remove(m: string) {
    const { error } = await supabase.from('project_members').delete().eq('project_id', project.id).eq('email', m);
    if (!error) setMembers(members.filter((x) => x.email !== m));
  }

  async function del() {
    if (confirm !== 'SUPPRIMER') return;
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (!error) onDeleted();
  }

  const field = (k: keyof Project, label: string, ph = '') => (
    <label htmlFor={`i-${k}`}>{label}
      <input id={`i-${k}`} value={String(form[k] ?? '')} placeholder={ph} readOnly={!isOwner}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="stack">
      <div className="kicker">Projet</div>
      <h2 style={{ margin: 0 }}>Informations du mémoire</h2>
      <p className="guide">Ces informations remplissent la page de garde à l&apos;export.</p>
      <form className="stack" onSubmit={saveInfos}>
        {field('title', 'Titre du mémoire', 'Effet de… sur… en zone de…')}
        {field('owner_name', 'Nom et prénoms de l\'étudiant')}
        {field('structure_accueil', "Structure d'accueil")}
        {field('maitre_stage', 'Maître de stage', 'Nom, titre et fonction')}
        {field('encadreur_name', 'Encadreur pédagogique', 'Nom, grade')}
        {field('annee', 'Année académique', '2026-2027')}
        {isOwner && <button className="btn primary" type="submit" style={{ alignSelf: 'flex-start' }}>Enregistrer</button>}
        {msg && <p className="small muted" style={{ margin: 0 }}>{msg}</p>}
      </form>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
      <h3 style={{ margin: 0 }}>Encadreur</h3>
      {members.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {members.map((m) => (
            <li key={m.email}>
              {m.email} <span className="small muted">{m.user_id ? '· compte actif' : '· pas encore inscrit'}</span>{' '}
              {isOwner && <button className="linkbtn" onClick={() => remove(m.email)}>Retirer</button>}
            </li>
          ))}
        </ul>
      ) : <p className="small muted" style={{ margin: 0 }}>Aucun encadreur invité.</p>}
      {isOwner && (paid ? (
        <form className="row" onSubmit={invite}>
          <label htmlFor="invite-email" style={{ flex: '1 1 240px' }}>Email de l&apos;encadreur
            <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>Inviter</button>
        </form>
      ) : <p className="note" style={{ margin: 0 }}>L&apos;espace encadreur fait partie du Pack mémoire.</p>)}
      {inviteMsg && <p className="small" style={{ margin: 0 }}>{inviteMsg}</p>}

      {isOwner && (
        <>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          <h3 style={{ margin: 0 }}>Supprimer ce mémoire</h3>
          <p className="small muted" style={{ margin: 0 }}>La suppression est définitive. Tape SUPPRIMER pour confirmer.</p>
          <div className="row">
            <input id="confirm-delete" aria-label="Confirmation" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className="btn" disabled={confirm !== 'SUPPRIMER'} onClick={del}>Supprimer définitivement</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Commentaires ----------
function CommentsPanel({ sectionKey, comments, projectId, userId, userName, supabase, reload, canComment }: {
  sectionKey: string; comments: Comment[]; projectId: string; userId: string; userName: string; supabase: SB;
  reload: () => void; canComment: boolean;
}) {
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const { error } = await supabase.from('comments').insert({
      project_id: projectId, section_key: sectionKey, author_id: userId, author_name: userName, body: body.trim(),
    });
    if (error) return setErr("Le commentaire n'a pas été publié. Réessaie.");
    setBody(''); setErr(''); reload();
  }
  async function toggle(c: Comment) {
    await supabase.from('comments').update({ resolved: !c.resolved }).eq('id', c.id);
    reload();
  }
  return (
    <div className="panel">
      <h3>Commentaires de la section</h3>
      <div className="stack" style={{ gap: 10 }}>
        {comments.length === 0 && <p className="small muted" style={{ margin: 0 }}>Aucun commentaire sur cette section.</p>}
        {comments.map((c) => (
          <div key={c.id} className={`comment ${c.resolved ? 'resolved' : ''}`}>
            <div className="who">{c.author_name || 'Utilisateur'} <span className="muted small">· {new Date(c.created_at).toLocaleDateString('fr-FR')}</span></div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
            <button className="linkbtn" onClick={() => toggle(c)}>{c.resolved ? 'Rouvrir' : 'Marquer comme traité'}</button>
          </div>
        ))}
        {canComment ? (
          <form className="stack" style={{ gap: 6 }} onSubmit={add}>
            <label htmlFor="new-comment" hidden>Nouveau commentaire</label>
            <textarea id="new-comment" className="plain" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écrire un commentaire…" />
            <button className="btn small" type="submit" style={{ alignSelf: 'flex-start' }}>Commenter</button>
            {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
          </form>
        ) : <p className="small muted" style={{ margin: 0 }}>Invite ton encadreur pour échanger des commentaires.</p>}
      </div>
    </div>
  );
}

// ---------- Figures ----------
const FIG_RE = /!\[([^\]]*)\]\(figure:([^)]+)\)/g;
function Figures({ projectId, sectionKey, text, isOwner, paid, supabase, textRef, onInsert }: {
  projectId: string; sectionKey: string; text: string; isOwner: boolean; paid: boolean; supabase: SB;
  textRef: React.RefObject<HTMLTextAreaElement>; onInsert: (v: string) => void;
}) {
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const figs = useMemo(() => Array.from(text.matchAll(FIG_RE)).map((m) => ({ caption: m[1], path: m[2] })), [text]);
  const pathsKey = figs.map((f) => f.path).join('|');

  useEffect(() => {
    const missing = figs.map((f) => f.path).filter((p) => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from('figures').createSignedUrls(missing, 3600).then(({ data }) => {
      if (!data) return;
      const next: Record<string, string> = {};
      data.forEach((d) => { if (d.signedUrl && d.path) next[d.path] = d.signedUrl; });
      setUrls((u) => ({ ...u, ...next }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey]);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setErr('Choisis une image PNG ou JPG.');
    if (file.size > 5 * 1024 * 1024) return setErr("L'image dépasse 5 Mo : réduis-la avant de l'ajouter.");
    setBusy(true); setErr('');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${projectId}/${sectionKey}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('figures').upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) return setErr("L'image n'a pas pu être envoyée. Réessaie.");
    const tag = `\n![${caption.trim() || 'Légende de la figure'}](figure:${path})\n`;
    const ta = textRef.current;
    const pos = ta ? ta.selectionStart : text.length;
    onInsert(text.slice(0, pos) + tag + text.slice(pos));
    setCaption('');
  }

  if (!isOwner && !figs.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {isOwner && (paid ? (
        <div className="row">
          <label htmlFor={`cap-${sectionKey}`} style={{ flex: '1 1 220px' }}>Légende de la nouvelle figure
            <input id={`cap-${sectionKey}`} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Évolution de la hauteur des plants" />
          </label>
          <label htmlFor={`file-${sectionKey}`} className="btn" style={{ alignSelf: 'flex-end', flexDirection: 'row' }}>
            {busy ? 'Envoi…' : 'Ajouter une figure'}
            <input id={`file-${sectionKey}`} type="file" accept="image/png,image/jpeg" hidden onChange={upload} disabled={busy} />
          </label>
        </div>
      ) : <p className="small muted" style={{ margin: 0 }}>Les figures font partie du Pack mémoire.</p>)}
      {err && <p className="error">{err}</p>}
      {figs.length > 0 && (
        <div className="figures">
          {figs.map((f) => (
            <figure key={f.path}>
              {urls[f.path] ? <img src={urls[f.path]} alt={f.caption} /> : <div style={{ height: 100 }} />}
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Assistant ----------
function Assistant({ projectId, sectionKey, paid }: { projectId: string; sectionKey: string; paid: boolean }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setAnswer(''); setErr(''); }, [sectionKey]);

  async function ask() {
    setBusy(true); setErr(''); setAnswer('');
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sectionKey }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || "L'assistant n'a pas répondu.");
      else setAnswer(data.answer);
    } catch {
      setErr("L'assistant n'a pas répondu. Vérifie ta connexion.");
    }
    setBusy(false);
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>Assistant de relecture</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        L&apos;assistant relit cette section, explique ce qui ne va pas et propose des pistes. Il ne rédige pas à ta place.
      </p>
      {paid ? (
        <button className="btn" onClick={ask} disabled={busy}>{busy ? 'Relecture en cours…' : 'Demander conseil'}</button>
      ) : <p className="note" style={{ margin: 0 }}>L&apos;assistant fait partie du Pack mémoire.</p>}
      {err && <p className="error">{err}</p>}
      {answer && <div className="ai-answer" style={{ marginTop: 10 }}>{answer}</div>}
    </div>
  );
}
