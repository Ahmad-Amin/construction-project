-- Stage 5: expenses with receipts.
-- Expenses are hidden from the homeowner unless the owner shares them. Because
-- RLS filters rows, every total a homeowner sees is computed from visible rows only.

create type public.expense_category as enum (
  'material', 'labour', 'transport', 'equipment', 'subcontractor', 'other'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  expense_date date not null default ((now() at time zone 'Asia/Karachi')::date),
  category public.expense_category not null default 'other',
  vendor_note text not null default '',
  receipt_path text,
  client_visible boolean not null default false,
  -- Snapshot of who entered it, so the timeline never needs access to profiles.
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index expenses_project_idx
  on public.expenses (project_id, expense_date desc, created_at desc);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Business rules that must hold no matter which client calls the database.
create function public.expenses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  new.vendor_note = trim(new.vendor_note);

  if new.receipt_path is not null
     and left(new.receipt_path, length(new.project_id::text || '/receipts/' || new.id::text || '/'))
         <> new.project_id::text || '/receipts/' || new.id::text || '/' then
    raise exception 'The receipt was uploaded to the wrong place. Please try again.';
  end if;

  if tg_op = 'INSERT' then
    select nullif(trim(name), '') into v_name from public.profiles where id = auth.uid();
    new.created_by_name = coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');
    -- Only the owner decides what the homeowner sees.
    if not public.is_project_owner(new.project_id) then
      new.client_visible = false;
    end if;
  else
    if new.client_visible is distinct from old.client_visible
       and not public.is_project_owner(new.project_id) then
      raise exception 'Only the company owner can change what the client sees.';
    end if;
  end if;

  return new;
end;
$$;

create trigger expenses_before_write
  before insert or update on public.expenses
  for each row execute function public.expenses_before_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.expenses enable row level security;

create policy "expenses: members read, client reads shared"
  on public.expenses for select to authenticated
  using (
    public.is_project_member(project_id)
    or (client_visible and public.is_project_client(project_id))
  );

create policy "expenses: members add as themselves"
  on public.expenses for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());

create policy "expenses: owner or creator edits"
  on public.expenses for update to authenticated
  using (
    public.is_project_owner(project_id)
    or (public.is_project_member(project_id) and created_by = auth.uid())
  )
  with check (
    public.is_project_owner(project_id)
    or (public.is_project_member(project_id) and created_by = auth.uid())
  );

create policy "expenses: owner deletes"
  on public.expenses for delete to authenticated
  using (public.is_project_owner(project_id));

revoke all on public.expenses from anon, authenticated;
grant select, delete on public.expenses to authenticated;
grant insert (id, project_id, amount, expense_date, category, vendor_note, receipt_path, client_visible)
  on public.expenses to authenticated;
grant update (amount, expense_date, category, vendor_note, receipt_path, client_visible)
  on public.expenses to authenticated;

-- Totals for a project. Runs as the caller, so a homeowner's numbers only
-- ever include the expenses they are allowed to see.
create function public.project_expense_totals(p_project_id uuid)
returns table (total bigint, shared_total bigint, expense_count integer)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(amount), 0)::bigint,
    coalesce(sum(amount) filter (where client_visible), 0)::bigint,
    count(*)::integer
  from public.expenses
  where project_id = p_project_id;
$$;

revoke execute on function public.project_expense_totals(uuid) from public, anon;
grant execute on function public.project_expense_totals(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Receipt files:  <project_id>/receipts/<expense_id>/<file>.jpg
-- Same private bucket as site photos, but a homeowner may only read a receipt
-- whose expense has been shared with them.
-- ---------------------------------------------------------------------------
create function public.storage_path_uuid(p_name text, p_index integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return ((string_to_array(p_name, '/'))[p_index])::uuid;
exception when others then
  return null;
end;
$$;

create function public.can_read_receipt(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses e
    where e.id = public.storage_path_uuid(p_name, 3)
      and e.project_id = public.storage_path_uuid(p_name, 1)
      and (
        public.is_project_member(e.project_id)
        or (e.client_visible and public.is_project_client(e.project_id))
      )
  );
$$;

revoke execute on function
  public.storage_path_uuid(text, integer),
  public.can_read_receipt(text)
from public, anon;
grant execute on function
  public.storage_path_uuid(text, integer),
  public.can_read_receipt(text)
to authenticated;

create policy "project media: members upload receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'receipts'
    and public.is_project_member(public.storage_project_id(name))
  );

create policy "project media: read receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'receipts'
    and public.can_read_receipt(name)
  );

create policy "project media: uploader or owner deletes receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'receipts'
    and (
      owner_id = (select auth.uid())::text
      or public.is_project_owner(public.storage_project_id(name))
    )
  );
