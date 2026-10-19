-- Site videos on updates (Pro and Business). The videos themselves live at Cloudflare Stream; this keeps track of them
-- and enforces every rule:
--
--   * Pro: up to 3 minutes a video and 60 minutes of new video a month; Business: 5 minutes and 200 minutes; Free: none
--   * up to 2 videos on one update
--   * only people who can post updates on the project (the owner, and staff who aren't view-only or paused)
--   * the team on the project and its homeowner can watch a posted video; a video still being added is only seen by
--     the person adding it
--
-- How a video gets onto an update:
--   1. start_video_upload() checks all of the above, holds back the video's minutes (the longest it may be) and returns
--      that length. The server then asks Cloudflare for a one-time upload link that refuses anything longer, and
--      records Cloudflare's id for it with attach_video_upload().
--   2. The phone uploads the file straight to Cloudflare.
--   3. create_update() posts the update and attaches the video to it.
--   4. Cloudflare reports when the video is ready (video_set_status(), from its notification or a check), with its
--      real length, which then counts instead of the minutes held back.
--
-- Minutes are counted per calendar month in the company's time zone. A video that failed, or that was never posted,
-- doesn't count, and deleting a video gives its minutes back. Deleted videos are removed from Cloudflare by the server
-- (video_deletions is the list it works through).

-- ---------------------------------------------------------------------------
-- What each plan allows
-- ---------------------------------------------------------------------------
create function public.plan_video_max_seconds(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'pro' then 180 when 'business' then 300 else 0 end;
$$;

create function public.plan_video_monthly_seconds(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan when 'pro' then 3600 when 'business' then 12000 else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- The videos
-- ---------------------------------------------------------------------------
create table public.project_videos (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  -- The update it is being added to. Its id is chosen before the update is posted, so this is set from the start;
  -- update_id is set (to the same id) once the update exists.
  draft_update_id uuid not null,
  update_id uuid references public.project_updates (id) on delete cascade,
  provider text not null default 'cloudflare' check (provider in ('cloudflare')),
  provider_uid text unique check (provider_uid ~ '^[A-Za-z0-9_-]{8,64}$'),
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'error')),
  error_code text not null default '' check (char_length(error_code) <= 100),
  -- The longest this video may be (what is held back from the month's minutes until its real length is known).
  reserved_seconds integer not null check (reserved_seconds between 1 and 36000),
  duration_seconds numeric(8, 2) check (duration_seconds >= 0),
  checked_at timestamptz,
  ready_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (update_id is null or update_id = draft_update_id)
);
create index project_videos_update_idx on public.project_videos (update_id) where update_id is not null;
create index project_videos_draft_idx on public.project_videos (draft_update_id);
create index project_videos_project_idx on public.project_videos (project_id, created_at);
create index project_videos_company_idx on public.project_videos (company_id, created_at);

alter table public.project_videos enable row level security;
revoke all on public.project_videos from anon, authenticated;
grant select on public.project_videos to authenticated;
-- Nobody writes directly: everything goes through the functions below.

-- A posted video: the team on the project and its homeowner. A video still being added: the person adding it.
create policy "videos: team and homeowner watch posted videos, the uploader sees theirs"
  on public.project_videos for select to authenticated
  using (
    (update_id is not null and (public.is_project_member(project_id) or public.is_project_client(project_id)))
    or (created_by = auth.uid() and public.is_project_member(project_id))
  );

-- Videos to remove from Cloudflare. Only the server reads or changes this.
create table public.video_deletions (
  provider text not null default 'cloudflare',
  provider_uid text primary key,
  queued_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text not null default ''
);
alter table public.video_deletions enable row level security;
revoke all on public.video_deletions from anon, authenticated;

create function public.project_videos_queue_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider_uid is not null then
    insert into public.video_deletions (provider, provider_uid) values (old.provider, old.provider_uid)
    on conflict (provider_uid) do nothing;
  end if;
  return old;
end;
$$;

create trigger project_videos_queue_deletion
  after delete on public.project_videos
  for each row execute function public.project_videos_queue_deletion();

-- ---------------------------------------------------------------------------
-- Minutes used this month
-- ---------------------------------------------------------------------------
-- A video that was never finished uploading (6 hours: its upload link has expired) or never posted (24 hours) no
-- longer counts, even before the daily clean-up removes it.
create function public.company_video_seconds_used(p_company uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when v.duration_seconds is not null then ceil(v.duration_seconds)::integer else v.reserved_seconds end), 0)::integer
  from public.project_videos v
  join public.companies co on co.id = v.company_id
  where v.company_id = p_company
    and v.status <> 'error'
    and v.created_at >= (date_trunc('month', now() at time zone co.timezone) at time zone co.timezone)
    and not (v.status = 'uploading' and v.created_at < now() - interval '6 hours')
    and not (v.update_id is null and v.created_at < now() - interval '24 hours');
$$;
revoke execute on function public.company_video_seconds_used(uuid) from public, anon, authenticated;

-- For the Add update form: the longest video this person may add here, and the month's minutes.
create function public.video_allowance(p_project uuid)
returns table (max_seconds integer, monthly_seconds integer, used_seconds integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_plan text;
begin
  if not public.is_project_member(p_project) then
    raise exception 'You don''t have access to this project.' using errcode = 'P0001';
  end if;
  select co.id, public.effective_plan(co.plan, co.plan_until) into v_company, v_plan
  from public.projects p join public.companies co on co.id = p.company_id
  where p.id = p_project;
  return query select public.plan_video_max_seconds(v_plan), public.plan_video_monthly_seconds(v_plan),
                      public.company_video_seconds_used(v_company);
end;
$$;

-- For Settings: the same, for the company this person belongs to.
create function public.my_video_usage()
returns table (max_seconds integer, monthly_seconds integer, used_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select public.plan_video_max_seconds(public.effective_plan(co.plan, co.plan_until)),
         public.plan_video_monthly_seconds(public.effective_plan(co.plan, co.plan_until)),
         public.company_video_seconds_used(co.id)
  from public.company_members m
  join public.companies co on co.id = m.company_id
  where m.user_id = auth.uid()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Adding a video
-- ---------------------------------------------------------------------------
-- Checks everything and holds back the video's minutes. Returns the longest the video may be, in seconds: the plan's
-- limit, or what is left of the month if that is less. Cloudflare is then told to refuse anything longer.
create function public.start_video_upload(p_id uuid, p_project uuid, p_update uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_plan text;
  v_max integer;
  v_monthly integer;
  v_left integer;
  v_allowed integer;
begin
  if v_user is null or p_id is null or p_project is null or p_update is null then
    raise exception 'Something is missing. Please try again.' using errcode = 'P0001';
  end if;
  if not public.is_project_member(p_project) or public.staff_write_blocked(p_project) then
    raise exception 'You can''t add videos to this project.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.project_updates where id = p_update) then
    raise exception 'That update has already been posted. Videos can only be added while writing it.' using errcode = 'P0001';
  end if;

  select co.id, public.effective_plan(co.plan, co.plan_until) into v_company, v_plan
  from public.projects p join public.companies co on co.id = p.company_id
  where p.id = p_project;
  v_max := public.plan_video_max_seconds(v_plan);
  v_monthly := public.plan_video_monthly_seconds(v_plan);
  if v_max = 0 then
    raise exception 'Videos are part of the Pro and Business plans.' using errcode = 'P0001';
  end if;

  -- One at a time per company, so two videos started at the same moment are counted correctly.
  perform pg_advisory_xact_lock(hashtextextended(v_company::text, 47));

  if exists (select 1 from public.project_videos where id = p_id) then
    raise exception 'Something went wrong. Please add the video again.' using errcode = 'P0001';
  end if;
  -- An update being written belongs to one person on one project.
  if exists (
    select 1 from public.project_videos
    where draft_update_id = p_update and (project_id <> p_project or created_by is distinct from v_user)
  ) then
    raise exception 'Something went wrong. Please start the update again.' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.project_videos
    where draft_update_id = p_update and status <> 'error'
      and not (status = 'uploading' and created_at < now() - interval '6 hours')
  ) >= 2 then
    raise exception 'You can add up to 2 videos to one update.' using errcode = 'P0001';
  end if;
  -- Each unfinished upload holds back minutes (here and at Cloudflare), so don't let them pile up.
  if (
    select count(*) from public.project_videos
    where created_by = v_user and status = 'uploading' and update_id is null
      and created_at >= now() - interval '6 hours'
  ) >= 4 then
    raise exception 'Please finish or remove your other video uploads first.' using errcode = 'P0001';
  end if;

  v_left := v_monthly - public.company_video_seconds_used(v_company);
  if v_left < 1 then
    raise exception 'You have used all % minutes of video for this month. More becomes available on the 1st.', v_monthly / 60
      using errcode = 'P0001';
  end if;
  v_allowed := least(v_max, v_left);

  insert into public.project_videos (id, project_id, company_id, draft_update_id, reserved_seconds, created_by)
  values (p_id, p_project, v_company, p_update, v_allowed, v_user);
  return v_allowed;
end;
$$;

-- The server records Cloudflare's id for the upload it just created. Only the server can: anyone else could point a
-- video of theirs at somebody else's.
create function public.attach_video_upload(p_id uuid, p_uid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_videos set provider_uid = p_uid
  where id = p_id and provider_uid is null and status = 'uploading';
  if not found then
    raise exception 'That video upload no longer exists.' using errcode = 'P0001';
  end if;
end;
$$;

-- The person adding a video removes it before posting (or the upload failed). Its minutes come back, and the server
-- removes it from Cloudflare.
create function public.cancel_video_upload(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.project_videos
  where id = p_id and created_by = auth.uid() and update_id is null;
  return found;
end;
$$;

-- Attaches the videos to the update being posted. Called by create_update(), in the same step as the update itself.
create function public.attach_update_videos(p_update uuid, p_project uuid, p_videos uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_video public.project_videos;
begin
  if coalesce(cardinality(p_videos), 0) = 0 then
    return;
  end if;
  if cardinality(p_videos) > 2 then
    raise exception 'You can add up to 2 videos to one update.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.project_updates where id = p_update and project_id = p_project and author_id = v_user
  ) then
    raise exception 'Something went wrong. Please try again.' using errcode = 'P0001';
  end if;

  foreach v_id in array p_videos loop
    select * into v_video from public.project_videos where id = v_id for update;
    if not found or v_video.created_by is distinct from v_user or v_video.project_id <> p_project
       or v_video.draft_update_id <> p_update then
      raise exception 'One of the videos isn''t part of this update. Remove it and add it again.' using errcode = 'P0001';
    end if;
    if v_video.update_id is not null then
      continue;
    end if;
    if v_video.status = 'error' then
      raise exception 'One of the videos couldn''t be processed (it may be longer than allowed). Remove it and try again.'
        using errcode = 'P0001';
    end if;
    if v_video.provider_uid is null or (v_video.status = 'uploading' and v_video.created_at < now() - interval '6 hours') then
      raise exception 'One of the videos didn''t finish uploading. Remove it and add it again.' using errcode = 'P0001';
    end if;
    update public.project_videos
    set update_id = p_update,
        status = case when status = 'uploading' then 'processing' else status end
    where id = v_id;
  end loop;
end;
$$;

-- What Cloudflare says about a video: from its notification, or from the server asking. A video only moves forward
-- (uploading, processing, ready), so a late or repeated message changes nothing.
create function public.video_set_status(p_uid text, p_state text, p_duration numeric, p_error text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.project_videos v
  set status = case
        when v.status in ('ready', 'error') then v.status
        when p_state = 'ready' then 'ready'
        when p_state = 'error' then 'error'
        when p_state in ('downloading', 'queued', 'inprogress') then 'processing'
        else v.status
      end,
      duration_seconds = case when p_duration > 0 then least(p_duration, 999999) else v.duration_seconds end,
      error_code = case when p_state = 'error' and v.status not in ('ready', 'error') then left(coalesce(p_error, ''), 100) else v.error_code end,
      ready_at = case when p_state = 'ready' and v.status <> 'ready' then now() else v.ready_at end,
      checked_at = now()
  where v.provider_uid = p_uid
  returning v.id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posting an update now takes its videos too (p_videos, the ids from start_video_upload). Old calls without it still
-- work.
-- ---------------------------------------------------------------------------
drop function public.create_update(uuid, uuid, date, text, uuid, integer, jsonb);

create function public.create_update(
  p_id uuid,
  p_project_id uuid,
  p_date date,
  p_text text,
  p_milestone_id uuid,
  p_progress integer,
  p_photos jsonb,
  p_videos uuid[] default '{}'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_photo jsonb;
  v_prefix text := p_project_id::text || '/updates/' || p_id::text || '/';
begin
  if not public.is_project_member(p_project_id) then
    raise exception 'You don''t have access to this project.';
  end if;
  if p_text is null or char_length(trim(p_text)) = 0 then
    raise exception 'Please write a short update.';
  end if;
  if jsonb_array_length(coalesce(p_photos, '[]'::jsonb)) > 10 then
    raise exception 'Please add 10 photos or fewer to one update.';
  end if;

  -- Posting twice (a double tap, or a retry on a weak connection) is harmless.
  if exists (select 1 from public.project_updates where id = p_id) then
    return p_id;
  end if;

  if p_milestone_id is not null and not exists (
    select 1 from public.milestones where id = p_milestone_id and project_id = p_project_id
  ) then
    raise exception 'That milestone doesn''t belong to this project.';
  end if;

  select nullif(trim(name), '') into v_name from public.profiles where id = v_user;
  v_name := coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');

  insert into public.project_updates (id, project_id, author_name, update_date, text, milestone_id)
  values (p_id, p_project_id, v_name, coalesce(p_date, (now() at time zone 'Asia/Karachi')::date),
          trim(p_text), p_milestone_id);

  for v_photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    -- Files must sit in this update's own folder of this project's storage area.
    if left(v_photo ->> 'path', length(v_prefix)) <> v_prefix
       or (v_photo ->> 'thumb' is not null and left(v_photo ->> 'thumb', length(v_prefix)) <> v_prefix) then
      raise exception 'One of the photos was uploaded to the wrong place. Please try again.';
    end if;
    insert into public.project_photos (update_id, project_id, storage_path, thumb_path)
    values (p_id, p_project_id, v_photo ->> 'path', v_photo ->> 'thumb');
  end loop;

  perform public.attach_update_videos(p_id, p_project_id, p_videos);

  if p_milestone_id is not null and p_progress is not null then
    if p_progress < 0 or p_progress > 100 then
      raise exception 'Progress must be between 0 and 100.';
    end if;
    update public.milestones set progress_percent = p_progress
    where id = p_milestone_id and project_id = p_project_id;
  end if;

  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Clean-up (the daily job)
-- ---------------------------------------------------------------------------
-- Removes videos that were never posted, marks posted ones that never became ready as failed, and returns how many
-- of each. Their Cloudflare copies are queued for deletion by the trigger above.
create function public.clean_up_videos()
returns table (removed integer, failed integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed integer;
  v_failed integer;
begin
  delete from public.project_videos
  where update_id is null
    and (created_at < now() - interval '24 hours' or (status = 'uploading' and created_at < now() - interval '6 hours'));
  get diagnostics v_removed = row_count;

  update public.project_videos
  set status = 'error', error_code = 'NEVER_READY'
  where update_id is not null and status in ('uploading', 'processing') and created_at < now() - interval '24 hours';
  get diagnostics v_failed = row_count;

  return query select v_removed, v_failed;
end;
$$;

-- The videos waiting to be removed from Cloudflare, oldest first (each is tried again on later runs if it fails).
create function public.video_deletions_due(p_limit integer default 25)
returns table (provider_uid text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.provider_uid from public.video_deletions d
  where d.attempts < 20
  order by d.queued_at
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

create function public.video_deletion_done(p_uid text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_error is null then
    delete from public.video_deletions where provider_uid = p_uid;
  else
    update public.video_deletions set attempts = attempts + 1, last_error = left(p_error, 300) where provider_uid = p_uid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The weekly summary also says how many videos were posted. (The summary is built by build_weekly_summary_base, as
-- before; this adds the count. A future change to the summary itself goes in the _base function.)
-- ---------------------------------------------------------------------------
alter function public.build_weekly_summary(uuid, timestamptz) rename to build_weekly_summary_base;

create function public.build_weekly_summary(p_project uuid, p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.build_weekly_summary_base(p_project, p_since)
    || jsonb_build_object('video_count', (
      select count(*) from public.project_videos v
      where v.project_id = p_project and v.update_id is not null and v.status <> 'error' and v.created_at >= p_since
    ));
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------
revoke execute on function
  public.build_weekly_summary(uuid, timestamptz),
  public.build_weekly_summary_base(uuid, timestamptz)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.video_allowance(uuid),
  public.my_video_usage(),
  public.start_video_upload(uuid, uuid, uuid),
  public.cancel_video_upload(uuid),
  public.attach_update_videos(uuid, uuid, uuid[]),
  public.create_update(uuid, uuid, date, text, uuid, integer, jsonb, uuid[])
  from public, anon;
grant execute on function
  public.video_allowance(uuid),
  public.my_video_usage(),
  public.start_video_upload(uuid, uuid, uuid),
  public.cancel_video_upload(uuid),
  public.attach_update_videos(uuid, uuid, uuid[]),
  public.create_update(uuid, uuid, date, text, uuid, integer, jsonb, uuid[])
  to authenticated;

revoke execute on function
  public.attach_video_upload(uuid, text),
  public.video_set_status(text, text, numeric, text),
  public.clean_up_videos(),
  public.video_deletions_due(integer),
  public.video_deletion_done(text, text),
  public.project_videos_queue_deletion()
  from public, anon, authenticated;
grant execute on function
  public.attach_video_upload(uuid, text),
  public.video_set_status(text, text, numeric, text),
  public.clean_up_videos(),
  public.video_deletions_due(integer),
  public.video_deletion_done(text, text)
  to service_role;
