-- Stage 4: project updates with photos.
-- Photos live in a private bucket and are only ever served through signed URLs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id),
  -- Snapshot of the author's name, so homeowners never need access to profiles.
  author_name text not null default '',
  update_date date not null default ((now() at time zone 'Asia/Karachi')::date),
  text text not null check (char_length(trim(text)) > 0),
  milestone_id uuid references public.milestones (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index project_updates_feed_idx
  on public.project_updates (project_id, update_date desc, created_at desc);

create trigger project_updates_set_updated_at
  before update on public.project_updates
  for each row execute function public.set_updated_at();

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.project_updates (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index project_photos_update_id_idx on public.project_photos (update_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.project_updates enable row level security;
alter table public.project_photos enable row level security;

create policy "updates: members and own client read"
  on public.project_updates for select to authenticated
  using (public.is_project_member(project_id) or public.is_project_client(project_id));

create policy "updates: members post as themselves"
  on public.project_updates for insert to authenticated
  with check (public.is_project_member(project_id) and author_id = auth.uid());

create policy "updates: author or owner deletes"
  on public.project_updates for delete to authenticated
  using (
    public.is_project_member(project_id)
    and (author_id = auth.uid() or public.is_project_owner(project_id))
  );

create policy "photos: members and own client read"
  on public.project_photos for select to authenticated
  using (public.is_project_member(project_id) or public.is_project_client(project_id));

create policy "photos: members add"
  on public.project_photos for insert to authenticated
  with check (public.is_project_member(project_id));

revoke all on public.project_updates, public.project_photos from anon, authenticated;
grant select, delete on public.project_updates to authenticated;
grant insert (id, project_id, author_name, update_date, text, milestone_id)
  on public.project_updates to authenticated;
grant select on public.project_photos to authenticated;
grant insert (update_id, project_id, storage_path, thumb_path) on public.project_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Posting an update: the update, its photos and an optional milestone progress
-- change all succeed or fail together. Runs as the caller, so RLS applies.
-- p_photos is a json array of {"path": "...", "thumb": "..."}.
-- ---------------------------------------------------------------------------
create function public.create_update(
  p_id uuid,
  p_project_id uuid,
  p_date date,
  p_text text,
  p_milestone_id uuid,
  p_progress integer,
  p_photos jsonb
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

revoke execute on function public.create_update(uuid, uuid, date, text, uuid, integer, jsonb)
  from public, anon;
grant execute on function public.create_update(uuid, uuid, date, text, uuid, integer, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket. Object paths look like:
--   <project_id>/updates/<update_id>/<file>.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-media', 'project-media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- First folder of a storage path as a uuid; null (so access is denied) if it isn't one.
create function public.storage_project_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return ((string_to_array(p_name, '/'))[1])::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.storage_project_id(text) from public, anon;
grant execute on function public.storage_project_id(text) to authenticated;

create policy "project media: members upload update photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'updates'
    and public.is_project_member(public.storage_project_id(name))
  );

create policy "project media: members and client read update photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'updates'
    and (
      public.is_project_member(public.storage_project_id(name))
      or public.is_project_client(public.storage_project_id(name))
    )
  );

create policy "project media: uploader or owner deletes update photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-media'
    and (string_to_array(name, '/'))[2] = 'updates'
    and (
      owner_id = (select auth.uid())::text
      or public.is_project_owner(public.storage_project_id(name))
    )
  );
