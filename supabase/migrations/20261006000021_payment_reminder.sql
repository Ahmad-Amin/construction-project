-- "Remind the homeowner": the contractor presses a button on a payment that is still waiting for
-- the homeowner, and the homeowner gets a reminder through the normal notification channels
-- (the bell, email, and WhatsApp when they have switched it on). A payment can be reminded at
-- most once every 6 hours, so the button can't be used to pester anyone.

alter table public.payments add column reminded_at timestamptz;
-- Not writable from the app: only send_payment_reminder() sets it.

create function public.send_payment_reminder(p_payment uuid)
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
    'Reminder: payment of ' || public.format_pkr(v_pay.amount) || ' is waiting for your confirmation',
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

revoke execute on function public.send_payment_reminder(uuid) from public, anon;
grant execute on function public.send_payment_reminder(uuid) to authenticated;
