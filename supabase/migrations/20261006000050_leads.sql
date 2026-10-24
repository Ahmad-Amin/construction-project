-- Leads: the enquiries a contractor is working on before they become projects. Everything is enforced here:
--
--   * every company has its own stages (New, Contacted, Site visit and Quote sent to start with). The owner can add,
--     rename, reorder and remove them. Won and Lost aren't stages: they are how a lead ends, and Lost needs a reason.
--   * the owner sees and changes every lead. Staff see them only when the owner switches on "Can see leads", and not
--     while paused; view-only staff can look but not change. Homeowners never see leads. Only the owner deletes one.
--   * Free includes 10 open leads; Pro and Business have no limit. A company over the limit (a plan that ran out)
--     keeps its leads and simply can't open more.
--   * a lead can become a project in one step (create_project_from_lead): it is marked won and linked to the project.
--   * each open lead can have a follow-up date. The daily job reminds the person who set it (or the owner, if that
--     person can no longer see leads): in the app, by email, and on WhatsApp on the paid plans. Once per person per day,
--     on the morning of the day, or the evening before where the job runs in the afternoon or evening.
--
-- Staff invitations and settings gain the new permission; the old calls keep working (the new argument has a default).

-- ===========================================================================
-- 1. What each plan allows
-- ===========================================================================
-- How many leads may be open at once on a plan; null means no limit.
create function public.plan_open_lead_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_plan in ('pro', 'business') then null else 10 end;
$$;

-- ===========================================================================
-- 2. Who can see leads
-- ===========================================================================
alter table public.company_members add column can_see_leads boolean not null default false;
alter table public.staff_invites add column can_see_leads boolean not null default false;
grant select (can_see_leads) on public.staff_invites to authenticated;

-- The owner, or staff the owner allowed who aren't paused.
create function public.can_see_leads(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.user_id = auth.uid()
      and (m.role = 'owner' or (m.can_see_leads and not m.paused))
  );
$$;

-- The same people, except view-only staff.
create function public.can_change_leads(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company and m.user_id = auth.uid()
      and (m.role = 'owner' or (m.can_see_leads and not m.paused and not m.view_only))
  );
$$;

-- The company this owner runs, or an error (for the stage settings).
create function public.lead_owner_company()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_company uuid;
begin
  select m.company_id into v_company
  from public.company_members m
  where m.user_id = auth.uid() and m.role = 'owner'
  limit 1;
  if v_company is null then
    raise exception 'Only the company owner can change the lead stages.' using errcode = 'P0001';
  end if;
  return v_company;
end;
$$;

-- Who a follow-up belongs to: the person who set it, while they can still see the company's leads; otherwise (removed,
-- paused, or no longer allowed) the company owner, so no follow-up is ever silently dropped.
create function public.lead_follow_up_owner(p_company uuid, p_user uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.user_id from public.company_members m
     where m.company_id = p_company and m.user_id = p_user
       and (m.role = 'owner' or (m.can_see_leads and not m.paused))),
    (select m.user_id from public.company_members m
     where m.company_id = p_company and m.role = 'owner'
     order by m.created_at
     limit 1)
  );
$$;

