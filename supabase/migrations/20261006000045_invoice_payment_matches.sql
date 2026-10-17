-- A payment for an invoice pays all of it: its amount must be exactly what is left to pay on the invoice (the total, less
-- confirmed payments for it). So an invoice can have only one payment waiting for confirmation at a time; once that is
-- confirmed the invoice is paid, and if it is disputed it can be corrected or replaced.
--
-- Checked whenever a payment for an invoice is waiting for confirmation: when it is recorded, and when it is changed
-- (which sends it back for confirmation). Confirming or disputing a payment is not checked again. A payment for an
-- invoice that was cancelled later is left alone: the invoice no longer decides its amount.

create or replace function public.payments_check_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_paid bigint;
begin
  if new.invoice_id is null or new.status <> 'pending' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and (new.invoice_id, new.amount, new.status) is not distinct from (old.invoice_id, old.amount, old.status) then
    return new;
  end if;

  -- The lock makes two payments recorded for the same invoice at the same moment wait for each other.
  select * into v_invoice from public.invoices where id = new.invoice_id for update;
  if not found or v_invoice.project_id <> new.project_id then
    raise exception 'That invoice isn''t part of this project.' using errcode = 'P0001';
  end if;
  if v_invoice.status <> 'sent' then
    if tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id then
      raise exception 'A payment can only be for an invoice that was sent (not a draft or a cancelled one).' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if exists (
    select 1 from public.payments p
    where p.invoice_id = new.invoice_id and p.id <> new.id and p.status = 'pending'
  ) then
    raise exception 'A payment for this invoice is already waiting for confirmation.' using errcode = 'P0001';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
  from public.payments p
  where p.invoice_id = new.invoice_id and p.id <> new.id and p.status = 'confirmed';
  if v_paid >= v_invoice.total then
    raise exception 'This invoice is already paid.' using errcode = 'P0001';
  end if;
  if new.amount <> v_invoice.total - v_paid then
    raise exception 'A payment for this invoice must be for %, the amount left to pay on it.',
      public.format_money(v_invoice.total - v_paid, new.project_id)
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Now also when the amount changes, or a disputed payment is sent back for confirmation. It runs after
-- payments_before_write (triggers run in name order), so it sees the status that one has set.
drop trigger payments_check_invoice on public.payments;
create trigger payments_check_invoice
  before insert or update on public.payments
  for each row execute function public.payments_check_invoice();
