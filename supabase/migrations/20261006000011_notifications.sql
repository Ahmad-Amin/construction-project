-- Notifications: in-app and email.
-- Created by database triggers, so every path that changes a payment, update or milestone
-- (including the existing functions) notifies the right person, and a failure to notify can
-- never break the real action.

create type public.notification_kind as enum (
  'payment_recorded',
  'payment_confirmed',
  'payment_disputed',
  'update_posted',
  'milestone_completed',
  'client_joined'
);

-- Each person can switch emails off. In-app notifications always appear.
alter table public.profiles
  add column email_notifications boolean not null default true;
grant update (email_notifications) on public.profiles to authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null default '',
  -- A path inside the app, like /dashboard/projects/<id>/payments
  link text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Email delivery. The address is copied here so sending never needs access to auth.users.
  recipient_email text,
  email_status text not null default 'skipped'
    check (email_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  email_attempts integer not null default 0,
  email_claimed_at timestamptz,
  emailed_at timestamptz,
  email_error text
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_email_queue_idx on public.notifications (actor_id)
  where email_status in ('pending', 'sending');

alter table public.notifications enable row level security;

create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: mark own as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nobody creates or deletes notifications from the app; only the triggers below do.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.format_pkr(p_amount bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'PKR ' || to_char(p_amount, 'FM999,999,999,999,999');
$$;

-- Adds one notification. Never tells people about their own actions. Internal: not callable
-- from the app, so notifications can't be forged.
create function public.notify(
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
begin
  if p_user is null or p_user is not distinct from p_actor then
    return;
  end if;

  select u.email, coalesce(pr.email_notifications, true)
  into v_email, v_wants_email
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where u.id = p_user;
  if not found then
    return;
  end if;

  insert into public.notifications
    (user_id, actor_id, project_id, kind, title, body, link, recipient_email, email_status)
  values
    (p_user, p_actor, p_project, p_kind, p_title, coalesce(p_body, ''), p_link, v_email,
     case when v_wants_email and v_email is not null then 'pending' else 'skipped' end);
end;
$$;

revoke execute on function public.notify(uuid, uuid, uuid, public.notification_kind, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A payment is recorded: the other side is asked to confirm it.
-- ---------------------------------------------------------------------------
create function public.notify_payment_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_client_user uuid;
  v_owner uuid;
begin
  begin
    select p.name, c.user_id, co.owner_id
    into v_project, v_client_user, v_owner
    from public.projects p
    join public.clients c on c.id = p.client_id
    join public.companies co on co.id = p.company_id
    where p.id = new.project_id;

    perform public.notify(
      case when new.side = 'contractor' then v_client_user else v_owner end,
      new.created_by,
      new.project_id,
      'payment_recorded',
      'Payment of ' || public.format_pkr(new.amount) || ' is waiting for your confirmation',
      coalesce(nullif(new.created_by_name, ''), 'Someone') || ' recorded it on ' || v_project || '.'
        || case when new.reference <> '' then ' Reference: ' || new.reference || '.' else '' end,
      '/dashboard/projects/' || new.project_id::text || '/payments'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger payments_notify_recorded
  after insert on public.payments
  for each row execute function public.notify_payment_recorded();

-- ---------------------------------------------------------------------------
-- A payment is confirmed or disputed: whoever recorded it is told.
-- ---------------------------------------------------------------------------
create function public.notify_payment_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_who text := coalesce(nullif(new.responded_by_name, ''), 'The other party');
begin
  begin
    select name into v_project from public.projects where id = new.project_id;

    perform public.notify(
      new.created_by,
      new.responded_by,
      new.project_id,
      case when new.status = 'confirmed' then 'payment_confirmed' else 'payment_disputed' end::public.notification_kind,
      case when new.status = 'confirmed'
        then v_who || ' confirmed your payment of ' || public.format_pkr(new.amount)
        else v_who || ' disputed your payment of ' || public.format_pkr(new.amount)
      end,
      case when new.status = 'confirmed'
        then 'It now counts toward the total on ' || v_project || '.'
        else 'On ' || v_project || '. Reason: ' || coalesce(new.dispute_reason, 'not given') || '.'
      end,
      '/dashboard/projects/' || new.project_id::text || '/payments'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger payments_notify_response
  after update on public.payments
  for each row
  when (old.status = 'pending' and new.status <> 'pending')
  execute function public.notify_payment_response();

-- ---------------------------------------------------------------------------
-- A site update is posted: the client is told.
-- ---------------------------------------------------------------------------
create function public.notify_update_posted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_client_user uuid;
begin
  begin
    select p.name, c.user_id
    into v_project, v_client_user
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = new.project_id;

    perform public.notify(
      v_client_user,
      new.author_id,
      new.project_id,
      'update_posted',
      'New site update on ' || v_project,
      left(new.text, 140) || case when char_length(new.text) > 140 then '…' else '' end,
      '/dashboard/projects/' || new.project_id::text || '/updates'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger project_updates_notify_posted
  after insert on public.project_updates
  for each row execute function public.notify_update_posted();

-- ---------------------------------------------------------------------------
-- A milestone reaches 100%: the client is told.
-- ---------------------------------------------------------------------------
create function public.notify_milestone_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_client_user uuid;
begin
  begin
    select p.name, c.user_id
    into v_project, v_client_user
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = new.project_id;

    perform public.notify(
      v_client_user,
      auth.uid(),
      new.project_id,
      'milestone_completed',
      new.name || ' is complete',
      'Good progress on ' || v_project || '.',
      '/dashboard/projects/' || new.project_id::text || '/progress'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger milestones_notify_done
  after update on public.milestones
  for each row
  when (old.status is distinct from 'done' and new.status = 'done')
  execute function public.notify_milestone_done();

-- ---------------------------------------------------------------------------
-- A homeowner accepts their invite: the owner is told.
-- ---------------------------------------------------------------------------
create function public.notify_client_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_project_id uuid;
  v_project text;
begin
  begin
    select owner_id into v_owner from public.companies where id = new.company_id;
    select id, name into v_project_id, v_project
    from public.projects where client_id = new.id order by created_at limit 1;

    perform public.notify(
      v_owner,
      new.user_id,
      v_project_id,
      'client_joined',
      new.name || ' has joined',
      case when v_project is not null
        then 'They can now follow ' || v_project || ' in the portal.'
        else 'They can now follow their project in the portal.' end,
      case when v_project_id is not null
        then '/dashboard/projects/' || v_project_id::text
        else '/dashboard' end
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger clients_notify_joined
  after update of user_id on public.clients
  for each row
  when (old.user_id is null and new.user_id is not null)
  execute function public.notify_client_joined();

-- ---------------------------------------------------------------------------
-- Sending emails. The person who caused a notification claims it, sends the email
-- from the server, then reports the result. No elevated key is needed, and nobody can
-- claim notifications caused by someone else.
-- ---------------------------------------------------------------------------
create function public.claim_email_notifications(p_limit integer default 20)
returns table (
  id uuid,
  to_email text,
  kind public.notification_kind,
  title text,
  body text,
  link text,
  project_name text,
  actor_name text
)
language sql
security definer
set search_path = ''
as $$
  with picked as (
    select n.id
    from public.notifications n
    where n.actor_id = auth.uid()
      and n.email_attempts < 3
      and (
        n.email_status = 'pending'
        or (n.email_status = 'sending' and n.email_claimed_at < now() - interval '5 minutes')
      )
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    for update skip locked
  ),
  claimed as (
    update public.notifications n
    set email_status = 'sending',
        email_attempts = n.email_attempts + 1,
        email_claimed_at = now()
    from picked
    where n.id = picked.id
    returning n.*
  )
  select c.id, c.recipient_email, c.kind, c.title, c.body, c.link, p.name,
         (select coalesce(nullif(trim(pr.name), ''), '') from public.profiles pr where pr.id = c.actor_id)
  from claimed c
  left join public.projects p on p.id = c.project_id;
$$;

create function public.finish_email_notification(p_id uuid, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set email_status = case
        when p_ok then 'sent'
        when email_attempts >= 3 then 'failed'
        else 'pending'
      end,
      emailed_at = case when p_ok then now() else emailed_at end,
      email_error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 300) end
  where id = p_id
    and actor_id = auth.uid()
    and email_status = 'sending';
$$;

revoke execute on function
  public.claim_email_notifications(integer),
  public.finish_email_notification(uuid, boolean, text)
from public, anon;
grant execute on function
  public.claim_email_notifications(integer),
  public.finish_email_notification(uuid, boolean, text)
to authenticated;
