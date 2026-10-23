import { NextResponse } from 'next/server';
import { getUserAndProfile, hasPlan } from '@/lib/supabase/server';
import { SECTION_BY_KEY, PARCOURS, type Parcours } from '@/lib/plan';
import { runChecks } from '@/lib/checks';

const SYSTEM = `Tu es un encadreur académique bienveillant et exigeant en agronomie. Tu relis une section du mémoire de stage d'un étudiant de Licence.
Règles strictes :
- Tu ne rédiges jamais la section à la place de l'étudiant et tu ne produis jamais de paragraphe prêt à copier.
- Tu peux reformuler au maximum une phrase de l'étudiant, à titre d'exemple, en le disant clairement.
- Tu n'inventes aucune référence bibliographique, aucun chiffre et aucun résultat.
- Tu t'appuies sur le contenu fourni et sur les règles de rédaction scientifique (cohérence objectifs, hypothèses, méthodes, analyses).
Format de réponse, en français simple, 250 mots au maximum :
1. Ce qui est réussi (une ou deux phrases).
2. Les problèmes, du plus important au moins important, chacun avec la raison.
3. Ce que l'étudiant doit faire maintenant, en étapes concrètes.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "L'assistant n'est pas activé sur ce site." }, { status: 503 });

  const { supabase, user, profile } = await getUserAndProfile();
  if (!user) return NextResponse.json({ error: 'Connecte-toi pour utiliser l\'assistant.' }, { status: 401 });
  if (!hasPlan(profile)) return NextResponse.json({ error: "L'assistant fait partie du Pack mémoire." }, { status: 402 });

  let body: { projectId?: string; sectionKey?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const section = body.sectionKey ? SECTION_BY_KEY[body.sectionKey] : undefined;
  if (!body.projectId || !section) return NextResponse.json({ error: 'Section inconnue.' }, { status: 400 });

  const { data: project } = await supabase.from('projects').select('id,owner_id,title,parcours').eq('id', body.projectId).maybeSingle();
  if (!project || project.owner_id !== user.id) return NextResponse.json({ error: 'Mémoire introuvable.' }, { status: 404 });

  const { data: rows } = await supabase.from('sections').select('key,content').eq('project_id', project.id);
  const content: Record<string, string> = {};
  (rows || []).forEach((r: { key: string; content: string }) => { content[r.key] = r.content; });
  const text = (content[section.key] || '').trim();
  if (words(text) < 5) return NextResponse.json({ error: 'Écris d\'abord quelques lignes dans cette section.' }, { status: 400 });

  const limit = Number(process.env.AI_DAILY_LIMIT || 30);
  const { error: quotaError } = await supabase.rpc('use_ai', { daily_limit: limit });
  if (quotaError) return NextResponse.json({ error: `Tu as atteint la limite de ${limit} demandes pour aujourd'hui. Reviens demain.` }, { status: 429 });

  const parcours = project.parcours as Parcours;
  const issues = runChecks(content, parcours).filter((c) => c.key === section.key && c.level !== 'ok').map((c) => `- ${c.msg}`);
  const context = [
    `Parcours : ${PARCOURS[parcours]}`,
    `Titre du mémoire : ${project.title}`,
    `Objectif général : ${content.objectif_general || '(non rédigé)'}`,
    `Objectifs spécifiques :\n${content.objectifs_specifiques || '(non rédigés)'}`,
    `Hypothèses :\n${content.hypotheses || '(non rédigées)'}`,
  ].join('\n');
  const user_msg = `${context}\n\nSection relue : ${section.title}\nConsigne de la section : ${section.guide}\n\nProblèmes déjà détectés automatiquement :\n${issues.join('\n') || '(aucun)'}\n\nTexte de l'étudiant :\n"""\n${text.slice(0, 12000)}\n"""`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 900,
        system: SYSTEM,
        messages: [{ role: 'user', content: user_msg }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "L'assistant est indisponible pour le moment. Réessaie plus tard." }, { status: 502 });
    const data = await res.json();
    const answer = (data.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim();
    return NextResponse.json({ answer: answer || "L'assistant n'a rien répondu. Réessaie." });
  } catch {
    return NextResponse.json({ error: "L'assistant est indisponible pour le moment. Réessaie plus tard." }, { status: 502 });
  }
}

function words(t: string) { return t.split(/\s+/).filter(Boolean).length; }
