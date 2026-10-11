-- Time zone. Each company works in one time zone, chosen when the company is set up and
-- changeable by the owner. "Today", the time shown on an event and the day an event belongs to
-- all follow it, so a contractor in London or Dubai no longer sees Pakistan's day.

alter table public.companies
  add column timezone text not null default 'Asia/Karachi' check (char_length(timezone) between 1 and 64);
grant update (timezone) on public.companies to authenticated;

-- Only real zones are accepted (a bad name would break every query that uses it).
create function public.companies_check_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'That time zone isn''t recognised.';
  end if;
  return new;
end;
$$;

create trigger companies_check_timezone
  before insert or update of timezone on public.companies
  for each row execute function public.companies_check_timezone();

-- A new company can pick its time zone right away.
drop function public.create_company(text, text);
create function public.create_company(p_name text, p_currency text default 'PKR', p_timezone text default 'Asia/Karachi')
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

  insert into public.companies (name, currency, timezone, owner_id, created_by)
  values (trim(p_name), coalesce(nullif(upper(trim(p_currency)), ''), 'PKR'),
          coalesce(nullif(trim(p_timezone), ''), 'Asia/Karachi'), v_user, v_user)
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role)
  values (v_company, v_user, 'owner');

  return v_company;
end;
$$;

revoke execute on function public.create_company(text, text, text) from public, anon;
grant execute on function public.create_company(text, text, text) to authenticated;

-- The time zone of the company a project belongs to. Runs as the caller, so it answers only
-- for projects they can see (the timeline is not security definer).
create function public.project_time_zone(p_project uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select co.timezone from public.projects p join public.companies co on co.id = p.company_id where p.id = p_project),
    'Asia/Karachi');
$$;
revoke execute on function public.project_time_zone(uuid) from public, anon;
grant execute on function public.project_time_zone(uuid) to authenticated;

-- The timeline groups a confirmation under the day it happened in the project's own time zone.
create or replace function public.project_timeline(p_project_id uuid, p_limit integer default 30)
returns table (
  kind text,
  item_id uuid,
  event_date date,
  occurred_at timestamptz,
  actor_name text,
  title text,
  detail text,
  amount bigint,
  status text,
  side text
)
language sql
stable
set search_path = ''
as $$
  select t.kind, t.item_id, t.event_date, t.occurred_at, t.actor_name,
         t.title, t.detail, t.amount, t.status, t.side
  from (
    -- Site updates
    select 'update'::text as kind,
           u.id as item_id,
           u.update_date as event_date,
           u.created_at as occurred_at,
           u.author_name as actor_name,
           u.text as title,
           m.name as detail,
           null::bigint as amount,
           null::text as status,
           null::text as side
    from public.project_updates u
    left join public.milestones m on m.id = u.milestone_id
    where u.project_id = p_project_id

    union all

    -- Expenses shared with the client
    select 'expense', e.id, e.expense_date, e.created_at, e.created_by_name,
           e.vendor_note, e.category::text, e.amount, null::text, null::text
    from public.expenses e
    where e.project_id = p_project_id and e.client_visible

    union all

    -- Payments as recorded
    select 'payment', p.id, p.payment_date, p.created_at, p.created_by_name,
           p.reference, p.note, p.amount, p.status::text, p.side::text
    from public.payments p
    where p.project_id = p_project_id

    union all

    -- The other side's confirmation or dispute, at the moment it happened
    select 'payment_response', p.id,
           (p.responded_at at time zone public.project_time_zone(p_project_id))::date,
           p.responded_at, p.responded_by_name,
           p.dispute_reason, null::text, p.amount, p.status::text, p.side::text
    from public.payments p
    where p.project_id = p_project_id and p.responded_at is not null
  ) t
  order by t.event_date desc, t.occurred_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 200);
$$;