-- ===========================================================================
-- 3. Stages, leads and what happened to each
-- ===========================================================================
create table public.lead_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40 and name = trim(name)),
  position integer not null,
  created_at timestamptz not null default now()
);
create unique index lead_stages_name_unique on public.lead_stages (company_id, lower(name));
create index lead_stages_company_idx on public.lead_stages (company_id, position);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- No "on delete" rule on purpose: a stage with leads can't be removed until they move (remove_lead_stage moves them),
  -- and deleting a whole company still works because the check waits for the end of the statement.
  stage_id uuid not null references public.lead_stages (id),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  name text not null check (char_length(name) between 1 and 120),
  -- International format, like +923001234567 (the app converts what people type).
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  location text not null default '' check (char_length(location) <= 200),
  -- The project templates (src/lib/templates.ts), so a won lead starts its project with the right stages.
  work_type text not null default '' check (work_type in ('', 'new-house', 'extra-floor', 'renovation', 'fit-out', 'other')),
  -- Free text: "10 marla", "2,500 sq ft".
  size text not null default '' check (char_length(size) <= 60),
  budget bigint check (budget is null or budget between 0 and 1000000000000000),
  source text not null default '' check (source in ('', 'referral', 'facebook', 'instagram', 'google', 'website', 'site-board', 'walk-in', 'other')),
  notes text not null default '' check (char_length(notes) <= 2000),
  follow_up_on date,
  follow_up_note text not null default '' check (char_length(follow_up_note) <= 200),
  -- Set by the database: whoever set the follow-up.
  follow_up_by uuid references auth.users (id) on delete set null,
  lost_reason text check (lost_reason is null or lost_reason in ('price', 'another-contractor', 'timing', 'no-reply', 'other')),
  -- Set only by create_project_from_lead.
  project_id uuid references public.projects (id) on delete set null,
  closed_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_lost_needs_reason check ((status = 'lost') = (lost_reason is not null)),
  constraint leads_closed_at check ((status = 'open') = (closed_at is null)),
  constraint leads_follow_up_only_when_open check (status = 'open' or follow_up_on is null)
);
create index leads_company_idx on public.leads (company_id, status, updated_at desc);
create index leads_stage_idx on public.leads (stage_id);
create index leads_follow_up_idx on public.leads (company_id, follow_up_on) where status = 'open' and follow_up_on is not null;

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- created, a note, moved to a stage (body: its name), won, lost (body: the reason), reopened, project (body: its name)
  kind text not null check (kind in ('created', 'note', 'stage', 'won', 'lost', 'reopened', 'project')),
  body text not null default '' check (char_length(body) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);

-- Every company starts with the same four stages; companies that already exist get them too.
create function public.companies_seed_lead_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_stages (company_id, name, position)
  values (new.id, 'New', 1), (new.id, 'Contacted', 2), (new.id, 'Site visit', 3), (new.id, 'Quote sent', 4);
  return null;
end;
$$;

create trigger companies_seed_lead_stages
  after insert on public.companies
  for each row execute function public.companies_seed_lead_stages();

insert into public.lead_stages (company_id, name, position)
select co.id, s.name, s.position
from public.companies co
cross join (values ('New', 1), ('Contacted', 2), ('Site visit', 3), ('Quote sent', 4)) as s (name, position);

-- ---------------------------------------------------------------------------
-- The rules every change to a lead follows, however it is made
-- ---------------------------------------------------------------------------
create function public.leads_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.company_id <> old.company_id or new.created_by is distinct from old.created_by or new.created_at <> old.created_at) then
    raise exception 'A lead can''t be moved to another company.' using errcode = 'P0001';
  end if;

  -- The stage must be one of the company's own.
  if (tg_op = 'INSERT' or new.stage_id <> old.stage_id)
     and not exists (select 1 from public.lead_stages s where s.id = new.stage_id and s.company_id = new.company_id) then
    raise exception 'That stage isn''t one of your company''s.' using errcode = 'P0001';
  end if;

  new.name := trim(new.name);
  if char_length(new.name) = 0 then
    raise exception 'Please enter the lead''s name.' using errcode = 'P0001';
  end if;
  new.location := trim(new.location);
  new.size := trim(new.size);
  new.notes := trim(new.notes);
  new.follow_up_note := trim(new.follow_up_note);
  new.email := nullif(lower(trim(new.email)), '');

  -- How a lead ends: won, or lost with a reason. Reopening clears both. A closed lead has nothing to follow up.
  if new.status = 'open' then
    new.closed_at := null;
    new.lost_reason := null;
  else
    if tg_op = 'INSERT' or old.status <> new.status then
      new.closed_at := now();
    end if;
    if new.status = 'won' then
      new.lost_reason := null;
    elsif new.lost_reason is null then
      raise exception 'Please choose why the lead was lost.' using errcode = 'P0001';
    end if;
    new.follow_up_on := null;
  end if;

  -- The follow-up belongs to whoever set it last.
  if new.follow_up_on is null then
    new.follow_up_by := null;
    new.follow_up_note := '';
  elsif tg_op = 'INSERT' or new.follow_up_on is distinct from old.follow_up_on or new.follow_up_note is distinct from old.follow_up_note then
    new.follow_up_by := coalesce(auth.uid(), new.follow_up_by);
  end if;

  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id)
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.company_id = new.company_id) then
    raise exception 'That project isn''t part of your company.' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger leads_before_write
  before insert or update on public.leads
  for each row execute function public.leads_before_write();

