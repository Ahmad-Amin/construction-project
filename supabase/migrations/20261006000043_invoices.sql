-- Invoices. The company owner creates an invoice for a project's homeowner inside BuildPeek, and sends it: the homeowner
-- is told (bell and email) and can open it and download it as a PDF. Everything is enforced here, in the database:
--
--   * only the company owner can create, send, cancel or delete invoices (staff may get a permission for this later:
--     can_manage_invoices() is the one place to change)
--   * invoices are part of the paid plans (Pro and Business)
--   * a draft can be changed freely; a sent invoice is locked. To change it, cancel it and send a new one. A cancelled
--     invoice keeps its number and stays on record.
--   * numbers are given when an invoice is sent, one after another for each company, so deleting drafts leaves no gaps
--   * the totals are worked out here from the lines and the tax rate, never taken from the browser
--   * the homeowner sees sent and cancelled invoices of their own project, never drafts; staff and other companies see none
--
-- Later ("paid" tracking): a payment will be able to point at an invoice (payments.invoice_id), and an invoice's paid
-- amount and "paid / partly paid / overdue" will be worked out from the confirmed payments that point at it. The status
-- below only ever describes the document itself (draft, sent, cancelled), so that can be added without changing it.

-- ---------------------------------------------------------------------------
-- The company's details that are printed on its invoices
-- ---------------------------------------------------------------------------
alter table public.companies
  -- Address, phone, tax number: whatever the owner wants printed under the company name.
  add column invoice_details text not null default '' check (char_length(invoice_details) <= 600),
  -- How to pay: bank account and IBAN, Easypaisa or JazzCash number, and so on.
  add column payment_instructions text not null default '' check (char_length(payment_instructions) <= 600),
  -- The number the next invoice gets when it is sent. Only send_invoice() moves it.
  add column next_invoice_number integer not null default 1 check (next_invoice_number >= 1);

grant update (invoice_details, payment_instructions) on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  -- Given when the invoice is sent.
  number integer,
  issue_date date not null,
  due_date date,
  -- [{ "description": text, "amount": whole currency units }]
  lines jsonb not null default '[]'::jsonb,
  subtotal bigint not null default 0,
  -- An optional tax line: no rate means no tax.
  tax_label text not null default '',
  tax_rate numeric(5, 2),
  tax_amount bigint not null default 0,
  total bigint not null default 0,
  note text not null default '',
  -- The instalment this invoice asks for, if it came from the payment schedule (useful for "paid" tracking later).
  schedule_item_id uuid references public.scheduled_payments (id) on delete set null,
  currency text not null,
  -- What the invoice said when it was sent, so later changes to the company, client or project don't rewrite it.
  company_name text not null default '',
  company_details text not null default '',
  payment_instructions text not null default '',
  client_name text not null default '',
  client_email text not null default '',
  project_name text not null default '',
  project_location text not null default '',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by uuid references auth.users (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text not null default '',
  unique (company_id, number),
  check ((status = 'draft') = (number is null)),
  check (due_date is null or due_date >= issue_date)
);

create index invoices_project_idx on public.invoices (project_id, created_at desc);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;

-- ---------------------------------------------------------------------------
-- Who may do what
-- ---------------------------------------------------------------------------
-- Who can create, send, cancel and delete invoices on a project. Today: the company owner. (A per-project permission
-- for staff can be added here later, for example a column on project_staff.)
create function public.can_manage_invoices(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_project_owner(p_project);
$$;
revoke execute on function public.can_manage_invoices(uuid) from public, anon;
grant execute on function public.can_manage_invoices(uuid) to authenticated;

-- Whether the company that runs this project is on a plan with invoices (Pro or Business). Internal.
create function public.plan_allows_invoices(p_project uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select public.effective_plan(co.plan, co.plan_until) in ('pro', 'business')
     from public.projects p join public.companies co on co.id = p.company_id
     where p.id = p_project),
    false);
$$;
revoke execute on function public.plan_allows_invoices(uuid) from public, anon, authenticated;

