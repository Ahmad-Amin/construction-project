-- Plans. Every company has a plan (Free, Pro or Business). What a plan allows is enforced here, in the
-- database, so it can't be got round from the app:
--   * how many projects can be Active at once (Free 1, Pro 10, Business unlimited)
--   * whether automatic WhatsApp messages go out for the company's clients (paid plans only)
-- PDF statements are also paid-only; that check is in the app, because the PDF is built by the app.
--
-- Nobody changes a plan from the app: the plan columns have no update grant for signed-in users. The
-- owner (or, later, the payment provider's webhook, using the service role) changes them.

alter table public.companies
  add column plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  -- When a paid plan runs out. Null means it doesn't (a plan given by hand with no end date).
  add column plan_until timestamptz,
  add column plan_updated_at timestamptz;

-- The plan that counts right now: a paid plan whose end date has passed counts as Free.
create function public.effective_plan(p_plan text, p_until timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_plan in ('pro', 'business') and (p_until is null or p_until > now()) then p_plan else 'free' end;
$$;

-- How many projects may be Active at once on a plan; null means no limit.
create function public.plan_active_project_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'pro' then 10 when 'business' then null else 1 end;
$$;

-- Does the company that owns this project have automatic WhatsApp messages? Internal: used by the
-- functions that queue notifications.
create function public.plan_allows_whatsapp(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.effective_plan(co.plan, co.plan_until) in ('pro', 'business')
     from public.projects p join public.companies co on co.id = p.company_id
     where p.id = p_project),
    false);
$$;
revoke execute on function public.plan_allows_whatsapp(uuid) from public, anon, authenticated;

-- A project can only become Active (new, reopened, or restored from the archive) while the company is
-- under its plan's limit. Projects that are already active are never touched, so a company that is over
-- its limit (a plan that ran out, or projects made before plans existed) keeps what it has and simply
-- can't start another. The lock makes two projects started at the same moment count correctly.
create function public.projects_enforce_plan_limit()
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
  if new.status <> 'active' or new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.archived_at is null then
    return new;
  end if;

  select public.effective_plan(co.plan, co.plan_until) into v_plan
  from public.companies co where co.id = new.company_id;
  v_limit := public.plan_active_project_limit(coalesce(v_plan, 'free'));
  if v_limit is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 0));
  select count(*) into v_count
  from public.projects p
  where p.company_id = new.company_id and p.status = 'active' and p.archived_at is null and p.id <> new.id;

  if v_count >= v_limit then
    raise exception 'Your % plan includes % active %. Finish or archive a project, or upgrade to start another.',
      initcap(coalesce(v_plan, 'free')), v_limit, case when v_limit = 1 then 'project' else 'projects' end
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger projects_enforce_plan_limit
  before insert or update of status, archived_at on public.projects
  for each row execute function public.projects_enforce_plan_limit();

-- ---------------------------------------------------------------------------
-- Automatic WhatsApp messages only for paid plans: notify() and the weekly job, as before, plus the check.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user uuid,
  p_actor uuid,
  p_project uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_wants_email boolean;
  v_wants_whatsapp boolean;
  v_phone text;
begin
  if p_user is null or p_user is not distinct from p_actor then
    return;
  end if;

  select u.email, coalesce(pr.email_notifications, true), coalesce(pr.whatsapp_notifications, false)
  into v_email, v_wants_email, v_wants_whatsapp
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = p_user;
  if not found then
    return;
  end if;

  -- Only homeowners have a phone number on file, and only these things are worth a message.
  select nullif(trim(c.phone), '') into v_phone
  from public.clients c
  where c.user_id = p_user
  limit 1;

  v_wants_whatsapp := v_wants_whatsapp
    and v_phone is not null
    and p_kind in ('payment_recorded', 'update_posted', 'milestone_completed', 'project_completed')
    -- Automatic WhatsApp messages belong to the paid plans.
    and public.plan_allows_whatsapp(p_project);

  insert into public.notifications
    (user_id, actor_id, project_id, kind, title, body, link, recipient_email, email_status,
     whatsapp_to, whatsapp_status)
  values
    (p_user, p_actor, p_project, p_kind, p_title, coalesce(p_body, ''), p_link, v_email,
     case when v_wants_email and v_email is not null then 'pending' else 'skipped' end,
     case when v_wants_whatsapp then v_phone end,
     case when v_wants_whatsapp then 'pending' else 'skipped' end);
