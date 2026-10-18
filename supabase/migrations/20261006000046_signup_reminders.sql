-- One friendly reminder for people who created an account with email and password but haven't confirmed their email.
--
-- The daily job (/api/cron/keep-alive) asks for the people who are due: signed up between 24 hours and 7 days ago,
-- email still not confirmed, never reminded before. It emails each one a fresh link that confirms the email and signs
-- them in. Each person is reminded once, ever: claiming them and recording it happen in the same step, so two runs at
-- the same moment can't both email the same person. A reminder that couldn't be sent is released, so the next day's
-- run tries again (while the person is still inside the 7 days).
--
-- Only the server's secret key can use any of this. Google sign-ups are confirmed by Google and never included.

create table public.signup_reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.signup_reminders enable row level security;
revoke all on public.signup_reminders from anon, authenticated;

-- Marks the people who are due as reminded and returns them (at most p_limit, oldest sign-up first).
create function public.claim_signup_reminders(p_limit integer default 50)
returns table (out_user_id uuid, out_email text, out_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select u.id, u.email::text as email, coalesce(nullif(trim(u.raw_user_meta_data ->> 'name'), ''), '') as name, u.created_at
    from auth.users u
    where u.email_confirmed_at is null
      and coalesce(u.email, '') <> ''
      and not coalesce(u.is_anonymous, false)
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until < now())
      and u.created_at <= now() - interval '24 hours'
      and u.created_at > now() - interval '7 days'
      and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
      and not exists (select 1 from public.signup_reminders r where r.user_id = u.id)
    order by u.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  claimed as (
    insert into public.signup_reminders (user_id)
    select d.id from due d
    on conflict (user_id) do nothing
    returning user_id
  )
  select d.id, d.email, d.name
  from due d
  join claimed c on c.user_id = d.id
  order by d.created_at;
end;
$$;

-- The reminder couldn't be sent: let the next run try again.
create function public.release_signup_reminder(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.signup_reminders where user_id = p_user;
$$;

revoke execute on function public.claim_signup_reminders(integer), public.release_signup_reminder(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_signup_reminders(integer), public.release_signup_reminder(uuid)
  to service_role;
