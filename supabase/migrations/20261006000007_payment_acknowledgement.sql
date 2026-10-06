-- Two-sided payments: either the contractor or the homeowner records a payment,
-- and the other side confirms it (or disputes it with a reason).
-- Who responded, when, and any dispute reason are kept on the payment.

create type public.payment_side as enum ('contractor', 'client');
create type public.payment_status as enum ('pending', 'confirmed', 'disputed');

alter table public.payments
  add column side public.payment_side not null default 'contractor',
  add column status public.payment_status not null default 'pending',
  add column edited boolean not null default false,
  add column responded_by uuid references auth.users (id),
  add column responded_by_name text not null default '',
  add column responded_at timestamptz,
  add column dispute_reason text;

alter table public.payments
  add constraint payments_response_consistent check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  );

-- ---------------------------------------------------------------------------
-- Rules enforced on every write, whichever client made the request.
-- ---------------------------------------------------------------------------
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
    -- Changing what was paid means the other side has to look at it again.
    if (new.amount, new.payment_date, new.reference, new.note)
       is distinct from (old.amount, old.payment_date, old.reference, old.note) then
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

-- ---------------------------------------------------------------------------
-- RLS: either side records; only the recorder edits or deletes, and only
-- until the other side has confirmed it. Confirmed payments are locked.
-- ---------------------------------------------------------------------------
drop policy "payments: owner records as themselves" on public.payments;
drop policy "payments: owner edits" on public.payments;
drop policy "payments: owner deletes" on public.payments;

create policy "payments: either side records as themselves"
  on public.payments for insert to authenticated
  with check (
    (public.is_project_owner(project_id) or public.is_project_client(project_id))
    and created_by = auth.uid()
  );

create policy "payments: recorder edits until confirmed"
  on public.payments for update to authenticated
  using (
    created_by = auth.uid()
    and status <> 'confirmed'
    and (public.is_project_owner(project_id) or public.is_project_client(project_id))
  )
  with check (
    created_by = auth.uid()
    and (public.is_project_owner(project_id) or public.is_project_client(project_id))
  );

create policy "payments: recorder deletes until confirmed"
  on public.payments for delete to authenticated
  using (
    created_by = auth.uid()
    and status <> 'confirmed'
    and (public.is_project_owner(project_id) or public.is_project_client(project_id))
  );

-- ---------------------------------------------------------------------------
-- Responding. Status and response columns are not writable directly; this
-- function is the only way, and only the opposite side may call it.
-- ---------------------------------------------------------------------------
create function public.respond_to_payment(
  p_payment_id uuid,
  p_action text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_allowed boolean;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;
  if p_action not in ('confirm', 'dispute') then
    raise exception 'Please choose confirm or dispute.';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found then
    raise exception 'Payment not found.';
  end if;

  -- The recorder can't mark their own entry as agreed.
  if v_payment.side = 'contractor' then
    v_allowed := public.is_project_client(v_payment.project_id);
  else
    v_allowed := public.is_project_owner(v_payment.project_id);
  end if;
  if not v_allowed then
    raise exception 'Only the other party can respond to this payment.';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'This payment has already been responded to.';
  end if;
  if p_action = 'dispute' and char_length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Please say why you disagree with this payment.';
  end if;
  if char_length(coalesce(p_reason, '')) > 300 then
    raise exception 'Please keep the reason under 300 characters.';
  end if;

  select nullif(trim(name), '') into v_name from public.profiles where id = auth.uid();
  v_name := coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');

  update public.payments
  set status = case when p_action = 'confirm' then 'confirmed'::public.payment_status
                    else 'disputed'::public.payment_status end,
      responded_by = auth.uid(),
      responded_by_name = v_name,
      responded_at = now(),
      dispute_reason = case when p_action = 'dispute' then trim(p_reason) else null end
  where id = p_payment_id;
end;
$$;

revoke execute on function public.respond_to_payment(uuid, text, text) from public, anon;
grant execute on function public.respond_to_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Totals: only confirmed payments count toward "received". Runs as the caller.
-- ---------------------------------------------------------------------------
drop function public.project_payment_totals(uuid);

create function public.project_payment_totals(p_project_id uuid)
returns table (
  confirmed_total bigint,
  confirmed_count integer,
  pending_total bigint,
  pending_count integer,
  disputed_count integer,
  awaiting_client_count integer,
  awaiting_owner_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(amount) filter (where status = 'confirmed'), 0)::bigint,
    (count(*) filter (where status = 'confirmed'))::integer,
    coalesce(sum(amount) filter (where status = 'pending'), 0)::bigint,
    (count(*) filter (where status = 'pending'))::integer,
    (count(*) filter (where status = 'disputed'))::integer,
    -- pending payments the homeowner still has to answer (recorded by the contractor)
    (count(*) filter (where status = 'pending' and side = 'contractor'))::integer,
    -- pending payments the owner still has to answer (recorded by the homeowner)
    (count(*) filter (where status = 'pending' and side = 'client'))::integer
  from public.payments
  where project_id = p_project_id;
$$;

revoke execute on function public.project_payment_totals(uuid) from public, anon;
grant execute on function public.project_payment_totals(uuid) to authenticated;
