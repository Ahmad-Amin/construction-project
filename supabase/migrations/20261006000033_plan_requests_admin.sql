-- Asking for a plan, and changing one by hand.
--
-- A company owner can ask for Pro or Business from Settings (one request an hour). Each request is
-- kept, so the person running the service sees it on the admin page and the owner can't send a flood.
-- The admin page changes plans with admin_set_plan(), which only the service role (the server, after
-- checking the signed-in person is on the allow-list) can call. Every change is written to a history.

create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  plan text not null check (plan in ('pro', 'business')),
  yearly boolean not null default false,
  created_at timestamptz not null default now(),
  -- Set when the plan was changed to what they asked for, or the request was dismissed.
  handled_at timestamptz
);
create index plan_requests_company_idx on public.plan_requests (company_id, created_at desc);
create index plan_requests_open_idx on public.plan_requests (created_at desc) where handled_at is null;

create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  old_plan text not null,
  old_until timestamptz,
  new_plan text not null,
  new_until timestamptz,
  changed_by text not null default '',
  created_at timestamptz not null default now()
);
create index plan_changes_recent_idx on public.plan_changes (created_at desc);

-- No policies and no grants: these two tables are only touched by the functions below.
alter table public.plan_requests enable row level security;
alter table public.plan_changes enable row level security;
revoke all on public.plan_requests, public.plan_changes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The owner asks for a plan. Returns what the server needs to write the email.
-- ---------------------------------------------------------------------------
create function public.request_plan_upgrade(p_plan text, p_yearly boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_company public.companies%rowtype;
  v_last timestamptz;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Please sign in again.' using errcode = 'P0001';
  end if;
  if p_plan not in ('pro', 'business') then
    raise exception 'Please choose Pro or Business.' using errcode = 'P0001';
  end if;

  select co.* into v_company
  from public.companies co
  join public.company_members m on m.company_id = co.id
  where m.user_id = v_user and m.role = 'owner'
  limit 1;
  if not found then
    raise exception 'Only the company owner can ask for a plan.' using errcode = 'P0001';
  end if;

  select max(created_at) into v_last from public.plan_requests where company_id = v_company.id;
  if v_last is not null and v_last > now() - interval '1 hour' then
    return jsonb_build_object(
      'result', 'too_soon',
      'minutes', ceil(extract(epoch from (v_last + interval '1 hour' - now())) / 60)::integer
    );
  end if;

  insert into public.plan_requests (company_id, requested_by, plan, yearly)
  values (v_company.id, v_user, p_plan, coalesce(p_yearly, false))
  returning id into v_id;

  return jsonb_build_object(
    'result', 'ok',
    'id', v_id,
    'company_id', v_company.id,
    'company_name', v_company.name,
    'current_plan', public.effective_plan(v_company.plan, v_company.plan_until)
  );
end;
$$;

-- If the email could not be sent, the request is taken back so the owner can try again straight away.
create function public.cancel_plan_request(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.plan_requests where id = p_id and requested_by = auth.uid() and handled_at is null;
$$;

revoke execute on function public.request_plan_upgrade(text, boolean), public.cancel_plan_request(uuid) from public, anon;
grant execute on function public.request_plan_upgrade(text, boolean), public.cancel_plan_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The admin page. Service role only: the server checks who is asking before it calls these.
-- ---------------------------------------------------------------------------
create function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'companies', coalesce((
      select jsonb_agg(c order by c.created_at desc)
      from (
        select co.id, co.name, co.plan, co.plan_until, co.created_at,
               public.effective_plan(co.plan, co.plan_until) as effective,
               (select u.email from auth.users u where u.id = co.owner_id) as owner_email,
               (select nullif(trim(pr.name), '') from public.profiles pr where pr.id = co.owner_id) as owner_name,
               (select count(*) from public.projects p where p.company_id = co.id and p.status = 'active' and p.archived_at is null)::int as active_projects,
               (select count(*) from public.projects p where p.company_id = co.id)::int as total_projects
        from public.companies co
      ) c
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select rq.id, rq.company_id, co.name as company_name, rq.plan, rq.yearly, rq.created_at,
               (select u.email from auth.users u where u.id = rq.requested_by) as requested_by_email
        from public.plan_requests rq
        join public.companies co on co.id = rq.company_id
        where rq.handled_at is null
        limit 100
      ) r
    ), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(h order by h.created_at desc)
      from (
        select ch.id, co.name as company_name, ch.old_plan, ch.old_until, ch.new_plan, ch.new_until, ch.changed_by, ch.created_at
        from public.plan_changes ch
        join public.companies co on co.id = ch.company_id
        order by ch.created_at desc
        limit 20
      ) h
    ), '[]'::jsonb)
  );
$$;

create function public.admin_set_plan(p_company uuid, p_plan text, p_until timestamptz, p_by text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.companies%rowtype;
  v_until timestamptz;
begin
  if p_plan not in ('free', 'pro', 'business') then
    raise exception 'Unknown plan.';
  end if;
  select * into v_old from public.companies where id = p_company for update;
  if not found then
    raise exception 'That company does not exist.';
  end if;

  -- Free has no end date. A paid plan with no end date never runs out (used for plans given as a gift).
  v_until := case when p_plan = 'free' then null else p_until end;
  if p_plan <> 'free' and v_until is not null and v_until <= now() then
    raise exception 'The end date must be in the future.';
  end if;

  update public.companies
  set plan = p_plan, plan_until = v_until, plan_updated_at = now()
  where id = p_company;

  insert into public.plan_changes (company_id, old_plan, old_until, new_plan, new_until, changed_by)
  values (p_company, v_old.plan, v_old.plan_until, p_plan, v_until, coalesce(left(p_by, 200), ''));

  -- Asking for this plan (or any paid plan, when the company has been given one) is answered.
  update public.plan_requests
  set handled_at = now()
  where company_id = p_company and handled_at is null and (p_plan <> 'free');
end;
$$;

create function public.admin_dismiss_request(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.plan_requests set handled_at = now() where id = p_id and handled_at is null;
$$;

revoke execute on function
  public.admin_overview(),
  public.admin_set_plan(uuid, text, timestamptz, text),
  public.admin_dismiss_request(uuid)
from public, anon, authenticated;
grant execute on function
  public.admin_overview(),
  public.admin_set_plan(uuid, text, timestamptz, text),
  public.admin_dismiss_request(uuid)
to service_role;
