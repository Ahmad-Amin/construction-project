-- Stage 6: payments received from the client.
-- This only records money; it never processes it.
-- Only the company owner records payments. The homeowner can see all of them.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  amount bigint not null check (amount > 0 and amount <= 1000000000000),
  payment_date date not null default ((now() at time zone 'Asia/Karachi')::date),
  reference text not null default '',
  note text not null default '',
  -- Snapshot of who recorded it, so the timeline never needs access to profiles.
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index payments_project_idx
  on public.payments (project_id, payment_date desc, created_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create function public.payments_before_write()
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

  if tg_op = 'INSERT' then
    select nullif(trim(name), '') into v_name from public.profiles where id = auth.uid();
    new.created_by_name = coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');
  end if;
  return new;
end;
$$;

create trigger payments_before_write
  before insert or update on public.payments
  for each row execute function public.payments_before_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;

create policy "payments: members and own client read"
  on public.payments for select to authenticated
  using (public.is_project_member(project_id) or public.is_project_client(project_id));

create policy "payments: owner records as themselves"
  on public.payments for insert to authenticated
  with check (public.is_project_owner(project_id) and created_by = auth.uid());

create policy "payments: owner edits"
  on public.payments for update to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "payments: owner deletes"
  on public.payments for delete to authenticated
  using (public.is_project_owner(project_id));

revoke all on public.payments from anon, authenticated;
grant select, delete on public.payments to authenticated;
grant insert (id, project_id, amount, payment_date, reference, note) on public.payments to authenticated;
grant update (amount, payment_date, reference, note) on public.payments to authenticated;

-- Runs as the caller, so the total only covers payments they may see.
create function public.project_payment_totals(p_project_id uuid)
returns table (total bigint, payment_count integer)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::bigint, count(*)::integer
  from public.payments
  where project_id = p_project_id;
$$;

revoke execute on function public.project_payment_totals(uuid) from public, anon;
grant execute on function public.project_payment_totals(uuid) to authenticated;
