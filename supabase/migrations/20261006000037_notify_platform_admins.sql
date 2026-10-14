-- A bell notification for the people allowed to use the plans admin page (the server passes their email
-- addresses, from PLATFORM_ADMIN_EMAILS). Only the bell: the feedback and the plan request are already
-- emailed to the inbox, so these never send a second email or a WhatsApp message.
--
-- Service role only. The person who caused it is never notified about their own action.
create function public.notify_platform_admins(
  p_emails text[],
  p_actor uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_link text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_kind not in ('feedback_received', 'plan_requested') then
    raise exception 'That kind of notification is not for administrators.';
  end if;
  if p_link is null or left(p_link, 1) <> '/' or left(p_link, 2) = '//' then
    raise exception 'The link must be a path inside the app.';
  end if;

  insert into public.notifications (user_id, actor_id, kind, title, body, link)
  select u.id, p_actor, p_kind, left(coalesce(p_title, ''), 200), left(coalesce(p_body, ''), 500), p_link
  from auth.users u
  where lower(u.email) = any (select lower(e) from unnest(coalesce(p_emails, '{}'::text[])) as e)
    and u.email_confirmed_at is not null
    and u.id is distinct from p_actor;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_platform_admins(text[], uuid, public.notification_kind, text, text, text) from public, anon, authenticated;
grant execute on function public.notify_platform_admins(text[], uuid, public.notification_kind, text, text, text) to service_role;
