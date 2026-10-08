-- WhatsApp as a second channel next to email.
-- Same shape as email: the database decides who should get a WhatsApp message (a homeowner who
-- switched it on and whose phone number the contractor saved), the server sends it with the
-- WhatsApp Cloud API right after the action that caused it, and reports back. Only homeowners
-- have phone numbers on file, so contractors keep the bell and email.

-- Opt-in. Off until the homeowner turns it on, because WhatsApp requires people to agree first.
alter table public.profiles add column whatsapp_notifications boolean not null default false;
grant update (whatsapp_notifications) on public.profiles to authenticated;

alter table public.notifications
  add column whatsapp_to text,
  add column whatsapp_status text not null default 'skipped'
    check (whatsapp_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  add column whatsapp_attempts integer not null default 0,
  add column whatsapp_claimed_at timestamptz,
  add column whatsapp_sent_at timestamptz,
  add column whatsapp_error text;

create index notifications_whatsapp_queue_idx on public.notifications (actor_id)
  where whatsapp_status in ('pending', 'sending');

-- ---------------------------------------------------------------------------
-- notify(): same as before, plus the WhatsApp fields.
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
    and p_kind in ('payment_recorded', 'update_posted', 'milestone_completed', 'project_completed');

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

-- ---------------------------------------------------------------------------
-- Sending. The person who caused a notification claims it, sends the WhatsApp message from the
-- server, then reports the result. Nobody can claim notifications caused by someone else, and
-- messages that are more than half an hour old are never sent (a reminder that late is noise).
-- ---------------------------------------------------------------------------
create function public.claim_whatsapp_notifications(p_limit integer default 10)
returns table (
  id uuid,
  to_phone text,
  kind public.notification_kind,
  title text,
  body text,
  link text,
  project_name text,
  recipient_name text
)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select n.id
    from public.notifications n
    where n.actor_id = auth.uid()
      and n.whatsapp_attempts < 3
      and n.created_at > now() - interval '30 minutes'
      and (
        n.whatsapp_status = 'pending'
        or (n.whatsapp_status = 'sending' and n.whatsapp_claimed_at < now() - interval '5 minutes')
      )
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 10), 1), 30)
    for update skip locked
  ),
  claimed as (
    update public.notifications n
    set whatsapp_status = 'sending',
        whatsapp_attempts = n.whatsapp_attempts + 1,
        whatsapp_claimed_at = now()
    from picked
    where n.id = picked.id
    returning n.*
  )
  select c.id, c.whatsapp_to, c.kind, c.title, c.body, c.link, p.name,
         (select coalesce(nullif(trim(pr.name), ''), '') from public.profiles pr where pr.id = c.user_id)
  from claimed c
  left join public.projects p on p.id = c.project_id;
$$;

create function public.finish_whatsapp_notification(p_id uuid, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set whatsapp_status = case
        when p_ok then 'sent'
        when whatsapp_attempts >= 3 then 'failed'
        else 'pending'
      end,
      whatsapp_sent_at = case when p_ok then now() else whatsapp_sent_at end,
      whatsapp_error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 300) end
  where id = p_id
    and actor_id = auth.uid()
    and whatsapp_status = 'sending';
$$;

revoke execute on function
  public.claim_whatsapp_notifications(integer),
  public.finish_whatsapp_notification(uuid, boolean, text)
from public, anon;
grant execute on function
  public.claim_whatsapp_notifications(integer),
  public.finish_whatsapp_notification(uuid, boolean, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- The weekly summary also goes out on WhatsApp (as a short "it's ready" message with the link).
-- The scheduled job has no signed-in person, so it uses the service role versions below.
-- ---------------------------------------------------------------------------
drop function public.create_weekly_summaries();

create function public.create_weekly_summaries()
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
    v_whatsapp := case when r.wants_whatsapp then r.cphone end;

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

create function public.finish_summary_whatsapp(p_id uuid, p_ok boolean, p_error text)
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
  where id = p_id and kind = 'weekly_summary' and actor_id is null and whatsapp_status = 'pending';
$$;

revoke execute on function
  public.create_weekly_summaries(),
  public.finish_summary_whatsapp(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function
  public.create_weekly_summaries(),
  public.finish_summary_whatsapp(uuid, boolean, text)
to service_role;
