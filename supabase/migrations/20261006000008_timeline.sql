-- Stage 7: one chronological feed for a project.
-- Runs as the caller (not security definer), so row-level security still decides
-- what each person sees. A homeowner's feed can never contain a hidden expense.
-- Expenses that were not shared with the client are left out for everyone, so
-- the feed always matches what the homeowner sees.

create function public.project_timeline(p_project_id uuid, p_limit integer default 30)
returns table (
  kind text,
  item_id uuid,
  event_date date,
  occurred_at timestamptz,
  actor_name text,
  title text,
  detail text,
  amount bigint,
  status text,
  side text
)
language sql
stable
set search_path = ''
as $$
  select t.kind, t.item_id, t.event_date, t.occurred_at, t.actor_name,
         t.title, t.detail, t.amount, t.status, t.side
  from (
    -- Site updates
    select 'update'::text as kind,
           u.id as item_id,
           u.update_date as event_date,
           u.created_at as occurred_at,
           u.author_name as actor_name,
           u.text as title,
           m.name as detail,
           null::bigint as amount,
           null::text as status,
           null::text as side
    from public.project_updates u
    left join public.milestones m on m.id = u.milestone_id
    where u.project_id = p_project_id

    union all

    -- Expenses shared with the client
    select 'expense', e.id, e.expense_date, e.created_at, e.created_by_name,
           e.vendor_note, e.category::text, e.amount, null::text, null::text
    from public.expenses e
    where e.project_id = p_project_id and e.client_visible

    union all

    -- Payments as recorded
    select 'payment', p.id, p.payment_date, p.created_at, p.created_by_name,
           p.reference, p.note, p.amount, p.status::text, p.side::text
    from public.payments p
    where p.project_id = p_project_id

    union all

    -- The other side's confirmation or dispute, at the moment it happened
    select 'payment_response', p.id,
           (p.responded_at at time zone 'Asia/Karachi')::date,
           p.responded_at, p.responded_by_name,
           p.dispute_reason, null::text, p.amount, p.status::text, p.side::text
    from public.payments p
    where p.project_id = p_project_id and p.responded_at is not null
  ) t
  order by t.event_date desc, t.occurred_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 200);
$$;

revoke execute on function public.project_timeline(uuid, integer) from public, anon;
grant execute on function public.project_timeline(uuid, integer) to authenticated;
