-- Stage 2: clients, projects, budgets, milestones, client invites.

create type public.project_status as enum ('active', 'on_hold', 'completed');
create type public.milestone_status as enum ('not_started', 'in_progress', 'done');

-- ---------------------------------------------------------------------------
-- clients: the homeowner record a contractor keeps. user_id is filled once
-- the homeowner accepts their invite and has a login.
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  phone text,
  user_id uuid references auth.users (id) on delete set null,
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create unique index clients_company_email_idx on public.clients (company_id, email);
create index clients_user_id_idx on public.clients (user_id);

create function public.clients_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email = lower(trim(new.email));
  new.name = trim(new.name);
  -- Once a homeowner has logged in, their email is their identity.
  if tg_op = 'UPDATE' then
    if old.user_id is not null and new.email <> old.email then
      raise exception 'This client has already signed in, so their email can''t be changed.';
    end if;
  end if;
  return new;
end;
$$;

create trigger clients_before_write
  before insert or update on public.clients
  for each row execute function public.clients_before_write();

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  location text not null default '',
  start_date date,
  expected_completion_date date,
  status public.project_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index projects_company_id_idx on public.projects (company_id);
create index projects_client_id_idx on public.projects (client_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Budget is its own table so it can be hidden from homeowners.
-- (RLS works per row, so a hidden column on projects would not be possible.)
create table public.project_budgets (
  project_id uuid primary key references public.projects (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  visible_to_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create trigger project_budgets_set_updated_at
  before update on public.project_budgets
  for each row execute function public.set_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  position integer not null default 0,
  status public.milestone_status not null default 'not_started',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index milestones_project_id_idx on public.milestones (project_id, position);

create trigger milestones_set_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer, so policies avoid RLS recursion)
-- ---------------------------------------------------------------------------
create function public.is_company_client(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.clients
    where company_id = p_company_id and user_id = auth.uid()
  );
$$;

create function public.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members m on m.company_id = p.company_id
    where p.id = p_project_id and m.user_id = auth.uid()
  );
$$;

create function public.is_project_owner(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members m on m.company_id = p.company_id
    where p.id = p_project_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create function public.is_project_client(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = p_project_id and c.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_budgets enable row level security;
alter table public.milestones enable row level security;

-- Homeowners can see the name of the company they are a client of.
create policy "companies: clients read"
  on public.companies for select to authenticated
  using (public.is_company_client(id));

create policy "clients: company members read, client reads self"
  on public.clients for select to authenticated
  using (public.is_company_member(company_id) or user_id = auth.uid());

create policy "clients: owner updates"
  on public.clients for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy "projects: members and own client read"
  on public.projects for select to authenticated
  using (public.is_company_member(company_id) or public.is_project_client(id));

create policy "projects: owner updates"
  on public.projects for update to authenticated
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

create policy "budgets: members read, client reads if shared"
  on public.project_budgets for select to authenticated
  using (
    public.is_project_member(project_id)
    or (visible_to_client and public.is_project_client(project_id))
  );

create policy "budgets: owner writes"
  on public.project_budgets for all to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "milestones: members and own client read"
  on public.milestones for select to authenticated
  using (public.is_project_member(project_id) or public.is_project_client(project_id));

create policy "milestones: owner writes"
  on public.milestones for all to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Creating a project: client + project + budget + milestones in one step.
-- ---------------------------------------------------------------------------
create function public.create_project(
  p_name text,
  p_location text,
  p_start_date date,
  p_expected_completion_date date,
  p_budget bigint,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_milestones text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_client uuid;
  v_project uuid;
begin
  select company_id into v_company
  from public.company_members
  where user_id = v_user and role = 'owner'
  limit 1;

  if v_company is null then
    raise exception 'Only the company owner can create projects.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Please enter a project name.';
  end if;
  if p_client_name is null or char_length(trim(p_client_name)) = 0 then
    raise exception 'Please enter the client''s name.';
  end if;
  if p_client_email is null or position('@' in p_client_email) < 2 then
    raise exception 'Please enter a valid client email.';
  end if;
  if coalesce(array_length(p_milestones, 1), 0) > 20 then
    raise exception 'Please keep milestones to 20 or fewer.';
  end if;

  -- One client record per email per company; reuse it for repeat clients.
  select id into v_client
  from public.clients
  where company_id = v_company and email = lower(trim(p_client_email));

  if v_client is null then
    insert into public.clients (company_id, name, email, phone)
    values (v_company, p_client_name, p_client_email, nullif(trim(p_client_phone), ''))
    returning id into v_client;
  end if;

  insert into public.projects (
    company_id, client_id, name, location, start_date, expected_completion_date
  )
  values (
    v_company, v_client, trim(p_name), coalesce(trim(p_location), ''),
    p_start_date, p_expected_completion_date
  )
  returning id into v_project;

  if p_budget is not null then
    insert into public.project_budgets (project_id, amount) values (v_project, p_budget);
  end if;

  insert into public.milestones (project_id, name, position)
  select v_project, trim(m.name), (row_number() over (order by m.ord))::int
  from unnest(coalesce(p_milestones, '{}'::text[])) with ordinality as m(name, ord)
  where char_length(trim(m.name)) > 0;

  return v_project;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invites. The token is a private link; whoever holds it can claim the client
-- record, but only with a login on the invited email address.
-- ---------------------------------------------------------------------------

-- Owner fetches a client's invite token to build the link.
create function public.get_client_invite_token(p_client_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  select c.invite_token into v_token
  from public.clients c
  where c.id = p_client_id and public.is_company_owner(c.company_id);

  if v_token is null then
    raise exception 'You don''t have access to this client.';
  end if;
  return v_token;
end;
$$;

-- Public: what the invite page shows before the homeowner signs up.
create function public.get_invite(p_token uuid)
returns table (client_name text, email text, company_name text, accepted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.email, co.name, c.user_id is not null
  from public.clients c
  join public.companies co on co.id = c.company_id
  where c.invite_token = p_token;
$$;

-- Signed-in homeowner claims their client record.
create function public.accept_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_updated int;
begin
  if v_user is null then
    raise exception 'Please sign in to accept this invite.';
  end if;

  update public.clients
  set user_id = v_user
  where invite_token = p_token
    and email = v_email
    and (user_id is null or user_id = v_user);

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'This invite link isn''t valid for your account.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.clients, public.projects, public.project_budgets, public.milestones
  from anon, authenticated;

-- invite_token is deliberately not selectable; owners get it via get_client_invite_token().
grant select (id, company_id, name, email, phone, user_id, created_at, updated_at, created_by)
  on public.clients to authenticated;
grant update (name, email, phone) on public.clients to authenticated;

grant select on public.projects to authenticated;
grant update (name, location, start_date, expected_completion_date, status)
  on public.projects to authenticated;

grant select, insert, update, delete on public.project_budgets to authenticated;
grant select, insert, update, delete on public.milestones to authenticated;

revoke execute on function
  public.is_company_client(uuid),
  public.is_project_member(uuid),
  public.is_project_owner(uuid),
  public.is_project_client(uuid),
  public.create_project(text, text, date, date, bigint, text, text, text, text[]),
  public.get_client_invite_token(uuid),
  public.get_invite(uuid),
  public.accept_invite(uuid)
from public, anon;

grant execute on function
  public.is_company_client(uuid),
  public.is_project_member(uuid),
  public.is_project_owner(uuid),
  public.is_project_client(uuid),
  public.create_project(text, text, date, date, bigint, text, text, text, text[]),
  public.get_client_invite_token(uuid),
  public.accept_invite(uuid)
to authenticated;

-- The invite page runs before the homeowner has an account.
grant execute on function public.get_invite(uuid) to anon, authenticated;
