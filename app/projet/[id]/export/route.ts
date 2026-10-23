import { NextResponse } from 'next/server';
import { getUserAndProfile, hasPlan } from '@/lib/supabase/server';
import { buildDocx, imageSize, type Figure } from '@/lib/docx';

export const runtime = 'nodejs';

const FIG_RE = /!\[[^\]]*\]\(figure:([^)]+)\)/g;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getUserAndProfile();
  if (!user) return NextResponse.redirect(new URL('/connexion', request.url));

  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) return new NextResponse('Mémoire introuvable.', { status: 404 });
  const isOwner = project.owner_id === user.id;
  if (isOwner && !hasPlan(profile)) {
    return NextResponse.redirect(new URL('/tableau-de-bord?erreur=limite', request.url));
  }

  const { data: rows } = await supabase.from('sections').select('key,content').eq('project_id', project.id);
  const content: Record<string, string> = {};
  (rows || []).forEach((r: { key: string; content: string }) => { content[r.key] = r.content; });

  // Figures : téléchargées depuis le stockage (droits vérifiés par Supabase)
  const paths = new Set<string>();
  Object.values(content).forEach((t) => { for (const m of t.matchAll(FIG_RE)) paths.add(m[1]); });
  const figures: Record<string, Figure> = {};
  await Promise.all(Array.from(paths).map(async (path) => {
    const { data } = await supabase.storage.from('figures').download(path);
    if (!data) return;
    const buf = Buffer.from(await data.arrayBuffer());
    const size = imageSize(buf);
    if (size) figures[path] = { data: buf, ...size };
  }));

  const buffer = await buildDocx(project, content, figures);
  const slug = String(project.title).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60).replace(/^-|-$/g, '').toLowerCase() || 'memoire';
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="memoire-${slug}.docx"`,
      'Cache-Control': 'no-store',
    },
  });
}