-- A lead can only be open (new, or reopened) while the company is under its plan's limit. The lock makes two leads added
-- at the same moment count correctly.
create function public.leads_enforce_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'open' or (tg_op = 'UPDATE' and old.status = 'open') then
    return new;
  end if;

  select public.effective_plan(co.plan, co.plan_until) into v_plan from public.companies co where co.id = new.company_id;
  v_limit := public.plan_open_lead_limit(coalesce(v_plan, 'free'));
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 2));
  select count(*) into v_count from public.leads l where l.company_id = new.company_id and l.status = 'open' and l.id <> new.id;
  if v_count >= v_limit then
    raise exception 'Your % plan includes % open leads. Mark a lead won or lost, or upgrade for unlimited leads.',
      initcap(coalesce(v_plan, 'free')), v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger leads_enforce_plan_limit
  before insert or update of status on public.leads
  for each row execute function public.leads_enforce_plan_limit();

-- The lead's history: created, moved, won, lost, reopened, turned into a project. Notes are added by add_lead_note().
create function public.leads_log_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, company_id, kind, created_by) values (new.id, new.company_id, 'created', auth.uid());
    return null;
  end if;

  if new.status <> old.status then
    insert into public.lead_events (lead_id, company_id, kind, body, created_by)
    values (new.id, new.company_id,
            case new.status when 'won' then 'won' when 'lost' then 'lost' else 'reopened' end,
            case when new.status = 'lost' then new.lost_reason else '' end,
            auth.uid());
  elsif new.stage_id <> old.stage_id and new.status = 'open' then
    insert into public.lead_events (lead_id, company_id, kind, body, created_by)
    select new.id, new.company_id, 'stage', s.name, auth.uid() from public.lead_stages s where s.id = new.stage_id;
  end if;

  if new.project_id is not null and new.project_id is distinct from old.project_id then
    insert into public.lead_events (lead_id, company_id, kind, body, created_by)
    select new.id, new.company_id, 'project', p.name, auth.uid() from public.projects p where p.id = new.project_id;
  end if;
  return null;
end;
$$;

create trigger leads_log_event
  after insert or update on public.leads
  for each row execute function public.leads_log_event();

-- ---------------------------------------------------------------------------
-- Who may read and write what
-- ---------------------------------------------------------------------------
alter table public.lead_stages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;

revoke all on public.lead_stages, public.leads, public.lead_events from anon, authenticated;
grant select on public.lead_stages, public.leads, public.lead_events to authenticated;
-- The database sets the rest (who set the follow-up, when it closed, the project link, the dates).
grant insert (company_id, stage_id, status, lost_reason, name, phone, email, location, work_type, size, budget, source, notes,
              follow_up_on, follow_up_note)
  on public.leads to authenticated;
grant update (stage_id, status, lost_reason, name, phone, email, location, work_type, size, budget, source, notes,
              follow_up_on, follow_up_note)
  on public.leads to authenticated;
grant delete on public.leads to authenticated;

create policy "lead stages: people who can see leads read"
  on public.lead_stages for select to authenticated
  using (public.can_see_leads(company_id));

create policy "leads: people who can see leads read"
  on public.leads for select to authenticated
  using (public.can_see_leads(company_id));

create policy "leads: people who can change leads add"
  on public.leads for insert to authenticated
  with check (public.can_change_leads(company_id));

create policy "leads: people who can change leads change"
  on public.leads for update to authenticated
  using (public.can_change_leads(company_id))
  with check (public.can_change_leads(company_id));

create policy "leads: the owner deletes"
  on public.leads for delete to authenticated
  using (public.is_company_owner(company_id));

create policy "lead events: people who can see leads read"
  on public.lead_events for select to authenticated
  using (public.can_see_leads(company_id));