end;
$$;

create or replace function public.create_weekly_summaries()
returns table (
  out_notification_id uuid,
  out_to_email text,
  out_project_id uuid,
  out_summary jsonb,
  out_whatsapp_to text,
  out_recipient_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_since timestamptz;
  v_summary jsonb;
  v_id uuid;
  v_body text;
  v_updates integer;
  v_finished integer;
  v_paid integer;
  v_awaiting integer;
  v_email boolean;
  v_whatsapp text;
begin
  for r in
    select p.id as pid, p.name as pname, p.last_summary_at, c.user_id as cuser, c.name as cname,
           nullif(trim(c.phone), '') as cphone,
           u.email as cemail, coalesce(pr.email_notifications, true) as wants_email,
           coalesce(pr.whatsapp_notifications, false) as wants_whatsapp
    from public.projects p
    join public.companies co on co.id = p.company_id
    join public.clients c on c.id = p.client_id
    join auth.users u on u.id = c.user_id
    left join public.profiles pr on pr.id = c.user_id
    where co.weekly_summary
      and p.status = 'active'
      and p.archived_at is null
      and p.weekly_summary
      and coalesce(pr.weekly_summary, true)
      and (p.last_summary_at is null or p.last_summary_at <= now() - interval '6 days')
    order by p.id
    for update of p skip locked
  loop
    v_since := greatest(coalesce(r.last_summary_at, '-infinity'::timestamptz), now() - interval '7 days');
    v_summary := public.build_weekly_summary(r.pid, v_since);

    v_updates := (v_summary ->> 'update_count')::integer;
    v_finished := jsonb_array_length(v_summary -> 'finished');
    v_paid := (v_summary ->> 'paid_count')::integer;
    v_awaiting := (v_summary ->> 'awaiting_count')::integer;
    continue when not (v_summary ->> 'has_activity')::boolean and v_awaiting = 0;

    v_body := (v_summary ->> 'progress') || '% complete'
      || case when v_updates > 0 then ' · ' || v_updates || case when v_updates = 1 then ' site update' else ' site updates' end else '' end
      || case when v_finished > 0 then ' · ' || v_finished || case when v_finished = 1 then ' stage finished' else ' stages finished' end else '' end
      || case when v_paid > 0 then ' · ' || v_paid || case when v_paid = 1 then ' payment confirmed' else ' payments confirmed' end else '' end
      || case when v_awaiting > 0 then ' · ' || v_awaiting || case when v_awaiting = 1 then ' payment waits for you' else ' payments wait for you' end else '' end;

    v_email := r.wants_email and r.cemail is not null;
    v_whatsapp := case when r.wants_whatsapp and public.plan_allows_whatsapp(r.pid) then r.cphone end;

    insert into public.notifications
      (user_id, actor_id, project_id, kind, title, body, link, recipient_email, email_status,
       whatsapp_to, whatsapp_status)
    values
      (r.cuser, null, r.pid, 'weekly_summary',
       'Your weekly update on ' || r.pname, v_body,
       '/dashboard/projects/' || r.pid::text,
       r.cemail, case when v_email then 'pending' else 'skipped' end,
       v_whatsapp, case when v_whatsapp is not null then 'pending' else 'skipped' end)
    returning id into v_id;

    update public.projects set last_summary_at = now() where id = r.pid;

    if v_email or v_whatsapp is not null then
      out_notification_id := v_id;
      out_to_email := case when v_email then r.cemail end;
      out_project_id := r.pid;
      out_summary := v_summary;
      out_whatsapp_to := v_whatsapp;
      out_recipient_name := r.cname;
      return next;
    end if;
  end loop;
end;
$$;
