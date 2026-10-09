-- Payment schedule: the contractor lists the instalments they expect, each tied to a stage
-- ("PKR 500,000 when the foundation is complete") or to the start of the work.
--
-- It is a plan and a reminder, nothing more. It never creates a payment and never moves money.
-- Real payments are still recorded and confirmed by both sides as before; a payment can
-- optionally say which instalment it settles, and that is how an instalment shows as paid.

create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- The stage that makes this instalment due. Empty means due from the start of the work.
  milestone_id uuid references public.milestones (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  -- When the homeowner was last reminded. Only send_schedule_reminder() sets it.
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scheduled_payments_project_idx on public.scheduled_payments (project_id, created_at);
create index scheduled_payments_milestone_idx on public.scheduled_payments (milestone_id);

create trigger scheduled_payments_set_updated_at
  before update on public.scheduled_payments
  for each row execute function public.set_updated_at();

create function public.scheduled_payments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title = trim(new.title);

  if new.milestone_id is not null
     and not exists (
       select 1 from public.milestones m where m.id = new.milestone_id and m.project_id = new.project_id
     ) then
    raise exception 'That stage isn''t part of this project.';
  end if;

  if tg_op = 'INSERT'
     and (select count(*) from public.scheduled_payments where project_id = new.project_id) >= 30 then
    raise exception 'Please keep the payment schedule to 30 instalments or fewer.';
  end if;
  return new;
end;
$$;

create trigger scheduled_payments_before_write
  before insert or update on public.scheduled_payments
  for each row execute function public.scheduled_payments_before_write();

alter table public.scheduled_payments enable row level security;

create policy "scheduled payments: members and own client read"
  on public.scheduled_payments for select to authenticated
  using (public.is_project_member(project_id) or public.is_project_client(project_id));

create policy "scheduled payments: owner adds"
  on public.scheduled_payments for insert to authenticated
  with check (public.is_project_owner(project_id));

create policy "scheduled payments: owner edits"
  on public.scheduled_payments for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "scheduled payments: owner removes"
  on public.scheduled_payments for delete to authenticated
  using (public.is_project_owner(project_id));

revoke all on public.scheduled_payments from anon, authenticated;
grant select, delete on public.scheduled_payments to authenticated;
grant insert (id, project_id, milestone_id, title, amount) on public.scheduled_payments to authenticated;
grant update (milestone_id, title, amount) on public.scheduled_payments to authenticated;

-- ---------------------------------------------------------------------------
-- A payment can say which instalment it settles.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column schedule_item_id uuid references public.scheduled_payments (id) on delete set null;
create index payments_schedule_item_idx on public.payments (schedule_item_id) where schedule_item_id is not null;
grant insert (schedule_item_id) on public.payments to authenticated;
grant update (schedule_item_id) on public.payments to authenticated;

create function public.payments_check_schedule_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.schedule_item_id is not null
     and not exists (
       select 1 from public.scheduled_payments sp
       where sp.id = new.schedule_item_id and sp.project_id = new.project_id
     ) then
    raise exception 'That instalment isn''t part of this project.';
  end if;
  return new;
end;
$$;

create trigger payments_check_schedule_item
  before insert or update of schedule_item_id on public.payments
  for each row execute function public.payments_check_schedule_item();

-- How much of an instalment is still unaccounted for: its amount, less payments that are
-- confirmed or waiting for confirmation (disputed ones don't count).
create function public.scheduled_left(p_item uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    sp.amount - coalesce((
      select sum(p.amount) from public.payments p
      where p.schedule_item_id = sp.id and p.status in ('confirmed', 'pending')
    ), 0),
    0
  )::bigint
  from public.scheduled_payments sp
  where sp.id = p_item;
$$;
revoke execute on function public.scheduled_left(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A stage reaches 100%: the homeowner is told, and now also told when an instalment
-- has just become due. (The WhatsApp message is unchanged; it carries no free text.)
-- ---------------------------------------------------------------------------
create or replace function public.notify_milestone_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_client_user uuid;
  v_due_count integer;
  v_due_total bigint;
begin
  begin
    select p.name, c.user_id
    into v_project, v_client_user
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = new.project_id;

    select count(*)::integer, coalesce(sum(public.scheduled_left(sp.id)), 0)::bigint
    into v_due_count, v_due_total
    from public.scheduled_payments sp
    where sp.milestone_id = new.id and public.scheduled_left(sp.id) > 0;

    perform public.notify(
      v_client_user,
      auth.uid(),
      new.project_id,
      'milestone_completed',
      new.name || ' is complete',
      'Good progress on ' || v_project || '.'
        || case when v_due_count > 0
             then ' A scheduled payment of ' || public.format_pkr(v_due_total) || ' is now due.'
             else '' end,
      '/dashboard/projects/' || new.project_id::text || '/progress'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Request payment": the owner reminds the homeowner about an instalment that is due.
-- Goes to the bell and email. At most once every 6 hours per instalment.
-- ---------------------------------------------------------------------------
create function public.send_schedule_reminder(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.scheduled_payments%rowtype;
  v_stage public.milestones%rowtype;
  v_project public.projects%rowtype;
  v_client_user uuid;
  v_client_name text;
  v_left bigint;
  v_minutes integer;
  v_notification public.notifications%rowtype;
begin
  select * into v_item from public.scheduled_payments where id = p_item;
  if not found then
    raise exception 'That instalment could not be found.';
  end if;
  if not public.is_project_owner(v_item.project_id) then
    raise exception 'Only the company owner can send reminders.';
  end if;

  if v_item.milestone_id is not null then
    select * into v_stage from public.milestones where id = v_item.milestone_id;
    if v_stage.status <> 'done' then
      raise exception 'This instalment isn''t due yet. It falls due when % is complete.', v_stage.name;
    end if;
  end if;

  v_left := public.scheduled_left(p_item);
  if v_left <= 0 then
    raise exception 'A payment for this instalment has already been recorded.';
  end if;

  select * into v_project from public.projects where id = v_item.project_id;
  select c.user_id, c.name into v_client_user, v_client_name
  from public.clients c where c.id = v_project.client_id;

  if v_client_user is null then
    return jsonb_build_object('result', 'not_joined', 'client', v_client_name);
  end if;

  if v_item.reminded_at is not null and v_item.reminded_at > now() - interval '6 hours' then
    v_minutes := ceil(extract(epoch from (v_item.reminded_at + interval '6 hours' - now())) / 60)::integer;
    return jsonb_build_object('result', 'too_soon', 'client', v_client_name, 'minutes', v_minutes);
  end if;

  perform public.notify(
    v_client_user,
    auth.uid(),
    v_item.project_id,
    'payment_due',
    'Payment due: ' || public.format_pkr(v_left) || ' for ' || v_item.title,
    case when v_stage.id is not null then v_stage.name || ' is complete on ' else 'Your payment schedule on ' end
      || v_project.name || '. When you have paid, record it on the Payments page.',
    '/dashboard/projects/' || v_item.project_id::text || '/payments'
  );

  update public.scheduled_payments set reminded_at = now() where id = p_item;

  select * into v_notification
  from public.notifications
  where user_id = v_client_user and actor_id = auth.uid() and project_id = v_item.project_id
    and kind = 'payment_due'
  order by created_at desc limit 1;

  return jsonb_build_object(
    'result', 'sent',
    'client', v_client_name,
    'email', v_notification.email_status = 'pending'
  );
end;
$$;

revoke execute on function public.send_schedule_reminder(uuid) from public, anon;
grant execute on function public.send_schedule_reminder(uuid) to authenticated;
