-- =====================================================================
-- Sillon : schéma de la base de données (Supabase / PostgreSQL)
-- À coller en une seule fois dans Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profils ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'etudiant' check (role in ('etudiant', 'encadreur', 'admin')),
  plan_until timestamptz,
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  -- rattache les invitations faites avant l'inscription
  update public.project_members set user_id = new.id where email = lower(new.email) and user_id is null;
  return new;
end $$;

-- ---------- Projets (un mémoire = un projet) ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Mémoire sans titre',
  parcours text not null check (parcours in ('phyto', 'zoo', 'agroeco')),
  structure_accueil text not null default '',
  annee text not null default '',
  status text not null default 'brouillon' check (status in ('brouillon', 'soumis', 'valide')),
  owner_name text not null default '',
  encadreur_name text not null default '',
  maitre_stage text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sections (
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (project_id, key)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  role text not null default 'encadreur' check (role in ('encadreur')),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  section_key text not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists members_email_idx on public.project_members (email);
create index if not exists comments_project_idx on public.comments (project_id, section_key);

-- ---------- Fonctions d'accès ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.has_plan()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (plan_until > now() or role = 'admin'));
$$;

create or replace function public.is_owner(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = p and owner_id = auth.uid());
$$;

create or replace function public.can_access(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner(p)
      or exists (
        select 1 from public.project_members m
        where m.project_id = p and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
$$;

create or replace function public.project_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.projects where owner_id = auth.uid();
$$;

-- Empêche un utilisateur de modifier lui-même son rôle ou son offre
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() est vide quand la commande vient de l'éditeur SQL de Supabase : autorisé
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.plan_until := old.plan_until;
    new.email := old.email;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- Le statut ne change que par set_project_status (jamais par une mise à jour directe)
create or replace function public.protect_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('sillon.status_change', true), '') <> 'on' then
    new.status := old.status;
  end if;
  new.owner_id := old.owner_id;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_project on public.projects;
create trigger protect_project before update on public.projects
  for each row execute function public.protect_project();

-- L'encadreur change le statut (validé) ; l'étudiant soumet
create or replace function public.set_project_status(p uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_status not in ('brouillon', 'soumis', 'valide') then
    raise exception 'Statut inconnu';
  end if;
  perform set_config('sillon.status_change', 'on', true);
  if public.is_owner(p) and new_status in ('brouillon', 'soumis') then
    update public.projects set status = new_status, updated_at = now() where id = p;
  elsif public.can_access(p) and not public.is_owner(p) then
    update public.projects set status = new_status, updated_at = now() where id = p;
  else
    raise exception 'Action non autorisée';
  end if;
end $$;

-- Activation manuelle de l'offre payante par un administrateur
create or replace function public.activate_plan(target_email text, months int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare result timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs';
  end if;
  update public.profiles
     set plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => months)
   where email = lower(trim(target_email))
   returning plan_until into result;
  if result is null then
    raise exception 'Aucun compte avec cet email';
  end if;
  return result;
end $$;

-- Compteur quotidien de l'assistant IA (renvoie le nouveau total)
create or replace function public.use_ai(daily_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  if n > daily_limit then
    raise exception 'Limite quotidienne atteinte';
  end if;
  return n;
end $$;

-- ---------- Sécurité ligne par ligne (RLS) ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sections enable row level security;
alter table public.project_members enable row level security;
alter table public.comments enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "profil lisible" on public.profiles;
create policy "profil lisible" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profil modifiable" on public.profiles;
create policy "profil modifiable" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "projet lisible" on public.projects;
create policy "projet lisible" on public.projects for select using (public.can_access(id));
drop policy if exists "projet créé" on public.projects;
create policy "projet créé" on public.projects for insert with check (
  owner_id = auth.uid() and (public.project_count() < 1 or public.has_plan())
);
drop policy if exists "projet modifié" on public.projects;
create policy "projet modifié" on public.projects for update using (owner_id = auth.uid());
drop policy if exists "projet supprimé" on public.projects;
create policy "projet supprimé" on public.projects for delete using (owner_id = auth.uid());

drop policy if exists "section lisible" on public.sections;
create policy "section lisible" on public.sections for select using (public.can_access(project_id));
drop policy if exists "section créée" on public.sections;
create policy "section créée" on public.sections for insert with check (public.is_owner(project_id));
drop policy if exists "section modifiée" on public.sections;
create policy "section modifiée" on public.sections for update using (public.is_owner(project_id));

drop policy if exists "membre lisible" on public.project_members;
create policy "membre lisible" on public.project_members for select using (
  public.can_access(project_id)
);
drop policy if exists "membre ajouté" on public.project_members;
create policy "membre ajouté" on public.project_members for insert with check (public.is_owner(project_id));
drop policy if exists "membre retiré" on public.project_members;
create policy "membre retiré" on public.project_members for delete using (public.is_owner(project_id));

drop policy if exists "commentaire lisible" on public.comments;
create policy "commentaire lisible" on public.comments for select using (public.can_access(project_id));
drop policy if exists "commentaire créé" on public.comments;
create policy "commentaire créé" on public.comments for insert with check (
  public.can_access(project_id) and author_id = auth.uid()
);
drop policy if exists "commentaire résolu" on public.comments;
create policy "commentaire résolu" on public.comments for update using (public.can_access(project_id));
drop policy if exists "commentaire supprimé" on public.comments;
create policy "commentaire supprimé" on public.comments for delete using (author_id = auth.uid());

drop policy if exists "usage lisible" on public.ai_usage;
create policy "usage lisible" on public.ai_usage for select using (user_id = auth.uid());

-- ---------- Stockage des figures ----------
insert into storage.buckets (id, name, public) values ('figures', 'figures', false)
on conflict (id) do nothing;

drop policy if exists "figure lisible" on storage.objects;
create policy "figure lisible" on storage.objects for select using (
  bucket_id = 'figures' and public.can_access(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "figure ajoutée" on storage.objects;
create policy "figure ajoutée" on storage.objects for insert with check (
  bucket_id = 'figures' and public.is_owner(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "figure supprimée" on storage.objects;
create policy "figure supprimée" on storage.objects for delete using (
  bucket_id = 'figures' and public.is_owner(((storage.foldername(name))[1])::uuid)
);

-- =====================================================================
-- Pour te donner les droits d'administrateur, après ta propre inscription :
--   update public.profiles set role = 'admin' where email = 'ton.email@exemple.com';
-- =====================================================================
