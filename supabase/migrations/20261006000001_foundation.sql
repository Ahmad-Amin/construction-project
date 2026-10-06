-- Stage 1: auth + company + role foundation.
-- Every table is private by default: RLS is on and access is granted only through policies.

create type public.member_role as enum ('owner', 'staff');

-- Keeps updated_at honest on every table that has it.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (contractors, staff and homeowners alike)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- companies + members
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  logo_url text,
  owner_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_id_idx on public.company_members (user_id);

-- ---------------------------------------------------------------------------
-- Authorization helpers.
-- security definer so policies can ask "is this user a member?" without
-- recursing into the RLS of company_members itself.
-- ---------------------------------------------------------------------------
create function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid()
  );
$$;

create function public.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- True when both users belong to at least one common company.
-- Lets staff see each other's names (update authorship) and nothing more.
create function public.shares_company_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members mine
    join public.company_members theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Onboarding: a signed-in user creates their company and becomes its owner.
-- Done in one function so a company can never exist without an owner member.
-- ---------------------------------------------------------------------------
create function public.create_company(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
begin
  if v_user is null then
    raise exception 'You need to be signed in to create a company.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Please enter your company name.';
  end if;

  insert into public.companies (name, owner_id, created_by)
  values (trim(p_name), v_user, v_user)
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role)
  values (v_company, v_user, 'owner');

  return v_company;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

create policy "profiles: read own or colleague"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_company_with(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "companies: members read"
  on public.companies for select to authenticated
  using (public.is_company_member(id));

create policy "companies: owner updates"
  on public.companies for update to authenticated
  using (public.is_company_owner(id))
  with check (public.is_company_owner(id));

create policy "company_members: members read"
  on public.company_members for select to authenticated
  using (public.is_company_member(company_id));

-- No insert/update/delete policies on companies or company_members:
-- changes go through create_company() (and later, owner-only functions).

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon, minimum for signed-in users.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.companies, public.company_members from anon, authenticated;
grant select on public.profiles, public.companies, public.company_members to authenticated;
grant update (name) on public.profiles to authenticated;
grant update (name, logo_url) on public.companies to authenticated;

revoke execute on function
  public.create_company(text),
  public.is_company_member(uuid),
  public.is_company_owner(uuid),
  public.shares_company_with(uuid)
from public, anon;
grant execute on function
  public.create_company(text),
  public.is_company_member(uuid),
  public.is_company_owner(uuid),
  public.shares_company_with(uuid)
to authenticated;
