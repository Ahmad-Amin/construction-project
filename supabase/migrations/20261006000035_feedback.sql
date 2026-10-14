-- Feedback from inside the app: a problem, an idea or a question, sent by anyone who is signed in
-- (contractor, staff or homeowner). It is kept here (the source of truth) and also emailed to the
-- person running the service. Nobody but the service role can read it back.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  -- Who, as they were when they wrote it (kept even if the account is later deleted).
  user_email text not null default '',
  user_name text not null default '',
  role text not null default '',
  company_id uuid references public.companies (id) on delete set null,
  company_name text not null default '',
  category text not null check (category in ('problem', 'idea', 'question')),
  message text not null check (char_length(message) between 3 and 2000),
  -- Where in the app they were, and what they were using. Helps to reproduce a problem.
  page text not null default '' check (char_length(page) <= 300),
  browser text not null default '' check (char_length(browser) <= 300),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);

-- No policies and no grants: only the functions below touch this table.
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- A signed-in person sends feedback. Who they are is worked out here, never taken from the request.
-- At most five a hour, so a stuck button or a bored visitor can't flood the inbox.
create function public.submit_feedback(p_category text, p_message text, p_page text, p_browser text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_message text := trim(coalesce(p_message, ''));
  v_email text;
  v_name text;
  v_role text := '';
  v_company uuid;
  v_company_name text := '';
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Please sign in again.' using errcode = 'P0001';
  end if;
  if p_category not in ('problem', 'idea', 'question') then
    raise exception 'Please choose what kind of message this is.' using errcode = 'P0001';
  end if;
  if char_length(v_message) < 3 then
    raise exception 'Please write a few words.' using errcode = 'P0001';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'Please keep it under 2,000 characters.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.feedback where user_id = v_user and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('result', 'too_soon');
  end if;

  select u.email, coalesce(nullif(trim(pr.name), ''), '')
  into v_email, v_name
  from auth.users u left join public.profiles pr on pr.id = u.id
  where u.id = v_user;

  select m.company_id, m.role::text, co.name
  into v_company, v_role, v_company_name
  from public.company_members m join public.companies co on co.id = m.company_id
  where m.user_id = v_user
  limit 1;
  if v_company is null and exists (select 1 from public.clients where user_id = v_user) then
    v_role := 'homeowner';
  end if;

  insert into public.feedback
    (user_id, user_email, user_name, role, company_id, company_name, category, message, page, browser)
  values
    (v_user, coalesce(v_email, ''), v_name, coalesce(v_role, ''), v_company, coalesce(v_company_name, ''),
     p_category, v_message, left(coalesce(p_page, ''), 300), left(coalesce(p_browser, ''), 300))
  returning id into v_id;

  return jsonb_build_object(
    'result', 'ok', 'id', v_id, 'email', coalesce(v_email, ''), 'name', v_name,
    'role', coalesce(v_role, ''), 'company_name', coalesce(v_company_name, '')
  );
end;
$$;

revoke execute on function public.submit_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text) to authenticated;

-- The admin page's Feedback tab (service role only: the server checks who is asking).
create function public.admin_feedback(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(f order by f.created_at desc), '[]'::jsonb)
  from (
    select id, user_email, user_name, role, company_name, category, message, page, browser, status, created_at
    from public.feedback
    order by created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) f;
$$;

-- How many are still waiting for you, for the badge on the admin tabs.
create function public.admin_feedback_new_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.feedback where status = 'new';
$$;

create function public.admin_set_feedback_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('new', 'done') then
    raise exception 'Unknown status.';
  end if;
  update public.feedback set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.admin_feedback(integer), public.admin_feedback_new_count(), public.admin_set_feedback_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_feedback(integer), public.admin_feedback_new_count(), public.admin_set_feedback_status(uuid, text) to service_role;
