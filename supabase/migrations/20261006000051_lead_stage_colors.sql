-- Lead stages get a colour, from a palette of twelve, which the owner can change (Settings → Leads). Every stage starts
-- with one: the four default stages in four different colours, and a stage added later in a colour the company isn't
-- using yet, picked at random. The palette's names are the app's (src/lib/leads.ts, STAGE_COLORS); keep the two in step.

alter table public.lead_stages
  add column color text not null default 'slate'
  check (color in ('sky', 'violet', 'amber', 'emerald', 'rose', 'teal', 'indigo', 'lime', 'pink', 'orange', 'slate', 'stone'));

-- Stages that already exist: a different colour each, in their order.
update public.lead_stages s
set color = (array['sky', 'violet', 'amber', 'emerald', 'rose', 'teal', 'indigo', 'lime', 'pink', 'orange', 'slate', 'stone'])[((o.ord - 1) % 12) + 1]
from (select id, row_number() over (partition by company_id order by position, created_at) as ord from public.lead_stages) as o
where s.id = o.id;

-- New companies: the four stages in four colours.
create or replace function public.companies_seed_lead_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_stages (company_id, name, position, color)
  values (new.id, 'New', 1, 'sky'), (new.id, 'Contacted', 2, 'violet'), (new.id, 'Site visit', 3, 'amber'), (new.id, 'Quote sent', 4, 'emerald');
  return null;
end;
$$;

-- A new stage: a colour the company isn't using yet, picked at random (any colour once all twelve are taken).
create or replace function public.add_lead_stage(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
  v_palette text[] := array['sky', 'violet', 'amber', 'emerald', 'rose', 'teal', 'indigo', 'lime', 'pink', 'orange', 'slate', 'stone'];
  v_name text;
  v_color text;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 3));
  v_name := public.check_lead_stage_name(v_company, p_name, null);
  if (select count(*) from public.lead_stages s where s.company_id = v_company) >= 12 then
    raise exception 'You can have up to 12 stages.' using errcode = 'P0001';
  end if;
  select c into v_color
  from unnest(v_palette) as c
  where c not in (select s.color from public.lead_stages s where s.company_id = v_company)
  order by random()
  limit 1;
  insert into public.lead_stages (company_id, name, position, color)
  values (v_company, v_name, coalesce((select max(s.position) from public.lead_stages s where s.company_id = v_company), 0) + 1,
          coalesce(v_color, v_palette[1 + floor(random() * 12)::integer]))
  returning id into v_id;
  return v_id;
end;
$$;

-- The owner picks a stage's colour.
create function public.set_lead_stage_color(p_stage uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := public.lead_owner_company();
begin
  if p_color is null or p_color not in ('sky', 'violet', 'amber', 'emerald', 'rose', 'teal', 'indigo', 'lime', 'pink', 'orange', 'slate', 'stone') then
    raise exception 'Please choose one of the colours.' using errcode = 'P0001';
  end if;
  update public.lead_stages set color = p_color where id = p_stage and company_id = v_company;
  if not found then
    raise exception 'That stage isn''t one of your company''s.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.set_lead_stage_color(uuid, text) from public, anon;
grant execute on function public.set_lead_stage_color(uuid, text) to authenticated;
