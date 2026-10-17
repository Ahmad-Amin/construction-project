-- Two things.
--
-- 1. Invoice "paid" tracking. A payment can say which invoice it pays (payments.invoice_id). How much of an invoice is
--    paid is worked out from the confirmed payments that point at it, never stored, so it can't drift.
--
-- 2. More control over staff, set by the owner:
--      per person:  paused (sees and does nothing until resumed), view only (can look, can't add or change anything),
--                   can see the budget, can see the client's details (name, phone, email)
--      per project: can create and send invoices (needs payments access on that project)
--    Everything is enforced here. Staff who already exist, and invitations already sent, keep what they could do before
--    (budget and client details visible). The Team page asks the owner for each new invitation.

-- ===========================================================================
-- 1. Paid tracking
-- ===========================================================================
alter table public.payments
  add column invoice_id uuid references public.invoices (id) on delete set null;
create index payments_invoice_idx on public.payments (invoice_id) where invoice_id is not null;
grant insert (invoice_id) on public.payments to authenticated;
grant update (invoice_id) on public.payments to authenticated;

-- A payment can only be for a sent invoice of the same project (not a draft, not a cancelled one).
create function public.payments_check_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_status text;
begin
  if new.invoice_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.invoice_id is not distinct from old.invoice_id then
    return new;
  end if;
  select project_id, status into v_project, v_status from public.invoices where id = new.invoice_id;
  if v_project is null or v_project <> new.project_id then
    raise exception 'That invoice isn''t part of this project.' using errcode = 'P0001';
  end if;
  if v_status <> 'sent' then
    raise exception 'A payment can only be for an invoice that was sent (not a draft or a cancelled one).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_check_invoice
  before insert or update of invoice_id on public.payments
  for each row execute function public.payments_check_invoice();

-- Saying a payment is for a different invoice changes what it means, so the other side has to look at it again (as
-- when the amount changes).
create or replace function public.payments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  new.reference = trim(new.reference);
  new.note = trim(new.note);
  new.receipt_path = nullif(trim(coalesce(new.receipt_path, '')), '');
  if new.receipt_path is not null
     and left(new.receipt_path, length(new.project_id::text || '/payments/' || new.id::text || '/'))
         <> new.project_id::text || '/payments/' || new.id::text || '/' then
    raise exception 'The receipt was uploaded to the wrong place. Please try again.';
  end if;
  if tg_op = 'INSERT' then
    -- Which side is recording is decided here, never trusted from the request.
    if public.is_project_owner(new.project_id) then
      new.side = 'contractor';
    elsif public.is_project_client(new.project_id) then
      new.side = 'client';
    else
      raise exception 'You can''t record payments on this project.';
    end if;
    new.status = 'pending';
    new.responded_by = null;
    new.responded_by_name = '';
    new.responded_at = null;
    new.dispute_reason = null;
    new.edited = false;
    select nullif(trim(name), '') into v_name from public.profiles where id = auth.uid();
    new.created_by_name = coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');
  else
    -- Changing what was paid (or the proof of it, or the invoice it is for) means the other side has to look at it again.
    if (new.amount, new.payment_date, new.reference, new.note, new.receipt_path, new.invoice_id)
       is distinct from (old.amount, old.payment_date, old.reference, old.note, old.receipt_path, old.invoice_id) then
      new.status = 'pending';
      new.responded_by = null;
      new.responded_by_name = '';
      new.responded_at = null;
      new.dispute_reason = null;
      new.edited = true;
    end if;
  end if;
  return new;
end;
$$;

-- ===========================================================================
-- 2. Staff controls
-- ===========================================================================
alter table public.company_members
  add column paused boolean not null default false,
  add column view_only boolean not null default false,
  add column can_see_budget boolean not null default true,
  add column can_see_client boolean not null default true;

alter table public.project_staff
  add column can_invoice boolean not null default false,
  add constraint project_staff_invoice_needs_payments check (can_see_payments or not can_invoice);

alter table public.staff_invites
  add column view_only boolean not null default false,
  add column can_see_budget boolean not null default true,
  add column can_see_client boolean not null default true;
grant select (view_only, can_see_budget, can_see_client) on public.staff_invites to authenticated;

alter table public.staff_invite_projects
  add column can_invoice boolean not null default false,
  add constraint staff_invite_projects_invoice_needs_payments check (can_see_payments or not can_invoice);

-- ---------------------------------------------------------------------------
-- The access rules learn the new settings
-- ---------------------------------------------------------------------------
-- A paused staff member is not part of any project until resumed.
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
        or (
          not m.paused
          and exists (select 1 from public.project_staff s where s.project_id = p.id and s.user_id = m.user_id)
        )
      )
  );
