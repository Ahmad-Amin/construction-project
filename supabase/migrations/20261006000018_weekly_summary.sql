-- Weekly summary: every Sunday the homeowner gets one email (and one bell notification) per
-- project with the week's progress, photos and payments, without the contractor doing anything.
--
-- Nobody is "acting" when this runs, so it is built by a scheduled job that uses the service
-- role. The privacy rule lives HERE, in build_weekly_summary(): it reads only what the client
-- is already allowed to see (no expenses, no hidden budget), so a mistake in the app code
-- cannot leak anything the database does not hand over.

-- Each homeowner can switch the summary off; so can the contractor, per project.
alter table public.profiles add column weekly_summary boolean not null default true;
grant update (weekly_summary) on public.profiles to authenticated;

alter table public.projects
  add column weekly_summary boolean not null default true,
  add column last_summary_at timestamptz;
grant update (weekly_summary) on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- What the client sees for the week. Internal: only the two functions below call it.
-- ---------------------------------------------------------------------------
create function public.build_weekly_summary(p_project uuid, p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_update_count integer;
  v_finished jsonb;
  v_paid_count integer;
  v_awaiting_count integer;
begin
  select count(*) into v_update_count
  from public.project_updates u
  where u.project_id = p_project and u.created_at >= p_since;

  select coalesce(jsonb_agg(m.name order by m.position), '[]'::jsonb) into v_finished
  from public.milestones m
  where m.project_id = p_project and m.status = 'done' and m.updated_at >= p_since;

  select count(*) into v_paid_count
  from public.payments pay
  where pay.project_id = p_project and pay.status = 'confirmed' and pay.responded_at >= p_since;

  select count(*) into v_awaiting_count
  from public.payments pay
  where pay.project_id = p_project and pay.status = 'pending' and pay.side = 'contractor';

  select jsonb_build_object(
    'project_id', p.id,
    'project_name', p.name,
    'company_name', co.name,
    'company_logo', co.logo_url,
    'client_name', c.name,
    'since', p_since,
    'progress', coalesce(
      (select round(avg(m.progress_percent))::integer from public.milestones m where m.project_id = p.id), 0),
    'stages', coalesce(
      (select jsonb_agg(jsonb_build_object('name', s.name, 'percent', s.progress_percent) order by s.position)
       from (select name, progress_percent, position from public.milestones
             where project_id = p.id order by position limit 8) s),
      '[]'::jsonb),
    'finished', v_finished,
    'update_count', v_update_count,
    'updates', coalesce(
      (select jsonb_agg(jsonb_build_object('date', r.update_date, 'text', left(r.text, 240), 'author', r.author_name)
                        order by r.created_at desc)
       from (select update_date, text, author_name, created_at from public.project_updates
             where project_id = p.id and created_at >= p_since
             order by created_at desc limit 3) r),
      '[]'::jsonb),
    'photo_count', (select count(*) from public.project_photos ph
                    where ph.project_id = p.id and ph.created_at >= p_since),
    'photos', coalesce(
      (select jsonb_agg(x.path order by x.created_at desc)
       from (select coalesce(thumb_path, storage_path) as path, created_at from public.project_photos
             where project_id = p.id and created_at >= p_since
             order by created_at desc limit 4) x),
      '[]'::jsonb),
    'paid_count', v_paid_count,
    'paid_this_week', coalesce(
      (select jsonb_agg(jsonb_build_object('amount', y.amount, 'date', y.payment_date) order by y.responded_at desc)
       from (select amount, payment_date, responded_at from public.payments
             where project_id = p.id and status = 'confirmed' and responded_at >= p_since
             order by responded_at desc limit 5) y),
      '[]'::jsonb),
    'paid_this_week_total', coalesce(
      (select sum(amount) from public.payments
       where project_id = p.id and status = 'confirmed' and responded_at >= p_since), 0),
    'paid_total', coalesce(
      (select sum(amount) from public.payments where project_id = p.id and status = 'confirmed'), 0),
    'awaiting_count', v_awaiting_count,
    'awaiting_total', coalesce(
      (select sum(amount) from public.payments
       where project_id = p.id and status = 'pending' and side = 'contractor'), 0),
    -- Only when the contractor chose to share the budget.
    'budget', (select b.amount from public.project_budgets b
               where b.project_id = p.id and b.visible_to_client),
    'has_activity', (v_update_count > 0 or jsonb_array_length(v_finished) > 0 or v_paid_count > 0)
  )
  into v_summary
  from public.projects p
  join public.companies co on co.id = p.company_id
  join public.clients c on c.id = p.client_id
  where p.id = p_project;

  return v_summary;
end;
$$;

revoke execute on function public.build_weekly_summary(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The owner can send the summary to themselves to see exactly what the client will get.
-- ---------------------------------------------------------------------------
create function public.preview_weekly_summary(p_project uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_project_owner(p_project) then
    raise exception 'Only the company owner can preview the weekly summary.';
  end if;
  return public.build_weekly_summary(p_project, now() - interval '7 days');
end;
$$;

revoke execute on function public.preview_weekly_summary(uuid) from public, anon;
grant execute on function public.preview_weekly_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The weekly run (service role only, called by the scheduled job).
-- Picks every active project whose client has an account and hasn't switched summaries off,
-- records the bell notification, stamps the project so a second run the same week does
-- nothing, and returns the ones that also need an email. Quiet weeks (nothing new and
-- nothing waiting on the client) are skipped.
-- ---------------------------------------------------------------------------
create function public.create_weekly_summaries()
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
    join public.clients c on c.id = p.client_id
    join auth.users u on u.id = c.user_id
    left join public.profiles pr on pr.id = c.user_id
    where p.status = 'active'
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

-- The job reports whether each email went out.
create function public.finish_summary_email(p_id uuid, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set email_status = case when p_ok then 'sent' else 'failed' end,
      email_attempts = email_attempts + 1,
      emailed_at = case when p_ok then now() else emailed_at end,
      email_error = case when p_ok then null else left(coalesce(p_error, 'unknown error'), 300) end
  where id = p_id and kind = 'weekly_summary' and actor_id is null and email_status = 'pending';
$$;

revoke execute on function
  public.create_weekly_summaries(),
  public.finish_summary_email(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function
  public.create_weekly_summaries(),
  public.finish_summary_email(uuid, boolean, text)
to service_role;