-- ===========================================================================
-- 4. Changing the stages (the owner)
-- ===========================================================================
create function public.check_lead_stage_name(p_company uuid, p_name text, p_except uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
begin
  if char_length(v_name) = 0 or char_length(v_name) > 40 then
    raise exception 'Please give the stage a name of up to 40 characters.' using errcode = 'P0001';
  end if;
  if lower(v_name) in ('won', 'lost') then
    raise exception 'Won and Lost are always there: they are how a lead ends. Please choose another name.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.lead_stages s
    where s.company_id = p_company and lower(s.name) = lower(v_name) and s.id is distinct from p_except
  ) then
    raise exception 'There is already a stage called %.', v_name using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;

create function public.add_lead_stage(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
  v_name text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 3));
  v_name := public.check_lead_stage_name(v_company, p_name, null);
  if (select count(*) from public.lead_stages s where s.company_id = v_company) >= 12 then
    raise exception 'You can have up to 12 stages.' using errcode = 'P0001';
  end if;
  insert into public.lead_stages (company_id, name, position)
  values (v_company, v_name, coalesce((select max(s.position) from public.lead_stages s where s.company_id = v_company), 0) + 1)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.rename_lead_stage(p_stage uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
  v_name text;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 3));
  if not exists (select 1 from public.lead_stages s where s.id = p_stage and s.company_id = v_company) then
    raise exception 'That stage isn''t one of your company''s.' using errcode = 'P0001';
  end if;
  v_name := public.check_lead_stage_name(v_company, p_name, p_stage);
  update public.lead_stages set name = v_name where id = p_stage;
end;
$$;

-- The stages in their new order: every one of the company's stages, each once.
create function public.set_lead_stage_order(p_stages uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
begin
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 3));
  if coalesce(cardinality(p_stages), 0) <> (select count(*) from public.lead_stages s where s.company_id = v_company)
     or (select count(distinct x) from unnest(p_stages) as x) <> cardinality(p_stages)
     or exists (
       select 1 from unnest(p_stages) as x
       where not exists (select 1 from public.lead_stages s where s.id = x and s.company_id = v_company)
     ) then
    raise exception 'The stages have changed in the meantime. Please reload the page and try again.' using errcode = 'P0001';
  end if;
  update public.lead_stages s
  set position = o.ord
  from unnest(p_stages) with ordinality as o (id, ord)
  where s.id = o.id;
end;
$$;

-- Remove a stage. Its leads (open or closed) move to another stage first. There is always at least one stage.
create function public.remove_lead_stage(p_stage uuid, p_move_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
begin
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 3));
  if not exists (select 1 from public.lead_stages s where s.id = p_stage and s.company_id = v_company) then
    raise exception 'That stage isn''t one of your company''s.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.lead_stages s where s.company_id = v_company) <= 1 then
    raise exception 'Keep at least one stage.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.leads l where l.stage_id = p_stage) then
    if p_move_to is null or p_move_to = p_stage
       or not exists (select 1 from public.lead_stages s where s.id = p_move_to and s.company_id = v_company) then
      raise exception 'Choose the stage its leads should move to.' using errcode = 'P0001';
    end if;
    update public.leads set stage_id = p_move_to where stage_id = p_stage;
  end if;
  delete from public.lead_stages where id = p_stage;
  -- Close the gap in the order.
  update public.lead_stages s
  set position = o.ord
  from (select id, row_number() over (order by position, created_at) as ord from public.lead_stages where company_id = v_company) as o
  where s.id = o.id;
end;
$$;

