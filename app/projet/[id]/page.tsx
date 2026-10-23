import { notFound, redirect } from 'next/navigation';
import { getUserAndProfile, hasPlan } from '@/lib/supabase/server';
import Editor, { type Project, type Member } from '@/components/Editor';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getUserAndProfile();
  if (!user) redirect('/connexion');

  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const [{ data: sections }, { data: members }] = await Promise.all([
    supabase.from('sections').select('key,content').eq('project_id', params.id),
    supabase.from('project_members').select('email,user_id,created_at').eq('project_id', params.id),
  ]);

  const content: Record<string, string> = {};
  (sections || []).forEach((s: { key: string; content: string }) => { content[s.key] = s.content; });

  const isOwner = project.owner_id === user.id;
  return (
    <Editor
      project={project as Project}
      initialContent={content}
      members={(members || []) as Member[]}
      isOwner={isOwner}
      paid={hasPlan(profile)}
      userId={user.id}
      userName={profile?.full_name || user.email || ''}
      aiEnabled={!!process.env.ANTHROPIC_API_KEY}
    />
  );
}