create policy "invoices: the owner reads all, the homeowner reads what was sent"
  on public.invoices for select to authenticated
  using (
    public.can_manage_invoices(project_id)
    or (status <> 'draft' and public.is_project_client(project_id))
  );

-- ---------------------------------------------------------------------------
-- A sent invoice can't change, except to be cancelled; only drafts can be deleted. (Nobody can write the table
-- directly: these hold even for the functions below.)
-- ---------------------------------------------------------------------------
create function public.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'A sent invoice can''t be deleted. Cancel it instead.' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'sent') then
      raise exception 'A draft can only be sent or deleted.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'This invoice has been cancelled and can''t be changed.' using errcode = 'P0001';
  end if;

  -- old.status = 'sent': the only change allowed is cancelling it.
  if new.status <> 'cancelled'
     or (new.number, new.issue_date, new.due_date, new.lines, new.subtotal, new.tax_label, new.tax_rate, new.tax_amount,
         new.total, new.note, new.currency, new.company_name, new.company_details, new.payment_instructions,
         new.client_name, new.client_email, new.project_name, new.project_location, new.project_id, new.company_id,
         new.sent_at, new.sent_by, new.schedule_item_id)
        is distinct from
        (old.number, old.issue_date, old.due_date, old.lines, old.subtotal, old.tax_label, old.tax_rate, old.tax_amount,
         old.total, old.note, old.currency, old.company_name, old.company_details, old.payment_instructions,
         old.client_name, old.client_email, old.project_name, old.project_location, old.project_id, old.company_id,
         old.sent_at, old.sent_by, old.schedule_item_id) then
    raise exception 'A sent invoice can''t be changed. Cancel it and send a new one.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger invoices_guard
  before update or delete on public.invoices
  for each row execute function public.invoices_guard();

