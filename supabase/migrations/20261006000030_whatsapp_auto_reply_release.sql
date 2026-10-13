-- If the automatic reply could not be sent, the person must not be treated as "already answered":
-- this takes the note back so the next message they send gets another try.
create function public.release_whatsapp_autoreply(p_phone text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.whatsapp_auto_replies where phone = p_phone;
$$;

revoke execute on function public.release_whatsapp_autoreply(text) from public, anon, authenticated;
grant execute on function public.release_whatsapp_autoreply(text) to service_role;
