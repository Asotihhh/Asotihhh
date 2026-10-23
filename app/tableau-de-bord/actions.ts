'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getUserAndProfile, hasPlan } from '@/lib/supabase/server';
import type { Parcours } from '@/lib/plan';

export async function createProject(formData: FormData) {
  const { supabase, user, profile } = await getUserAndProfile();
  if (!user) redirect('/connexion');

  const parcours = String(formData.get('parcours')) as Parcours;
  if (!['phyto', 'zoo', 'agroeco'].includes(parcours)) redirect('/tableau-de-bord?erreur=parcours');

  const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
  if ((count ?? 0) >= 1 && !hasPlan(profile)) redirect('/tableau-de-bord?erreur=limite');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      owner_id: user.id,
      owner_name: profile?.full_name || user.email || '',
      title: String(formData.get('title') || '').trim() || 'Mémoire sans titre',
      parcours,
      structure_accueil: String(formData.get('structure_accueil') || '').trim(),
      annee: String(formData.get('annee') || '').trim(),
    })
    .select('id')
    .single();
  if (error || !data) redirect('/tableau-de-bord?erreur=creation');
  revalidatePath('/tableau-de-bord');
  redirect(`/projet/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  const { supabase, user } = await getUserAndProfile();
  if (!user) redirect('/connexion');
  const id = String(formData.get('id'));
  if (String(formData.get('confirm')) !== 'SUPPRIMER') redirect('/tableau-de-bord?erreur=confirmation');
  await supabase.from('projects').delete().eq('id', id).eq('owner_id', user.id);
  revalidatePath('/tableau-de-bord');
  redirect('/tableau-de-bord');
}
