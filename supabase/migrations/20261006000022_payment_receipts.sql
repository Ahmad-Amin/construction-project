-- Optional proof of payment: a photo of the bank transfer, cheque or receipt, attached to a
-- payment by whoever records it. Both sides can see it (a payment is a shared record), and it
-- is locked together with the payment once it is confirmed.
--
-- Files live in the same private bucket:  <project_id>/payments/<payment_id>/<file>.jpg

alter table public.payments add column receipt_path text;
grant insert (receipt_path) on public.payments to authenticated;
grant update (receipt_path) on public.payments to authenticated;

-- Same rules as before, plus: the file must be in this payment's own folder, and adding,
-- replacing or removing the proof sends the payment back to the other side to look at again.
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
    -- Changing what was paid (or the proof of it) means the other side has to look at it again.
    if (new.amount, new.payment_date, new.reference, new.note, new.receipt_path)
       is distinct from (old.amount, old.payment_date, old.reference, old.note, old.receipt_path) then
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

-- Both sides of a project may read a payment's receipt, once the payment exists.
create function public.can_read_payment_receipt(p_name text)
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
      and (public.is_project_member(p.project_id) or public.is_project_client(p.project_id))
  );
$$;

revoke execute on function public.can_read_payment_receipt(text) from public, anon;
grant execute on function public.can_read_payment_receipt(text) to authenticated;

-- Whoever can record a payment (the owner or the homeowner) can upload its receipt.
create policy "project media: payers upload payment receipts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'payments'
    and (
      public.is_project_owner(public.storage_project_id(name))
      or public.is_project_client(public.storage_project_id(name))
    )
  );

create policy "project media: read payment receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'payments'
    and public.can_read_payment_receipt(name)
  );

create policy "project media: uploader or owner deletes payment receipts"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'payments'
    and (
      owner_id = (select auth.uid())::text
      or public.is_project_owner(public.storage_project_id(name))
    )
  );