-- ---------------------------------------------------------------------------
-- Creating and editing a draft
-- ---------------------------------------------------------------------------
-- Creates the draft (when p_id is new) or changes it (when p_id is an existing draft of this project). The id comes from
-- the browser, so saving twice never makes two invoices. Returns the id.
create function public.save_invoice(
  p_id uuid,
  p_project uuid,
  p_issue_date date,
  p_due_date date,
  p_lines jsonb,
  p_tax_label text,
  p_tax_rate numeric,
  p_note text,
  p_schedule_item uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_currency text;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_desc text;
  v_amount numeric;
  v_subtotal bigint := 0;
  v_tax_rate numeric := p_tax_rate;
  v_tax_label text := trim(coalesce(p_tax_label, ''));
  v_tax bigint := 0;
  v_existing public.invoices;
begin
  if p_id is null or p_project is null then
    raise exception 'Something is missing. Please try again.' using errcode = 'P0001';
  end if;
  if not public.can_manage_invoices(p_project) then
    raise exception 'Only the company owner can create invoices.' using errcode = 'P0001';
  end if;
  if not public.plan_allows_invoices(p_project) then
    raise exception 'Invoices are part of the Pro and Business plans.' using errcode = 'P0001';
  end if;

  if p_issue_date is null then
    raise exception 'Please choose the invoice date.' using errcode = 'P0001';
  end if;
  if p_due_date is not null and p_due_date < p_issue_date then
    raise exception 'The due date can''t be before the invoice date.' using errcode = 'P0001';
  end if;

  -- The lines: one to fifty, each with a description and an amount in whole currency units.
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Please add at least one line.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_lines) > 50 then
    raise exception 'Please keep an invoice to 50 lines or fewer.' using errcode = 'P0001';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(v_line) <> 'object' or jsonb_typeof(v_line -> 'amount') <> 'number' then
      raise exception 'Each line needs a description and an amount.' using errcode = 'P0001';
    end if;
    v_desc := trim(coalesce(v_line ->> 'description', ''));
    v_amount := (v_line ->> 'amount')::numeric;
    if char_length(v_desc) = 0 then
      raise exception 'Each line needs a description.' using errcode = 'P0001';
    end if;
    if char_length(v_desc) > 200 then
      raise exception 'Please keep each line''s description under 200 characters.' using errcode = 'P0001';
    end if;
    if v_amount <> trunc(v_amount) or v_amount <= 0 or v_amount > 1000000000000 then
      raise exception 'Each line needs an amount above zero, in whole units.' using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_amount::bigint;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('description', v_desc, 'amount', v_amount::bigint));
  end loop;
  if v_subtotal > 1000000000000 then
    raise exception 'That total is too large.' using errcode = 'P0001';
  end if;

  -- The optional tax line.
  if v_tax_rate is not null then
    if v_tax_rate <= 0 or v_tax_rate > 100 or v_tax_rate <> round(v_tax_rate, 2) then
      raise exception 'Please enter a tax rate between 0 and 100, with up to two decimals.' using errcode = 'P0001';
    end if;
    if v_tax_label = '' then
      v_tax_label := 'Tax';
    end if;
    if char_length(v_tax_label) > 40 then
      raise exception 'Please keep the tax name under 40 characters.' using errcode = 'P0001';
    end if;
    v_tax := round(v_subtotal * v_tax_rate / 100)::bigint;
  else
    v_tax_label := '';
  end if;

  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Please keep the note under 1,000 characters.' using errcode = 'P0001';
  end if;

  if p_schedule_item is not null
     and not exists (select 1 from public.scheduled_payments s where s.id = p_schedule_item and s.project_id = p_project) then
    raise exception 'That instalment isn''t part of this project.' using errcode = 'P0001';
  end if;

  select p.company_id, co.currency into v_company, v_currency
  from public.projects p join public.companies co on co.id = p.company_id
  where p.id = p_project;

  select * into v_existing from public.invoices where id = p_id for update;
  if found then
    if v_existing.project_id <> p_project then
      raise exception 'That invoice belongs to another project.' using errcode = 'P0001';
    end if;
    if v_existing.status <> 'draft' then
      raise exception 'A sent invoice can''t be changed. Cancel it and send a new one.' using errcode = 'P0001';
    end if;
    update public.invoices
    set issue_date = p_issue_date, due_date = p_due_date, lines = v_lines, subtotal = v_subtotal,
        tax_label = v_tax_label, tax_rate = v_tax_rate, tax_amount = v_tax, total = v_subtotal + v_tax,
        note = trim(coalesce(p_note, '')), schedule_item_id = p_schedule_item, currency = v_currency
    where id = p_id;
  else
    insert into public.invoices
      (id, company_id, project_id, issue_date, due_date, lines, subtotal, tax_label, tax_rate, tax_amount, total, note,
       schedule_item_id, currency, created_by)
    values
      (p_id, v_company, p_project, p_issue_date, p_due_date, v_lines, v_subtotal, v_tax_label, v_tax_rate, v_tax,
       v_subtotal + v_tax, trim(coalesce(p_note, '')), p_schedule_item, v_currency, auth.uid());
  end if;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sending: the invoice gets its number, is locked, and the homeowner is told
