-- WhatsApp is one-way: BuildPeek sends updates and does not read replies. When someone writes to
-- the number anyway, the app answers once to say so. This remembers who was answered, so the same
-- person gets at most one reply per day and nobody can make the app message them in a loop.
--
-- It stores phone numbers of people who wrote to us, and nothing else. Rows older than 30 days
-- are removed each time a new one is added.

create table public.whatsapp_auto_replies (
  phone text primary key check (phone ~ '^[0-9]{6,20}$'),
  replied_at timestamptz not null default now()
);

alter table public.whatsapp_auto_replies enable row level security;
revoke all on public.whatsapp_auto_replies from anon, authenticated;

-- True when this number should get a reply now (and records it); false when it already got one
-- in the last 24 hours. A single statement, so two messages arriving at once can't both win.
create function public.claim_whatsapp_autoreply(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text;
begin
  if p_phone is null or p_phone !~ '^[0-9]{6,20}$' then
    return false;
  end if;

  delete from public.whatsapp_auto_replies where replied_at < now() - interval '30 days';

  insert into public.whatsapp_auto_replies (phone, replied_at)
  values (p_phone, now())
  on conflict (phone) do update set replied_at = now()
    where public.whatsapp_auto_replies.replied_at < now() - interval '24 hours'
  returning phone into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke execute on function public.claim_whatsapp_autoreply(text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_autoreply(text) to service_role;
