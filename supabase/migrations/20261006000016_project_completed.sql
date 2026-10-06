-- Marking a project complete: remember when, and tell the client.

alter table public.projects add column completed_at timestamptz;

-- Set when the status becomes Completed, cleared if it is reopened. Not writable directly.
create function public.projects_track_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at = now();
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger projects_track_completion
  before update of status on public.projects
  for each row execute function public.projects_track_completion();

create function public.notify_project_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_user uuid;
begin
  begin
    select user_id into v_client_user from public.clients where id = new.client_id;

    perform public.notify(
      v_client_user,
      auth.uid(),
      new.id,
      'project_completed',
      new.name || ' is complete',
      'Your contractor has marked the project complete. You can download the final statement for your records.',
      '/dashboard/projects/' || new.id::text
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger projects_notify_completed
  after update of status on public.projects
  for each row
  when (old.status <> 'completed' and new.status = 'completed')
  execute function public.notify_project_completed();
