-- An update can now be posted while its video is still uploading (the upload carries on while the contractor uses
-- BuildPeek). Two changes:
--
--   1. Posting no longer marks the video "processing": it stays "uploading" until Cloudflare has the whole file and
--      says it is converting it (or that it is ready). So the homeowner sees "Video on its way" while it uploads, then
--      "Preparing video…", then the video.
--   2. The person uploading can stop a video that hasn't finished uploading, even after posting: it is removed from
--      the update (and from Cloudflare) and its minutes come back. A video that has finished uploading is part of the
--      update and is removed by deleting the update, as before.

create or replace function public.attach_update_videos(p_update uuid, p_project uuid, p_videos uuid[])
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
    -- It must at least have its upload link (the upload itself may still be going).
    if v_video.provider_uid is null or (v_video.status = 'uploading' and v_video.created_at < now() - interval '6 hours') then
      raise exception 'One of the videos didn''t start uploading. Remove it and add it again.' using errcode = 'P0001';
    end if;
    update public.project_videos set update_id = p_update where id = v_id;
  end loop;
end;
$$;

-- Removing a video before posting, or stopping one that is still uploading after posting.
create or replace function public.cancel_video_upload(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.project_videos
  where id = p_id and created_by = auth.uid() and (update_id is null or status = 'uploading');
  return found;
end;
$$;