-- ===========================================================================
-- 5. Notes, and turning a lead into a project
-- ===========================================================================
create function public.add_lead_note(p_lead uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  select l.company_id into v_company from public.leads l where l.id = p_lead;
  if v_company is null or not public.can_change_leads(v_company) then
    raise exception 'You can''t add notes to this lead.' using errcode = 'P0001';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 2000 then
    raise exception 'Please write a note of up to 2,000 characters.' using errcode = 'P0001';
  end if;
  insert into public.lead_events (lead_id, company_id, kind, body, created_by)
  values (p_lead, v_company, 'note', v_body, auth.uid())
  returning id into v_id;
  -- The list shows the leads with the latest activity first.
  update public.leads set updated_at = now() where id = p_lead;
  return v_id;
end;
$$;

-- The New project form, filled in from a lead: creates the project (with every check create_project makes, the plan's
-- project limit included), then marks the lead won and links it, all in one step.
create function public.create_project_from_lead(
  p_lead uuid,
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
  v_lead public.leads;
  v_project uuid;
begin
  select * into v_lead from public.leads where id = p_lead for update;
  if not found or not public.is_company_owner(v_lead.company_id) then
    raise exception 'Only the company owner can turn a lead into a project.' using errcode = 'P0001';
  end if;
  if v_lead.project_id is not null then
    raise exception 'This lead already has a project.' using errcode = 'P0001';
  end if;

  v_project := public.create_project(
    p_name, p_location, p_start_date, p_expected_completion_date, p_budget,
    p_client_name, p_client_email, p_client_phone, p_milestones
  );

  update public.leads set status = 'won', lost_reason = null, project_id = v_project where id = p_lead;
  return v_project;
end;
$$;

-- For the Leads badge and the dashboard: the signed-in person's follow-ups that are due today, and the ones overdue.
create function public.my_lead_follow_ups()
returns table (due_today integer, overdue integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where l.follow_up_on = (now() at time zone co.timezone)::date)::integer,
         count(*) filter (where l.follow_up_on < (now() at time zone co.timezone)::date)::integer
  from public.leads l
  join public.companies co on co.id = l.company_id
  where l.status = 'open'
    and l.follow_up_on is not null
    and public.can_see_leads(l.company_id)
    and public.lead_follow_up_owner(l.company_id, l.follow_up_by) = auth.uid();
$$;

-- ===========================================================================
-- 6. Staff: invitations and settings carry "Can see leads"
-- ===========================================================================
drop function public.invite_staff(text, text, uuid[], uuid[], uuid[], boolean, boolean, boolean);
drop function public.set_staff_settings(uuid, boolean, boolean, boolean, boolean);
drop function public.company_team();

create function public.invite_staff(
  p_name text,
  p_email text,
  p_projects uuid[],
  p_payment_projects uuid[],
  p_invoice_projects uuid[] default '{}',
  p_view_only boolean default false,
  p_can_see_budget boolean default true,
  p_can_see_client boolean default true,
  -- Default, so the app that is live while this is applied keeps working.
  p_can_see_leads boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite uuid;
  v_token uuid;
begin
  if char_length(v_name) = 0 or char_length(v_name) > 120 then
    raise exception 'Please enter the staff member''s name.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;

  perform public.assert_staff_projects(v_company, p_projects, p_payment_projects, p_invoice_projects);

  if exists (
    select 1 from auth.users u
    join public.company_members m on m.user_id = u.id and m.company_id = v_company
    where lower(u.email) = v_email
  ) then
    raise exception 'That person is already part of your company.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email
      and (exists (select 1 from public.company_members m where m.user_id = u.id)
           or exists (select 1 from public.clients c where c.user_id = u.id))
  ) then
    raise exception 'This email can''t be added as staff. Ask them to use a different email address.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 1));

  update public.staff_invites
  set revoked_at = now()
  where company_id = v_company and email = v_email and accepted_at is null and revoked_at is null and expires_at <= now();

  if exists (
    select 1 from public.staff_invites
    where company_id = v_company and email = v_email and accepted_at is null and revoked_at is null
  ) then
    raise exception 'There is already an invitation for this email. Resend it from the team list.' using errcode = 'P0001';
  end if;

  perform public.assert_staff_room(v_company);

  insert into public.staff_invites (company_id, email, name, created_by, view_only, can_see_budget, can_see_client, can_see_leads)
  values (v_company, v_email, v_name, auth.uid(), coalesce(p_view_only, false), coalesce(p_can_see_budget, true),
          coalesce(p_can_see_client, true), coalesce(p_can_see_leads, false))
  returning id, token into v_invite, v_token;

  insert into public.staff_invite_projects (invite_id, project_id, can_see_payments, can_invoice)
  select v_invite, pid, pid = any (coalesce(p_payment_projects, '{}')), pid = any (coalesce(p_invoice_projects, '{}'))
  from (select distinct unnest(coalesce(p_projects, '{}')) as pid) x;

  return v_token;
end;
$$;

-- The invited person joins with the settings and projects the owner chose.
create or replace function public.accept_staff_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.staff_invites;
  v_members integer;
  v_plan text;
  v_limit integer;
begin
  if v_user is null then
    raise exception 'Please sign in to accept this invitation.' using errcode = 'P0001';
  end if;

  select * into v_invite from public.staff_invites where token = p_token for update;
  if not found
     or v_invite.email <> v_email
     or v_invite.accepted_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'This invitation isn''t valid for your account.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.company_members m where m.user_id = v_user) then
    raise exception 'This account already belongs to a company, so it can''t join another team.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clients c where c.user_id = v_user) then
    raise exception 'This account is already used as a homeowner account. Use a different email for staff.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_invite.company_id::text, 1));
  select public.effective_plan(co.plan, co.plan_until) into v_plan from public.companies co where co.id = v_invite.company_id;
  v_limit := public.plan_staff_limit(coalesce(v_plan, 'free'));
  select count(*) into v_members from public.company_members m where m.company_id = v_invite.company_id and m.role = 'staff';
  if v_members >= v_limit then
    raise exception 'This company''s plan has no room for another staff account right now. Please ask the owner.' using errcode = 'P0001';
  end if;

  insert into public.company_members (company_id, user_id, role, view_only, can_see_budget, can_see_client, can_see_leads)
  values (v_invite.company_id, v_user, 'staff', v_invite.view_only, v_invite.can_see_budget, v_invite.can_see_client, v_invite.can_see_leads);

  insert into public.project_staff (project_id, user_id, can_see_payments, can_invoice, created_by)
  select ip.project_id, v_user, ip.can_see_payments, ip.can_invoice and ip.can_see_payments, v_invite.created_by
  from public.staff_invite_projects ip
  join public.projects p on p.id = ip.project_id and p.company_id = v_invite.company_id
  where ip.invite_id = v_invite.id;

  update public.staff_invites set accepted_at = now(), accepted_by = v_user where id = v_invite.id;
end;
$$;

-- The person-wide settings: view only, budget, client details, paused, leads.
create function public.set_staff_settings(
  p_user uuid,
  p_view_only boolean,
  p_can_see_budget boolean,
  p_can_see_client boolean,
  p_paused boolean,
  p_can_see_leads boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  update public.company_members
  set view_only = coalesce(p_view_only, view_only),
      can_see_budget = coalesce(p_can_see_budget, can_see_budget),
      can_see_client = coalesce(p_can_see_client, can_see_client),
      paused = coalesce(p_paused, paused),
      can_see_leads = coalesce(p_can_see_leads, can_see_leads)
  where company_id = v_company and user_id = p_user and role = 'staff';
  if not found then
    raise exception 'That person isn''t on your team.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.company_team()
returns table (
  kind text,
  member_user_id uuid,
  invite_id uuid,
  name text,
  email text,
  status text,
  since timestamptz,
  expires_at timestamptz,
  view_only boolean,
  can_see_budget boolean,
  can_see_client boolean,
  paused boolean,
  can_see_leads boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  return query
    select 'member'::text, m.user_id, null::uuid, coalesce(nullif(trim(pr.name), ''), split_part(u.email, '@', 1)),
           u.email::text, case when m.paused then 'paused' else 'active' end, m.created_at, null::timestamptz,
           m.view_only, m.can_see_budget, m.can_see_client, m.paused, m.can_see_leads
    from public.company_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles pr on pr.id = m.user_id
    where m.company_id = v_company and m.role = 'staff'
    union all
    select 'invite'::text, null::uuid, i.id, i.name, i.email,
           case when i.expires_at <= now() then 'expired' else 'pending' end,
           i.created_at, i.expires_at, i.view_only, i.can_see_budget, i.can_see_client, false, i.can_see_leads
    from public.staff_invites i
    where i.company_id = v_company and i.accepted_at is null and i.revoked_at is null;
end;
$$;

-- ===========================================================================
-- 7. Reminders
-- ===========================================================================
-- The WhatsApp number a contractor or staff member gets their own reminders on. A table of its own because profiles can
-- be read by colleagues, and this number is only for its owner.
create table public.team_whatsapp (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.team_whatsapp enable row level security;
revoke all on public.team_whatsapp from anon, authenticated;
grant select, delete on public.team_whatsapp to authenticated;
grant insert (user_id, phone, reminders), update (phone, reminders) on public.team_whatsapp to authenticated;

create policy "team whatsapp: own row read" on public.team_whatsapp for select to authenticated using (user_id = auth.uid());
create policy "team whatsapp: own row add" on public.team_whatsapp for insert to authenticated with check (user_id = auth.uid());
create policy "team whatsapp: own row change" on public.team_whatsapp for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "team whatsapp: own row remove" on public.team_whatsapp for delete to authenticated using (user_id = auth.uid());

create function public.team_whatsapp_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger team_whatsapp_touch
  before update on public.team_whatsapp
  for each row execute function public.team_whatsapp_touch();

-- Who was reminded for which day, so a day's reminder goes out once however often the job runs.
create table public.lead_reminders_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.lead_reminders_sent enable row level security;
revoke all on public.lead_reminders_sent from anon, authenticated;

-- The daily job. For each person with follow-ups due on their next day (today where it is still before noon in the
-- company's time zone, tomorrow where it is later), it adds one in-app notification and returns the email and WhatsApp
-- message to send. People with nothing due that day hear nothing.
create function public.claim_lead_reminders()
returns table (
  out_notification_id uuid,
  out_email text,
  out_whatsapp_to text,
  out_name text,
  out_title text,
  out_body text,
  out_due integer,
  out_when text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_inserted integer;
  v_id uuid;
  v_when text;
  v_title text;
  v_body text;
  v_email boolean;
  v_whatsapp text;
begin
  for r in
    with lead_rows as (
      select l.name, l.follow_up_on, l.company_id,
             public.lead_follow_up_owner(l.company_id, l.follow_up_by) as recipient,
             (now() at time zone co.timezone)::date as local_today,
             ((now() at time zone co.timezone) + interval '12 hours')::date as target_day,
             public.effective_plan(co.plan, co.plan_until) as plan
      from public.leads l
      join public.companies co on co.id = l.company_id
      where l.status = 'open'
        and l.follow_up_on is not null
        and l.follow_up_on <= ((now() at time zone co.timezone) + interval '12 hours')::date
    ),
    per_person as (
      select recipient, company_id, local_today, target_day, plan,
             count(*) filter (where follow_up_on = target_day)::integer as due,
             count(*) filter (where follow_up_on < local_today)::integer as overdue,
             array_agg(name order by name) filter (where follow_up_on = target_day) as names
      from lead_rows
      where recipient is not null
      group by recipient, company_id, local_today, target_day, plan
    )
    select p.*, u.email::text as email, coalesce(pr.email_notifications, true) as wants_email,
           coalesce(nullif(trim(pr.name), ''), '') as person_name,
           case when w.reminders then w.phone end as wa_phone
    from per_person p
    join auth.users u on u.id = p.recipient
    left join public.profiles pr on pr.id = p.recipient
    left join public.team_whatsapp w on w.user_id = p.recipient
    where p.due > 0
    order by p.recipient
  loop
    insert into public.lead_reminders_sent (user_id, day) values (r.recipient, r.target_day) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    continue when v_inserted = 0;

    v_when := case when r.target_day = r.local_today then 'today' else 'tomorrow' end;
    v_title := r.due || case when r.due = 1 then ' follow-up due ' else ' follow-ups due ' end || v_when;
    v_body := array_to_string(r.names[1:3], ', ')
      || case when r.due > 3 then ' and ' || (r.due - 3) || ' more' else '' end
      || case when r.overdue > 0 then ' · ' || r.overdue || ' overdue' else '' end;

    v_email := r.wants_email and r.email is not null;
    -- WhatsApp reminders belong to the paid plans.
    v_whatsapp := case when r.wa_phone is not null and r.plan in ('pro', 'business') then r.wa_phone end;

    insert into public.notifications
      (user_id, actor_id, project_id, kind, title, body, link, recipient_email, email_status, whatsapp_to, whatsapp_status)
    values
      (r.recipient, null, null, 'lead_follow_up', v_title, v_body, '/dashboard/leads?due=1',
       r.email, case when v_email then 'pending' else 'skipped' end,
       v_whatsapp, case when v_whatsapp is not null then 'pending' else 'skipped' end)
    returning id into v_id;

    if v_email or v_whatsapp is not null then
      out_notification_id := v_id;
      out_email := case when v_email then r.email end;
      out_whatsapp_to := v_whatsapp;
      out_name := r.person_name;
      out_title := v_title;
      out_body := v_body;
      out_due := r.due;
      out_when := v_when;
      return next;
    end if;
  end loop;
end;
$$;

-- The job reports whether each email and WhatsApp message went out.
create function public.finish_lead_reminder_email(p_id uuid, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set email_status = case when p_ok then 'sent' else 'failed' end,
      email_attempts = email_attempts + 1,
      emailed_at = case when p_ok then now() else emailed_at end,
      email_error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 300) end
  where id = p_id and kind = 'lead_follow_up' and actor_id is null and email_status = 'pending';
$$;

create function public.finish_lead_reminder_whatsapp(p_id uuid, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set whatsapp_status = case when p_ok then 'sent' else 'failed' end,
      whatsapp_attempts = whatsapp_attempts + 1,
      whatsapp_sent_at = case when p_ok then now() else whatsapp_sent_at end,
      whatsapp_error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 300) end
  where id = p_id and kind = 'lead_follow_up' and actor_id is null and whatsapp_status = 'pending';
$$;

-- ===========================================================================
-- 8. Who may call what
-- ===========================================================================
revoke execute on function
  public.plan_open_lead_limit(text),
  public.can_see_leads(uuid),
  public.can_change_leads(uuid),
  public.add_lead_stage(text),
  public.rename_lead_stage(uuid, text),
  public.set_lead_stage_order(uuid[]),
  public.remove_lead_stage(uuid, uuid),
  public.add_lead_note(uuid, text),
  public.create_project_from_lead(uuid, text, text, date, date, bigint, text, text, text, text[]),
  public.my_lead_follow_ups(),
  public.invite_staff(text, text, uuid[], uuid[], uuid[], boolean, boolean, boolean, boolean),
  public.set_staff_settings(uuid, boolean, boolean, boolean, boolean, boolean),
  public.company_team()
  from public, anon;
grant execute on function
  public.plan_open_lead_limit(text),
  public.can_see_leads(uuid),
  public.can_change_leads(uuid),
  public.add_lead_stage(text),
  public.rename_lead_stage(uuid, text),
  public.set_lead_stage_order(uuid[]),
  public.remove_lead_stage(uuid, uuid),
  public.add_lead_note(uuid, text),
  public.create_project_from_lead(uuid, text, text, date, date, bigint, text, text, text, text[]),
  public.my_lead_follow_ups(),
  public.invite_staff(text, text, uuid[], uuid[], uuid[], boolean, boolean, boolean, boolean),
  public.set_staff_settings(uuid, boolean, boolean, boolean, boolean, boolean),
  public.company_team()
  to authenticated;

-- Internal: only the functions above and the triggers use these.
revoke execute on function
  public.lead_owner_company(),
  public.lead_follow_up_owner(uuid, uuid),
  public.check_lead_stage_name(uuid, text, uuid),
  public.companies_seed_lead_stages(),
  public.leads_before_write(),
  public.leads_enforce_plan_limit(),
  public.leads_log_event(),
  public.team_whatsapp_touch()
  from public, anon, authenticated;

-- The daily job only (the server's secret key).
revoke execute on function
  public.claim_lead_reminders(),
  public.finish_lead_reminder_email(uuid, boolean, text),
  public.finish_lead_reminder_whatsapp(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function
  public.claim_lead_reminders(),
  public.finish_lead_reminder_email(uuid, boolean, text),
  public.finish_lead_reminder_whatsapp(uuid, boolean, text)
  to service_role;
