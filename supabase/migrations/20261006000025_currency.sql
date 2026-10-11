-- Currency. Every company works in one currency, chosen when the company is set up and
-- changeable by the owner. It is only a label: amounts are whole units and are never converted.
-- Homeowners see their contractor's currency (they can already read the company row).

alter table public.companies
  add column currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$');
grant update (currency) on public.companies to authenticated;

-- A new company can pick its currency right away.
drop function public.create_company(text);
create function public.create_company(p_name text, p_currency text default 'PKR')
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

  insert into public.companies (name, currency, owner_id, created_by)
  values (trim(p_name), coalesce(nullif(upper(trim(p_currency)), ''), 'PKR'), v_user, v_user)
  returning id into v_company;

  insert into public.company_members (company_id, user_id, role)
  values (v_company, v_user, 'owner');

  return v_company;
end;
$$;

revoke execute on function public.create_company(text, text) from public, anon;
grant execute on function public.create_company(text, text) to authenticated;

-- "USD 4,000,000" in the currency of the project's company. Internal: used when the database
-- writes notification text, so it cannot be called from the app.
create function public.format_money(p_amount bigint, p_project uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
           (select co.currency from public.projects p
            join public.companies co on co.id = p.company_id
            where p.id = p_project),
           'PKR')
         || ' ' || to_char(p_amount, 'FM999,999,999,999,999');
