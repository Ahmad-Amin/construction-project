-- Staff accounts. The company owner invites site staff and decides, for each person, which projects they can open and
-- on which of those they can also see payments. Everything is enforced here, in the database:
--
--   * staff are limited by plan: Free 0, Pro 3, Business 10 (pending invitations count)
--   * a staff member sees only the projects they are given, and what belongs to them (their client, updates, expenses,
--     documents...). Before this, staff could see every project of the company.
--   * payments (the list, the schedule, receipts, the totals and the payment lines in the timeline) are visible to a
--     staff member only on projects where the owner switched that on
--   * only the owner can invite, change access, or remove staff
--   * an invitation works for one email address, once, and for 14 days
--
-- A company that goes over its limit (a plan that ran out) keeps the staff it has and simply can't add more.

-- ---------------------------------------------------------------------------
-- What each plan allows
-- ---------------------------------------------------------------------------
create function public.plan_staff_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'pro' then 3 when 'business' then 10 else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- Which projects a staff member can open, and whether they see its payments
-- ---------------------------------------------------------------------------
create table public.project_staff (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  can_see_payments boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (project_id, user_id)
);
create index project_staff_user_idx on public.project_staff (user_id);

alter table public.project_staff enable row level security;
revoke all on public.project_staff from anon, authenticated;
grant select on public.project_staff to authenticated;