-- ---------------------------------------------------------------------------
create function public.send_invoice(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_number integer;
  v_company public.companies;
  v_project public.projects;
  v_client public.clients;
begin
  select * into v_invoice from public.invoices where id = p_id for update;
  if not found or not public.can_manage_invoices(v_invoice.project_id) then
    raise exception 'Only the company owner can send invoices.' using errcode = 'P0001';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'This invoice has already been sent.' using errcode = 'P0001';
  end if;
  if not public.plan_allows_invoices(v_invoice.project_id) then
    raise exception 'Invoices are part of the Pro and Business plans.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_invoice.lines) = 0 or v_invoice.total <= 0 then
    raise exception 'Please add at least one line before sending.' using errcode = 'P0001';
  end if;

  -- The next number for this company. Updating the company row locks it, so two invoices sent at the same moment
  -- still get different numbers.
  update public.companies
  set next_invoice_number = next_invoice_number + 1
  where id = v_invoice.company_id
  returning next_invoice_number - 1 into v_number;

  select * into v_company from public.companies where id = v_invoice.company_id;
  select * into v_project from public.projects where id = v_invoice.project_id;
  select * into v_client from public.clients where id = v_project.client_id;

  update public.invoices
  set status = 'sent', number = v_number, sent_at = now(), sent_by = auth.uid(),
      currency = v_company.currency,
      company_name = v_company.name, company_details = v_company.invoice_details,
      payment_instructions = v_company.payment_instructions,
      client_name = coalesce(v_client.name, ''), client_email = coalesce(v_client.email, ''),
      project_name = v_project.name, project_location = coalesce(v_project.location, '')
  where id = p_id;

  -- The homeowner is told (bell and email), once they have an account.
  if v_client.user_id is not null then
    perform public.notify(
      v_client.user_id,
      auth.uid(),
      v_invoice.project_id,
      'invoice_sent',
      v_company.name || ' sent you invoice INV-' || lpad(v_number::text, 4, '0'),
      'Total ' || public.format_money(v_invoice.total, v_invoice.project_id)
        || case when v_invoice.due_date is not null then ', due ' || to_char(v_invoice.due_date, 'FMDD Mon YYYY') else '' end
        || ', for ' || v_project.name || '.',
      '/dashboard/projects/' || v_invoice.project_id::text || '/invoices/' || p_id::text
    );
  end if;

  return v_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling a sent invoice (it keeps its number) and deleting a draft
-- ---------------------------------------------------------------------------
create function public.cancel_invoice(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_client_user uuid;
begin
  select * into v_invoice from public.invoices where id = p_id for update;
  if not found or not public.can_manage_invoices(v_invoice.project_id) then
    raise exception 'Only the company owner can cancel invoices.' using errcode = 'P0001';
  end if;
  if v_invoice.status <> 'sent' then
    raise exception 'Only a sent invoice can be cancelled.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_reason, '')) > 300 then
    raise exception 'Please keep the reason under 300 characters.' using errcode = 'P0001';
  end if;

  update public.invoices
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(coalesce(p_reason, ''))
  where id = p_id;

  select c.user_id into v_client_user
  from public.projects p join public.clients c on c.id = p.client_id
  where p.id = v_invoice.project_id;
  if v_client_user is not null then
    perform public.notify(
      v_client_user,
      auth.uid(),
      v_invoice.project_id,
      'invoice_cancelled',
      'Invoice INV-' || lpad(v_invoice.number::text, 4, '0') || ' was cancelled',
      coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'You don''t need to pay it.')
        || ' It stays in your records on ' || v_invoice.project_name || '.',
      '/dashboard/projects/' || v_invoice.project_id::text || '/invoices/' || p_id::text
    );
  end if;
end;
$$;

create function public.delete_invoice_draft(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_id for update;
  if not found or not public.can_manage_invoices(v_invoice.project_id) then
    raise exception 'Only the company owner can delete invoices.' using errcode = 'P0001';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'A sent invoice can''t be deleted. Cancel it instead.' using errcode = 'P0001';
  end if;
  delete from public.invoices where id = p_id;
end;
$$;

revoke execute on function
  public.save_invoice(uuid, uuid, date, date, jsonb, text, numeric, text, uuid),
  public.send_invoice(uuid),
  public.cancel_invoice(uuid, text),
  public.delete_invoice_draft(uuid)
  from public, anon;
grant execute on function
  public.save_invoice(uuid, uuid, date, date, jsonb, text, numeric, text, uuid),
  public.send_invoice(uuid),
  public.cancel_invoice(uuid, text),
  public.delete_invoice_draft(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- A project with sent invoices is a financial record: archive it rather than delete it.
-- ---------------------------------------------------------------------------
create or replace function public.delete_project_blocker(p_project_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.projects where id = p_project_id;
  if v_company is null then
    return 'Project not found.';
  end if;
  if not public.is_company_owner(v_company) then
    return 'Only the company owner can delete a project.';
  end if;
  if exists (
    select 1 from public.payments
    where project_id = p_project_id and status = 'confirmed'
  ) then
    return 'This project has confirmed payments. Your client has agreed to those records, so it can''t be deleted. Archive it instead.';
  end if;
  if exists (select 1 from public.invoices where project_id = p_project_id and status <> 'draft') then
    return 'This project has invoices you sent to your client, so it can''t be deleted. Archive it instead.';
  end if;
  return null;
end;
$$;