$$;
revoke execute on function public.format_money(bigint, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The functions that write notification and email text now use the company's currency.
-- ---------------------------------------------------------------------------

create or replace function public.notify_payment_recorded()
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
      'Payment of ' || public.format_money(new.amount, new.project_id) || ' is waiting for your confirmation',
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

create or replace function public.notify_payment_response()
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
        then v_who || ' confirmed your payment of ' || public.format_money(new.amount, new.project_id)
        else v_who || ' disputed your payment of ' || public.format_money(new.amount, new.project_id)
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
             then ' A scheduled payment of ' || public.format_money(v_due_total, new.project_id) || ' is now due.'
             else '' end,
      '/dashboard/projects/' || new.project_id::text || '/progress'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public.send_payment_reminder(p_payment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments%rowtype;
  v_project public.projects%rowtype;
  v_client_user uuid;
  v_client_name text;
  v_phone text;
  v_wants_whatsapp boolean;
  v_wants_email boolean;
  v_minutes integer;
  v_notification public.notifications%rowtype;
begin
  select * into v_pay from public.payments where id = p_payment;
  if not found then
    raise exception 'That payment could not be found.';
  end if;
  if not public.is_project_owner(v_pay.project_id) then
    raise exception 'Only the company owner can send reminders.';
  end if;
  if v_pay.status <> 'pending' or v_pay.side <> 'contractor' then
    raise exception 'Only a payment you recorded that is still waiting for confirmation can be reminded.';
  end if;

  select * into v_project from public.projects where id = v_pay.project_id;
  select c.user_id, c.name, nullif(trim(c.phone), '')
  into v_client_user, v_client_name, v_phone
  from public.clients c where c.id = v_project.client_id;

  if v_client_user is null then
    return jsonb_build_object('result', 'not_joined', 'client', v_client_name);
  end if;

  if v_pay.reminded_at is not null and v_pay.reminded_at > now() - interval '6 hours' then
    v_minutes := ceil(extract(epoch from (v_pay.reminded_at + interval '6 hours' - now())) / 60)::integer;
    return jsonb_build_object('result', 'too_soon', 'client', v_client_name, 'minutes', v_minutes);
  end if;

  perform public.notify(
    v_client_user,
    auth.uid(),
    v_pay.project_id,
    'payment_recorded',
    'Reminder: payment of ' || public.format_money(v_pay.amount, v_pay.project_id) || ' is waiting for your confirmation',
    coalesce(nullif(v_pay.created_by_name, ''), 'Your contractor') || ' recorded it on ' || v_project.name || '.'
      || case when v_pay.reference <> '' then ' Reference: ' || v_pay.reference || '.' else '' end,
    '/dashboard/projects/' || v_pay.project_id::text || '/payments'
  );

  update public.payments set reminded_at = now() where id = p_payment;

  select * into v_notification
  from public.notifications
  where user_id = v_client_user and actor_id = auth.uid() and project_id = v_pay.project_id
  order by created_at desc limit 1;

  select coalesce(pr.whatsapp_notifications, false), coalesce(pr.email_notifications, true)
  into v_wants_whatsapp, v_wants_email
  from public.profiles pr where pr.id = v_client_user;

  return jsonb_build_object(
    'result', 'sent',
    'client', v_client_name,
    'whatsapp', v_notification.whatsapp_status = 'pending',
    'email', v_notification.email_status = 'pending',
    -- Why WhatsApp was skipped, so the button can say so.
    'whatsapp_reason', case
      when v_notification.whatsapp_status = 'pending' then null
      when v_phone is null then 'no_phone'
      when not coalesce(v_wants_whatsapp, false) then 'not_opted_in'
      else 'unavailable'
    end
  );
end;
$$;

create or replace function public.send_schedule_reminder(p_item uuid)
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
    'Payment due: ' || public.format_money(v_left, v_item.project_id) || ' for ' || v_item.title,
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

create or replace function public.build_weekly_summary(p_project uuid, p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_update_count integer;
  v_finished jsonb;
  v_paid_count integer;
  v_awaiting_count integer;
begin
  select count(*) into v_update_count
  from public.project_updates u
  where u.project_id = p_project and u.created_at >= p_since;

  select coalesce(jsonb_agg(m.name order by m.position), '[]'::jsonb) into v_finished
  from public.milestones m
  where m.project_id = p_project and m.status = 'done' and m.updated_at >= p_since;

  select count(*) into v_paid_count
  from public.payments pay
  where pay.project_id = p_project and pay.status = 'confirmed' and pay.responded_at >= p_since;

  select count(*) into v_awaiting_count
  from public.payments pay
  where pay.project_id = p_project and pay.status = 'pending' and pay.side = 'contractor';

  select jsonb_build_object(
    'project_id', p.id,
    'project_name', p.name,
    'company_name', co.name,
    'currency', co.currency,
    'company_logo', co.logo_url,
    'client_name', c.name,
    'since', p_since,
    'progress', coalesce(
      (select round(avg(m.progress_percent))::integer from public.milestones m where m.project_id = p.id), 0),
    'stages', coalesce(
      (select jsonb_agg(jsonb_build_object('name', s.name, 'percent', s.progress_percent) order by s.position)
       from (select name, progress_percent, position from public.milestones
             where project_id = p.id order by position limit 8) s),
      '[]'::jsonb),
    'finished', v_finished,
    'update_count', v_update_count,
    'updates', coalesce(
      (select jsonb_agg(jsonb_build_object('date', r.update_date, 'text', left(r.text, 240), 'author', r.author_name)
                        order by r.created_at desc)
       from (select update_date, text, author_name, created_at from public.project_updates
             where project_id = p.id and created_at >= p_since
             order by created_at desc limit 3) r),
      '[]'::jsonb),
    'photo_count', (select count(*) from public.project_photos ph
                    where ph.project_id = p.id and ph.created_at >= p_since),
    'photos', coalesce(
      (select jsonb_agg(x.path order by x.created_at desc)
       from (select coalesce(thumb_path, storage_path) as path, created_at from public.project_photos
             where project_id = p.id and created_at >= p_since
             order by created_at desc limit 4) x),
      '[]'::jsonb),
    'paid_count', v_paid_count,
    'paid_this_week', coalesce(
      (select jsonb_agg(jsonb_build_object('amount', y.amount, 'date', y.payment_date) order by y.responded_at desc)
       from (select amount, payment_date, responded_at from public.payments
             where project_id = p.id and status = 'confirmed' and responded_at >= p_since
             order by responded_at desc limit 5) y),
      '[]'::jsonb),
    'paid_this_week_total', coalesce(
      (select sum(amount) from public.payments
       where project_id = p.id and status = 'confirmed' and responded_at >= p_since), 0),
    'paid_total', coalesce(
      (select sum(amount) from public.payments where project_id = p.id and status = 'confirmed'), 0),
    'awaiting_count', v_awaiting_count,
    'awaiting_total', coalesce(
      (select sum(amount) from public.payments
       where project_id = p.id and status = 'pending' and side = 'contractor'), 0),
    -- Only when the contractor chose to share the budget.
    'budget', (select b.amount from public.project_budgets b
               where b.project_id = p.id and b.visible_to_client),
    'has_activity', (v_update_count > 0 or jsonb_array_length(v_finished) > 0 or v_paid_count > 0)
  )
  into v_summary
  from public.projects p
  join public.companies co on co.id = p.company_id
  join public.clients c on c.id = p.client_id
  where p.id = p_project;

  return v_summary;
end;
$$;

-- Nothing uses the PKR-only helper any more.
drop function public.format_pkr(bigint);
