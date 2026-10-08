-- The weekly summary is opt-in: nothing goes to any client until the contractor turns it on
-- for their company (Settings). Projects keep their own pause switch on top of this.
alter table public.companies add column weekly_summary boolean not null default false;
grant update (weekly_summary) on public.companies to authenticated;

create or replace function public.create_weekly_summaries()
returns table (out_notification_id uuid, out_to_email text, out_project_id uuid, out_summary jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_since timestamptz;
  v_summary jsonb;
  v_id uuid;
  v_body text;
  v_updates integer;
  v_finished integer;
  v_paid integer;
  v_awaiting integer;
  v_email boolean;
begin
  for r in
    select p.id as pid, p.name as pname, p.last_summary_at, c.user_id as cuser,
           u.email as cemail, coalesce(pr.email_notifications, true) as wants_email
    from public.projects p
    join public.companies co on co.id = p.company_id
    join public.clients c on c.id = p.client_id
    join auth.users u on u.id = c.user_id
    left join public.profiles pr on pr.id = c.user_id
    where co.weekly_summary
      and p.status = 'active'
      and p.archived_at is null
      and p.weekly_summary
      and coalesce(pr.weekly_summary, true)
      and (p.last_summary_at is null or p.last_summary_at <= now() - interval '6 days')
    order by p.id
    for update of p skip locked
  loop
    -- Never reach back further than a week, even after a long quiet spell.
    v_since := greatest(coalesce(r.last_summary_at, '-infinity'::timestamptz), now() - interval '7 days');
    v_summary := public.build_weekly_summary(r.pid, v_since);

    v_updates := (v_summary ->> 'update_count')::integer;
    v_finished := jsonb_array_length(v_summary -> 'finished');
    v_paid := (v_summary ->> 'paid_count')::integer;
    v_awaiting := (v_summary ->> 'awaiting_count')::integer;
    continue when not (v_summary ->> 'has_activity')::boolean and v_awaiting = 0;

    v_body := (v_summary ->> 'progress') || '% complete'
      || case when v_updates > 0 then ' · ' || v_updates || case when v_updates = 1 then ' site update' else ' site updates' end else '' end
      || case when v_finished > 0 then ' · ' || v_finished || case when v_finished = 1 then ' stage finished' else ' stages finished' end else '' end
      || case when v_paid > 0 then ' · ' || v_paid || case when v_paid = 1 then ' payment confirmed' else ' payments confirmed' end else '' end
      || case when v_awaiting > 0 then ' · ' || v_awaiting || case when v_awaiting = 1 then ' payment waits for you' else ' payments wait for you' end else '' end;

    v_email := r.wants_email and r.cemail is not null;

    insert into public.notifications
      (user_id, actor_id, project_id, kind, title, body, link, recipient_email, email_status)
    values
      (r.cuser, null, r.pid, 'weekly_summary',
       'Your weekly update on ' || r.pname, v_body,
       '/dashboard/projects/' || r.pid::text,
       r.cemail, case when v_email then 'pending' else 'skipped' end)
    returning id into v_id;

    update public.projects set last_summary_at = now() where id = r.pid;

    if v_email then
      out_notification_id := v_id;
      out_to_email := r.cemail;
      out_project_id := r.pid;
      out_summary := v_summary;
      return next;
    end if;
  end loop;
end;
$$;
