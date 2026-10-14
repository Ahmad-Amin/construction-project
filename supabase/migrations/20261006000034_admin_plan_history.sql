-- The admin page's History tab: every plan change, newest first. Service role only, like the other
-- admin functions (the server checks who is asking before it calls this).
-- A running number, so two changes made in the same instant still sort in the order they happened.
alter table public.plan_changes add column seq bigint generated always as identity;

create function public.admin_plan_history(p_limit integer default 200)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(h order by h.created_at desc, h.seq desc), '[]'::jsonb)
  from (
    select ch.id, ch.company_id, co.name as company_name, ch.old_plan, ch.old_until, ch.new_plan, ch.new_until,
           ch.changed_by, ch.created_at, ch.seq
    from public.plan_changes ch
    join public.companies co on co.id = ch.company_id
    order by ch.created_at desc, ch.seq desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500)
  ) h;
$$;

revoke execute on function public.admin_plan_history(integer) from public, anon, authenticated;
grant execute on function public.admin_plan_history(integer) to service_role;
