-- Staff invites: the owner invites site staff with a private link.
-- Also narrows what staff can read: they work with updates, expenses and progress,
-- but do not see what the client has paid or the project budget.

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  phone text,
  invite_token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

-- One open invite per email per company.
create unique index staff_invites_pending_email_idx
  on public.staff_invites (company_id, lower(email))
  where accepted_at is null;

alter table public.staff_invites enable row level security;

-- Only the owner sees or revokes invites. Creating and accepting go through functions.
create policy "staff invites: owner reads"
  on public.staff_invites for select to authenticated
  using (public.is_company_owner(company_id));

create policy "staff invites: owner revokes pending"
  on public.staff_invites for delete to authenticated
  using (public.is_company_owner(company_id) and accepted_at is null);

revoke all on public.staff_invites from anon, authenticated;
grant select, delete on public.staff_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Creating an invite (owner only)
-- ---------------------------------------------------------------------------
create function public.create_staff_invite(p_name text, p_email text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_id uuid;
begin
  select company_id into v_company
  from public.company_members
  where user_id = auth.uid() and role = 'owner'
  limit 1;

  if v_company is null then
    raise exception 'Only the company owner can invite staff.';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Please enter their name.';
  end if;
  if p_email is null or position('@' in p_email) < 2 then
    raise exception 'Please enter a valid email address.';
  end if;

  -- Already on the team?
  if exists (
    select 1
    from public.staff_invites i
    join public.company_members m on m.user_id = i.accepted_by and m.company_id = i.company_id
    where i.company_id = v_company and lower(i.email) = lower(trim(p_email))
  ) then
    raise exception 'That person is already on your team.';
  end if;

  begin
    insert into public.staff_invites (company_id, name, email, phone)
    values (v_company, trim(p_name), lower(trim(p_email)), nullif(trim(p_phone), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That email already has a pending invite. Revoke it first to send a new one.';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The public invite page, before the person has an account
-- ---------------------------------------------------------------------------
create function public.get_staff_invite(p_token uuid)
returns table (invitee_name text, email text, company_name text, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.name, i.email, c.name,
         case
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'valid'
         end
  from public.staff_invites i
  join public.companies c on c.id = i.company_id
  where i.invite_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- A signed-in person joins the company as staff
-- ---------------------------------------------------------------------------
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
begin
  if v_user is null then
    raise exception 'Please sign in to accept this invite.';
  end if;

  select * into v_invite from public.staff_invites where invite_token = p_token;
  if not found then
    raise exception 'This invite link isn''t valid.';
  end if;

  if v_invite.accepted_at is not null then
    if v_invite.accepted_by = v_user then
      return; -- opening the link again is harmless
    end if;
    raise exception 'This invite has already been used.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'This invite has expired. Ask your employer to send a new one.';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'This invite is for a different email address than the one you''re signed in with.';
  end if;
  if exists (select 1 from public.company_members where user_id = v_user) then
    raise exception 'You already belong to a company.';
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (v_invite.company_id, v_user, 'staff');

  update public.staff_invites
  set accepted_by = v_user, accepted_at = now()
  where id = v_invite.id;
end;
$$;

revoke execute on function
  public.create_staff_invite(text, text, text),
  public.accept_staff_invite(uuid),
  public.get_staff_invite(uuid)
from public, anon;
grant execute on function
  public.create_staff_invite(text, text, text),
  public.accept_staff_invite(uuid)
to authenticated;
-- The invite page runs before the person has an account.
grant execute on function public.get_staff_invite(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Removing staff (owner only; the owner can't be removed this way)
-- ---------------------------------------------------------------------------
create policy "company_members: owner removes staff"
  on public.company_members for delete to authenticated
  using (public.is_company_owner(company_id) and role = 'staff');

grant delete on public.company_members to authenticated;

-- ---------------------------------------------------------------------------
-- What staff can read. Payments and budgets are the owner's and the homeowner's.
-- (The owner keeps budget access through "budgets: owner writes".)
-- ---------------------------------------------------------------------------
drop policy "payments: members and own client read" on public.payments;
create policy "payments: owner and own client read"
  on public.payments for select to authenticated
  using (public.is_project_owner(project_id) or public.is_project_client(project_id));

drop policy "budgets: members read, client reads if shared" on public.project_budgets;
create policy "budgets: client reads if shared"
  on public.project_budgets for select to authenticated
  using (visible_to_client and public.is_project_client(project_id));