$$;

create or replace function public.can_see_project_payments(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_project_owner(p_project_id)
    or exists (
      select 1
      from public.project_staff s
      join public.projects p on p.id = s.project_id
      join public.company_members m on m.company_id = p.company_id and m.user_id = s.user_id
      where s.project_id = p_project_id and s.user_id = auth.uid() and s.can_see_payments and not m.paused
    );
$$;

-- Staff see a client's record (name, phone, email) only when allowed to see client details, on their projects.
create or replace function public.staff_can_see_client(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.project_staff s on s.project_id = p.id
    join public.company_members m on m.company_id = p.company_id and m.user_id = s.user_id
    where p.client_id = p_client_id and s.user_id = auth.uid() and m.can_see_client and not m.paused
  );
$$;

-- True when the caller is staff of the company that runs this project and is paused or view-only: they can't add,
-- change or delete anything there. (Owners, homeowners and everyone else: false.)
create function public.staff_write_blocked(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members m on m.company_id = p.company_id
    where p.id = p_project and m.user_id = auth.uid() and m.role = 'staff' and (m.paused or m.view_only)
  );
$$;
revoke execute on function public.staff_write_blocked(uuid) from public, anon;
grant execute on function public.staff_write_blocked(uuid) to authenticated;

-- True when the caller is staff of this project's company who isn't allowed to see budgets.
create function public.staff_budget_hidden(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.company_members m on m.company_id = p.company_id
    where p.id = p_project and m.user_id = auth.uid() and m.role = 'staff' and not m.can_see_budget
  );
$$;
revoke execute on function public.staff_budget_hidden(uuid) from public, anon;
grant execute on function public.staff_budget_hidden(uuid) to authenticated;

-- Invoices: the owner, and staff the owner allowed on this project. They must also see its payments and the client's
-- details (an invoice shows the client's name and email), be active and not view-only.
create or replace function public.can_manage_invoices(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_project_owner(p_project)
    or exists (
      select 1
      from public.project_staff s
      join public.projects p on p.id = s.project_id
      join public.company_members m on m.company_id = p.company_id and m.user_id = s.user_id
      where s.project_id = p_project and s.user_id = auth.uid() and m.role = 'staff'
        and s.can_invoice and s.can_see_payments and m.can_see_client and not m.paused and not m.view_only
    );
$$;

-- The budget, for staff who may not see it: nothing comes back.
create policy "budgets: hidden from staff who may not see them"
  on public.project_budgets as restrictive for select to authenticated
  using (not public.staff_budget_hidden(project_id));

-- Paused and view-only staff can't write anything on the project. These rules are added on top of the existing ones
-- (restrictive), so the existing rules for owners, staff and homeowners are unchanged.
create policy "updates: not by paused or view-only staff (add)"
  on public.project_updates as restrictive for insert to authenticated
  with check (not public.staff_write_blocked(project_id));
create policy "updates: not by paused or view-only staff (delete)"
  on public.project_updates as restrictive for delete to authenticated
  using (not public.staff_write_blocked(project_id));

create policy "photos: not by paused or view-only staff (add)"
  on public.project_photos as restrictive for insert to authenticated
  with check (not public.staff_write_blocked(project_id));
create policy "photos: not by paused or view-only staff (delete)"
  on public.project_photos as restrictive for delete to authenticated
  using (not public.staff_write_blocked(project_id));

create policy "expenses: not by paused or view-only staff (add)"
  on public.expenses as restrictive for insert to authenticated
  with check (not public.staff_write_blocked(project_id));
create policy "expenses: not by paused or view-only staff (change)"
  on public.expenses as restrictive for update to authenticated
  using (not public.staff_write_blocked(project_id))
  with check (not public.staff_write_blocked(project_id));
create policy "expenses: not by paused or view-only staff (delete)"
  on public.expenses as restrictive for delete to authenticated
  using (not public.staff_write_blocked(project_id));

create policy "documents: not by paused or view-only staff (add)"
  on public.project_documents as restrictive for insert to authenticated
  with check (not public.staff_write_blocked(project_id));
create policy "documents: not by paused or view-only staff (change)"
  on public.project_documents as restrictive for update to authenticated
  using (not public.staff_write_blocked(project_id))
  with check (not public.staff_write_blocked(project_id));
create policy "documents: not by paused or view-only staff (delete)"
  on public.project_documents as restrictive for delete to authenticated
  using (not public.staff_write_blocked(project_id));

create policy "milestones: not by paused or view-only staff (change)"
  on public.milestones as restrictive for update to authenticated
  using (not public.staff_write_blocked(project_id))
  with check (not public.staff_write_blocked(project_id));

create policy "files: not by paused or view-only staff (upload)"
  on storage.objects as restrictive for insert to authenticated
  with check (not public.staff_write_blocked(public.storage_project_id(name)));
create policy "files: not by paused or view-only staff (change)"
  on storage.objects as restrictive for update to authenticated
  using (not public.staff_write_blocked(public.storage_project_id(name)))
  with check (not public.staff_write_blocked(public.storage_project_id(name)));
create policy "files: not by paused or view-only staff (delete)"
  on storage.objects as restrictive for delete to authenticated
  using (not public.staff_write_blocked(public.storage_project_id(name)));

-- ---------------------------------------------------------------------------
-- Managing the team, with the new settings
-- ---------------------------------------------------------------------------
drop function public.invite_staff(text, text, uuid[], uuid[]);
drop function public.set_staff_access(uuid, uuid[], uuid[]);
drop function public.company_team();
drop function public.assert_staff_projects(uuid, uuid[], uuid[]);

-- Projects must be the company's; payments only where the person can open the project; invoices only where they see
-- payments.
create function public.assert_staff_projects(p_company uuid, p_projects uuid[], p_payment_projects uuid[], p_invoice_projects uuid[])
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
  if exists (select 1 from unnest(coalesce(p_payment_projects, '{}')) as pid where pid <> all (coalesce(p_projects, '{}'))) then
    raise exception 'Payments can only be shown on projects the person can open.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_invoice_projects, '{}')) as pid where pid <> all (coalesce(p_payment_projects, '{}'))) then
    raise exception 'Invoices can only be allowed on projects where the person can see payments.' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.assert_staff_projects(uuid, uuid[], uuid[], uuid[]) from public, anon, authenticated;

create function public.invite_staff(
  p_name text,
  p_email text,
  p_projects uuid[],
  p_payment_projects uuid[],
  -- Defaults, so the app that is live while this is applied keeps working.
  p_invoice_projects uuid[] default '{}',
  p_view_only boolean default false,
  p_can_see_budget boolean default true,
  p_can_see_client boolean default true
)
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

  perform public.assert_staff_projects(v_company, p_projects, p_payment_projects, p_invoice_projects);

  if exists (
    select 1 from auth.users u
    join public.company_members m on m.user_id = u.id and m.company_id = v_company
    where lower(u.email) = v_email
  ) then
    raise exception 'That person is already part of your company.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from auth.users u
    where lower(u.email) = v_email
      and (exists (select 1 from public.company_members m where m.user_id = u.id)
           or exists (select 1 from public.clients c where c.user_id = u.id))
  ) then
    raise exception 'This email can''t be added as staff. Ask them to use a different email address.' using errcode = 'P0001';
  end if;

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

  insert into public.staff_invites (company_id, email, name, created_by, view_only, can_see_budget, can_see_client)
  values (v_company, v_email, v_name, auth.uid(), coalesce(p_view_only, false), coalesce(p_can_see_budget, true), coalesce(p_can_see_client, true))
  returning id, token into v_invite, v_token;

  insert into public.staff_invite_projects (invite_id, project_id, can_see_payments, can_invoice)
  select v_invite, pid, pid = any (coalesce(p_payment_projects, '{}')), pid = any (coalesce(p_invoice_projects, '{}'))
  from (select distinct unnest(coalesce(p_projects, '{}')) as pid) x;

  return v_token;
end;
$$;

-- The invited person joins with the settings and projects the owner chose.
create or replace function public.accept_staff_invite(p_token uuid)
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

  perform pg_advisory_xact_lock(hashtextextended(v_invite.company_id::text, 1));
  select public.effective_plan(co.plan, co.plan_until) into v_plan from public.companies co where co.id = v_invite.company_id;
  v_limit := public.plan_staff_limit(coalesce(v_plan, 'free'));
  select count(*) into v_members from public.company_members m where m.company_id = v_invite.company_id and m.role = 'staff';
  if v_members >= v_limit then
    raise exception 'This company''s plan has no room for another staff account right now. Please ask the owner.' using errcode = 'P0001';
  end if;

  insert into public.company_members (company_id, user_id, role, view_only, can_see_budget, can_see_client)
  values (v_invite.company_id, v_user, 'staff', v_invite.view_only, v_invite.can_see_budget, v_invite.can_see_client);

  insert into public.project_staff (project_id, user_id, can_see_payments, can_invoice, created_by)
  select ip.project_id, v_user, ip.can_see_payments, ip.can_invoice and ip.can_see_payments, v_invite.created_by
  from public.staff_invite_projects ip
  join public.projects p on p.id = ip.project_id and p.company_id = v_invite.company_id
  where ip.invite_id = v_invite.id;

  update public.staff_invites set accepted_at = now(), accepted_by = v_user where id = v_invite.id;
end;
$$;

-- Which projects a staff member can open, and on which of them they see payments and can invoice.
create function public.set_staff_access(p_user uuid, p_projects uuid[], p_payment_projects uuid[], p_invoice_projects uuid[] default '{}')
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
  perform public.assert_staff_projects(v_company, p_projects, p_payment_projects, p_invoice_projects);

  delete from public.project_staff s
  using public.projects p
  where s.user_id = p_user and p.id = s.project_id and p.company_id = v_company
    and s.project_id <> all (coalesce(p_projects, '{}'));

  insert into public.project_staff (project_id, user_id, can_see_payments, can_invoice, created_by)
  select pid, p_user, pid = any (coalesce(p_payment_projects, '{}')), pid = any (coalesce(p_invoice_projects, '{}')), auth.uid()
  from (select distinct unnest(coalesce(p_projects, '{}')) as pid) x
  on conflict (project_id, user_id)
  do update set can_see_payments = excluded.can_see_payments, can_invoice = excluded.can_invoice;
end;
$$;

-- The person-wide settings: view only, budget, client details, paused.
create function public.set_staff_settings(
  p_user uuid,
  p_view_only boolean,
  p_can_see_budget boolean,
  p_can_see_client boolean,
  p_paused boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.owner_company();
begin
  update public.company_members
  set view_only = coalesce(p_view_only, view_only),
      can_see_budget = coalesce(p_can_see_budget, can_see_budget),
      can_see_client = coalesce(p_can_see_client, can_see_client),
      paused = coalesce(p_paused, paused)
  where company_id = v_company and user_id = p_user and role = 'staff';
  if not found then
    raise exception 'That person isn''t on your team.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.company_team()
returns table (
  kind text,
  member_user_id uuid,
  invite_id uuid,
  name text,
  email text,
  status text,
  since timestamptz,
  expires_at timestamptz,
  view_only boolean,
  can_see_budget boolean,
  can_see_client boolean,
  paused boolean
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
           u.email::text, case when m.paused then 'paused' else 'active' end, m.created_at, null::timestamptz,
           m.view_only, m.can_see_budget, m.can_see_client, m.paused
    from public.company_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles pr on pr.id = m.user_id
    where m.company_id = v_company and m.role = 'staff'
    union all
    select 'invite'::text, null::uuid, i.id, i.name, i.email,
           case when i.expires_at <= now() then 'expired' else 'pending' end,
           i.created_at, i.expires_at, i.view_only, i.can_see_budget, i.can_see_client, false
    from public.staff_invites i
    where i.company_id = v_company and i.accepted_at is null and i.revoked_at is null;
end;
$$;

revoke execute on function
  public.invite_staff(text, text, uuid[], uuid[], uuid[], boolean, boolean, boolean),
  public.set_staff_access(uuid, uuid[], uuid[], uuid[]),
  public.set_staff_settings(uuid, boolean, boolean, boolean, boolean),
  public.company_team()
  from public, anon;
grant execute on function
  public.invite_staff(text, text, uuid[], uuid[], uuid[], boolean, boolean, boolean),
  public.set_staff_access(uuid, uuid[], uuid[], uuid[]),
  public.set_staff_settings(uuid, boolean, boolean, boolean, boolean),
  public.company_team()
  to authenticated;