-- A person sees their own rows; the owner sees every row of their company's projects. Nobody writes directly:
-- access is changed through the functions below.
create policy "project staff: own rows and the owner read"
  on public.project_staff for select to authenticated
  using (user_id = auth.uid() or public.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  name text not null check (char_length(trim(name)) between 1 and 120),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
-- One open invitation per person per company.
create unique index staff_invites_one_open_per_email
  on public.staff_invites (company_id, email)
  where accepted_at is null and revoked_at is null;

-- The projects (and payments access) an invitation will give once it is accepted.
create table public.staff_invite_projects (
  invite_id uuid not null references public.staff_invites (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  can_see_payments boolean not null default false,
  primary key (invite_id, project_id)
);

alter table public.staff_invites enable row level security;
alter table public.staff_invite_projects enable row level security;
revoke all on public.staff_invites, public.staff_invite_projects from anon, authenticated;
-- The secret link (token) is not selectable: the owner gets it through get_staff_invite_token().
grant select (id, company_id, email, name, created_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.staff_invites to authenticated;
grant select on public.staff_invite_projects to authenticated;

create policy "staff invites: the owner reads"
  on public.staff_invites for select to authenticated
  using (public.is_company_owner(company_id));

create policy "staff invite projects: the owner reads"
  on public.staff_invite_projects for select to authenticated
  using (exists (
    select 1 from public.staff_invites i
    where i.id = invite_id and public.is_company_owner(i.company_id)
  ));

-- ---------------------------------------------------------------------------
-- The access rules. is_project_member() keeps meaning "the contractor's side of this project", but for staff it
-- now also means "assigned to it", so every policy that already used it narrows by itself.
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members m on m.company_id = p.company_id
    where p.id = p_project_id
      and m.user_id = auth.uid()
      and (
        m.role = 'owner'
        or exists (select 1 from public.project_staff s where s.project_id = p.id and s.user_id = m.user_id)
      )
  );
$$;

-- The owner, or a staff member the owner allowed to see this project's payments.
create function public.can_see_project_payments(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_project_owner(p_project_id)
    or exists (
      select 1
      from public.project_staff s
      join public.projects p on p.id = s.project_id
      join public.company_members m on m.company_id = p.company_id and m.user_id = s.user_id
      where s.project_id = p_project_id and s.user_id = auth.uid() and s.can_see_payments
    );
$$;
revoke execute on function public.can_see_project_payments(uuid) from public, anon;
grant execute on function public.can_see_project_payments(uuid) to authenticated;

-- A staff member sees the client of a project they are assigned to, and no other client of the company.
create function public.staff_can_see_client(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.project_staff s on s.project_id = p.id
    where p.client_id = p_client_id and s.user_id = auth.uid()
  );
$$;
revoke execute on function public.staff_can_see_client(uuid) from public, anon;
grant execute on function public.staff_can_see_client(uuid) to authenticated;

drop policy "projects: members and own client read" on public.projects;
create policy "projects: members and own client read"
  on public.projects for select to authenticated
  using (public.is_project_member(id) or public.is_project_client(id));

drop policy "clients: company members read, client reads self" on public.clients;
create policy "clients: owner, assigned staff and the client read"
  on public.clients for select to authenticated
  using (public.is_company_owner(company_id) or user_id = auth.uid() or public.staff_can_see_client(id));

-- Payments, and everything built from them (totals and the timeline run as the caller, so they follow).
drop policy "payments: members and own client read" on public.payments;
create policy "payments: owner, allowed staff and own client read"
  on public.payments for select to authenticated
  using (public.can_see_project_payments(project_id) or public.is_project_client(project_id));

drop policy "scheduled payments: members and own client read" on public.scheduled_payments;
create policy "scheduled payments: owner, allowed staff and own client read"
  on public.scheduled_payments for select to authenticated
  using (public.can_see_project_payments(project_id) or public.is_project_client(project_id));

create or replace function public.can_read_payment_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payments p
    where p.id = public.storage_path_uuid(p_name, 3)
      and p.project_id = public.storage_path_uuid(p_name, 1)
      and (public.can_see_project_payments(p.project_id) or public.is_project_client(p.project_id))
  );
$$;

-- Staff that already exist keep what they had: every project of their company, payments included.
insert into public.project_staff (project_id, user_id, can_see_payments)
select p.id, m.user_id, true
from public.company_members m
join public.projects p on p.company_id = m.company_id
where m.role = 'staff'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Managing the team (all of these are for the company owner)
-- ---------------------------------------------------------------------------

-- The company this owner runs, or an error.
create function public.owner_company()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_company uuid;
begin
  select m.company_id into v_company
  from public.company_members m
  where m.user_id = auth.uid() and m.role = 'owner'
  limit 1;
  if v_company is null then
    raise exception 'Only the company owner can manage staff.' using errcode = 'P0001';
  end if;
  return v_company;
end;
$$;
revoke execute on function public.owner_company() from public, anon, authenticated;

-- Raises the right message when the company has no room for one more staff account.
create function public.assert_staff_room(p_company uuid, p_extra integer default 0)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_used integer;
begin
  select public.effective_plan(co.plan, co.plan_until) into v_plan from public.companies co where co.id = p_company;
  v_limit := public.plan_staff_limit(coalesce(v_plan, 'free'));

  select (select count(*) from public.company_members m where m.company_id = p_company and m.role = 'staff')
       + (select count(*) from public.staff_invites i
          where i.company_id = p_company and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
       + p_extra
  into v_used;

  if v_used >= v_limit then
    if v_limit = 0 then
      raise exception 'Your % plan doesn''t include staff accounts. Upgrade to add site staff.', initcap(coalesce(v_plan, 'free'))
        using errcode = 'P0001';
    end if;
    raise exception 'Your % plan includes % staff accounts, counting pending invitations. Remove one, or upgrade to add more.',
      initcap(coalesce(v_plan, 'free')), v_limit
      using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.assert_staff_room(uuid, integer) from public, anon, authenticated;

-- Checks that the chosen projects belong to the company, and that payments access is only on projects the person can open.
create function public.assert_staff_projects(p_company uuid, p_projects uuid[], p_payment_projects uuid[])
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if cardinality(coalesce(p_projects, '{}')) > 200 then
    raise exception 'That is too many projects at once.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_projects, '{}')) as pid
    where not exists (select 1 from public.projects p where p.id = pid and p.company_id = p_company)
  ) then
    raise exception 'One of those projects isn''t part of your company.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_payment_projects, '{}')) as pid
    where pid <> all (coalesce(p_projects, '{}'))
  ) then
    raise exception 'Payments can only be shown on projects the person can open.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.assert_staff_projects(uuid, uuid[], uuid[]) from public, anon, authenticated;

-- Invite someone. Returns the secret token that goes in the invitation link.
create function public.invite_staff(p_name text, p_email text, p_projects uuid[], p_payment_projects uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
  v_name text := trim(coalesce(p_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite uuid;
  v_token uuid;
begin
  if char_length(v_name) = 0 or char_length(v_name) > 120 then
    raise exception 'Please enter the staff member''s name.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = 'P0001';
  end if;

  perform public.assert_staff_projects(v_company, p_projects, p_payment_projects);

  -- Already on this team?
  if exists (
    select 1 from auth.users u
    join public.company_members m on m.user_id = u.id and m.company_id = v_company
    where lower(u.email) = v_email
  ) then
    raise exception 'That person is already part of your company.' using errcode = 'P0001';
  end if;
  -- Part of any company, or a homeowner here? Their account can't also be staff.
  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email
      and (exists (select 1 from public.company_members m where m.user_id = u.id)
           or exists (select 1 from public.clients c where c.user_id = u.id))
  ) then
    raise exception 'This email can''t be added as staff. Ask them to use a different email address.' using errcode = 'P0001';
  end if;

  -- The lock makes two invitations sent at the same moment count correctly.
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 1));

  update public.staff_invites
  set revoked_at = now()
  where company_id = v_company and email = v_email and accepted_at is null and revoked_at is null and expires_at <= now();

  if exists (
    select 1 from public.staff_invites
    where company_id = v_company and email = v_email and accepted_at is null and revoked_at is null
  ) then
    raise exception 'There is already an invitation for this email. Resend it from the team list.' using errcode = 'P0001';
  end if;

  perform public.assert_staff_room(v_company);

  insert into public.staff_invites (company_id, email, name, created_by)
  values (v_company, v_email, v_name, auth.uid())
  returning id, token into v_invite, v_token;

  insert into public.staff_invite_projects (invite_id, project_id, can_see_payments)
  select v_invite, pid, pid = any (coalesce(p_payment_projects, '{}'))
  from (select distinct unnest(coalesce(p_projects, '{}')) as pid) x;

  return v_token;
end;
$$;

-- What the invitation page shows before the person signs in. Only for someone who holds the link.
create function public.get_staff_invite(p_token uuid)
returns table (staff_name text, email text, company_name text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.name, i.email, co.name,
         case
           when i.accepted_at is not null then 'accepted'
           when i.revoked_at is not null then 'revoked'
           when i.expires_at <= now() then 'expired'
           else 'pending'
         end
  from public.staff_invites i
  join public.companies co on co.id = i.company_id
  where i.token = p_token;
$$;

-- The invited person, signed in with the invited email, joins the team.
create function public.accept_staff_invite(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.staff_invites;
  v_members integer;
  v_plan text;
  v_limit integer;
begin
  if v_user is null then
    raise exception 'Please sign in to accept this invitation.' using errcode = 'P0001';
  end if;

  select * into v_invite from public.staff_invites where token = p_token for update;
  if not found
     or v_invite.email <> v_email
     or v_invite.accepted_at is not null
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now() then
    raise exception 'This invitation isn''t valid for your account.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.company_members m where m.user_id = v_user) then
    raise exception 'This account already belongs to a company, so it can''t join another team.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clients c where c.user_id = v_user) then
    raise exception 'This account is already used as a homeowner account. Use a different email for staff.' using errcode = 'P0001';
  end if;

  -- The plan may have run out since the invitation was sent.
  perform pg_advisory_xact_lock(hashtextextended(v_invite.company_id::text, 1));
  select public.effective_plan(co.plan, co.plan_until) into v_plan from public.companies co where co.id = v_invite.company_id;
  v_limit := public.plan_staff_limit(coalesce(v_plan, 'free'));
  select count(*) into v_members from public.company_members m where m.company_id = v_invite.company_id and m.role = 'staff';
  if v_members >= v_limit then
    raise exception 'This company''s plan has no room for another staff account right now. Please ask the owner.' using errcode = 'P0001';
  end if;

  insert into public.company_members (company_id, user_id, role) values (v_invite.company_id, v_user, 'staff');

  insert into public.project_staff (project_id, user_id, can_see_payments, created_by)
  select ip.project_id, v_user, ip.can_see_payments, v_invite.created_by
  from public.staff_invite_projects ip
  join public.projects p on p.id = ip.project_id and p.company_id = v_invite.company_id
  where ip.invite_id = v_invite.id;

  update public.staff_invites set accepted_at = now(), accepted_by = v_user where id = v_invite.id;
end;
$$;

-- The owner's own copy of an open invitation's link.
create function public.get_staff_invite_token(p_invite uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
  v_token uuid;
begin
  select i.token into v_token
  from public.staff_invites i
  where i.id = p_invite and i.company_id = v_company
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
  return v_token;
end;
$$;

-- A fresh link and another 14 days, for an invitation that is still open or has expired.
create function public.resend_staff_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
  v_invite public.staff_invites;
  v_token uuid := gen_random_uuid();
begin
  select * into v_invite from public.staff_invites
  where id = p_invite and company_id = v_company and accepted_at is null and revoked_at is null
  for update;
  if not found then
    raise exception 'That invitation can''t be resent.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 1));
  -- An expired invitation didn't count; bringing it back does, unless it already did.
  if v_invite.expires_at <= now() then
    perform public.assert_staff_room(v_company);
  end if;

  update public.staff_invites set token = v_token, expires_at = now() + interval '14 days' where id = v_invite.id;
  return v_token;
end;
$$;

create function public.revoke_staff_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  update public.staff_invites
  set revoked_at = now()
  where id = p_invite and company_id = v_company and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'That invitation can''t be cancelled.' using errcode = 'P0001';
  end if;
end;
$$;

-- Change which projects a staff member can open, and on which of them they see payments.
create function public.set_staff_access(p_user uuid, p_projects uuid[], p_payment_projects uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  if not exists (
    select 1 from public.company_members m where m.company_id = v_company and m.user_id = p_user and m.role = 'staff'
  ) then
    raise exception 'That person isn''t on your team.' using errcode = 'P0001';
  end if;
  perform public.assert_staff_projects(v_company, p_projects, p_payment_projects);

  delete from public.project_staff s
  using public.projects p
  where s.user_id = p_user and p.id = s.project_id and p.company_id = v_company
    and s.project_id <> all (coalesce(p_projects, '{}'));

  insert into public.project_staff (project_id, user_id, can_see_payments, created_by)
  select pid, p_user, pid = any (coalesce(p_payment_projects, '{}')), auth.uid()
  from (select distinct unnest(coalesce(p_projects, '{}')) as pid) x
  on conflict (project_id, user_id) do update set can_see_payments = excluded.can_see_payments;
end;
$$;

-- Take someone off the team. Their past updates and records stay, under their name.
create function public.remove_staff(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  if not exists (
    select 1 from public.company_members m where m.company_id = v_company and m.user_id = p_user and m.role = 'staff'
  ) then
    raise exception 'That person isn''t on your team.' using errcode = 'P0001';
  end if;

  delete from public.project_staff s using public.projects p
  where s.user_id = p_user and p.id = s.project_id and p.company_id = v_company;
  delete from public.company_members m where m.company_id = v_company and m.user_id = p_user and m.role = 'staff';
end;
$$;

-- The team page: staff members and open invitations, with the email addresses the owner can't otherwise read.
create function public.company_team()
returns table (
  kind text,
  member_user_id uuid,
  invite_id uuid,
  name text,
  email text,
  status text,
  since timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  return query
    select 'member'::text, m.user_id, null::uuid, coalesce(nullif(trim(pr.name), ''), split_part(u.email, '@', 1)),
           u.email::text, 'active'::text, m.created_at, null::timestamptz
    from public.company_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles pr on pr.id = m.user_id
    where m.company_id = v_company and m.role = 'staff'
    union all
    select 'invite'::text, null::uuid, i.id, i.name, i.email,
           case when i.expires_at <= now() then 'expired' else 'pending' end,
           i.created_at, i.expires_at
    from public.staff_invites i
    where i.company_id = v_company and i.accepted_at is null and i.revoked_at is null;
end;
$$;

-- Who may call what.
revoke execute on function
  public.invite_staff(text, text, uuid[], uuid[]),
  public.accept_staff_invite(uuid),
  public.get_staff_invite_token(uuid),
  public.resend_staff_invite(uuid),
  public.revoke_staff_invite(uuid),
  public.set_staff_access(uuid, uuid[], uuid[]),
  public.remove_staff(uuid),
  public.company_team(),
  public.get_staff_invite(uuid)
  from public, anon;
grant execute on function
  public.invite_staff(text, text, uuid[], uuid[]),
  public.accept_staff_invite(uuid),
  public.get_staff_invite_token(uuid),
  public.resend_staff_invite(uuid),
  public.revoke_staff_invite(uuid),
  public.set_staff_access(uuid, uuid[], uuid[]),
  public.remove_staff(uuid),
  public.company_team()
  to authenticated;
grant execute on function public.get_staff_invite(uuid) to anon, authenticated;
