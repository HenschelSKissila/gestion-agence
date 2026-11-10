create extension if not exists pgcrypto;
create table if not exists public.parametres(id integer primary key default 1 check(id=1), pct_refus numeric not null default 33.333333, sparkasse numeric not null default 0, commerzbank numeric not null default 0, n26 numeric not null default 0, wise numeric not null default 0, updated_at timestamptz not null default now());
create table if not exists public.comptes(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, nom text not null, prenom text default '', date_depot date, statut text not null default 'en_cours' check(statut in ('en_cours','visa','refus')), montant_client numeric not null default 0 check(montant_client>=0), montant_bloque numeric not null default 0 check(montant_bloque>=0), retire numeric not null default 0 check(retire>=0), demarcheur text default '', commission numeric not null default 0 check(commission>=0), montant_rembourse numeric not null default 0 check(montant_rembourse>=0), notes text default '', unique(user_id,nom,prenom,date_depot));
create table if not exists public.candidats(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, nom text not null, prenom text default '', telephone text default '', date_prevue date, montant_prevu numeric not null default 0, statut text not null default 'attente' check(statut in ('attente','prochain','visa','refus')), notes text default '', unique(user_id,nom,prenom,date_prevue));
create table if not exists public.dettes(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, nom text not null, date_op date, montant numeric not null default 0, rembourse numeric not null default 0, notes text default '', unique(user_id,nom,date_op,montant));
create table if not exists public.perso(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, nom text not null, date_op date, montant numeric not null default 0, rembourse numeric not null default 0, notes text default '', unique(user_id,nom,date_op,montant));
alter table public.comptes enable row level security; alter table public.candidats enable row level security; alter table public.dettes enable row level security; alter table public.perso enable row level security;
do $$ declare t text; begin foreach t in array array['comptes','candidats','dettes','perso'] loop execute format('drop policy if exists %I_owner on public.%I',t,t); execute format('create policy %I_owner on public.%I for all using (auth.uid()=user_id) with check (auth.uid()=user_id)',t,t); end loop; end $$;
-- v4: soldes bancaires explicites (rétrocompatible avec les installations v3)
alter table public.parametres add column if not exists n26 numeric not null default 0;
alter table public.parametres add column if not exists sparkasse numeric not null default 0;
alter table public.parametres add column if not exists commerzbank numeric not null default 0;
alter table public.parametres add column if not exists wise numeric not null default 0;

-- v4.4: frais Expatrio par compte bloqué avec visa (migration idempotente)
alter table public.parametres add column if not exists fraisBancairesCompteBloqueVisa numeric not null default 127;

-- v4.7: paramètres synchronisés par compte (une ligne JSON par utilisateur).
-- Remplace la table parametres : tous les réglages (banques, associés, taux, nom, logo)
-- suivent désormais le compte de connexion sur tous ses appareils.
create table if not exists public.parametres_utilisateur(user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.parametres_utilisateur enable row level security;
drop policy if exists parametres_utilisateur_owner on public.parametres_utilisateur;
create policy parametres_utilisateur_owner on public.parametres_utilisateur for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update,delete on public.parametres_utilisateur to authenticated;
-- L'ancienne table n'est plus utilisée par l'application et n'avait aucune règle d'accès : on la verrouille.
alter table public.parametres enable row level security;
