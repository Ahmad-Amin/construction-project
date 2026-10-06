-- 1. "Edited" on expenses means the record's content changed, not that it was shared or hidden.
--    (It used to be guessed from timestamps, so sharing an expense wrongly marked it "Edited".)
-- 2. Remember when a contractor hides the "Get started" checklist.

alter table public.expenses add column edited boolean not null default false;

create or replace function public.expenses_before_write()
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
    new.edited = false;
    -- Only the owner decides what the homeowner sees.
    if not public.is_project_owner(new.project_id) then
      new.client_visible = false;
    end if;
  else
    if new.client_visible is distinct from old.client_visible
       and not public.is_project_owner(new.project_id) then
      raise exception 'Only the company owner can change what the client sees.';
    end if;
    -- Sharing or hiding is not an edit. Changing what was recorded is.
    if (new.amount, new.expense_date, new.category, new.vendor_note, new.receipt_path)
       is distinct from (old.amount, old.expense_date, old.category, old.vendor_note, old.receipt_path) then
      new.edited = true;
    else
      new.edited = old.edited;
    end if;
  end if;

  return new;
end;
$$;

alter table public.profiles add column getting_started_dismissed_at timestamptz;
grant update (getting_started_dismissed_at) on public.profiles to authenticated;
