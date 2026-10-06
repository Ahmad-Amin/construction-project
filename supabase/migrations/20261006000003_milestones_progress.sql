-- Stage 3: editing milestones and progress.
-- Owner: add, rename, reorder, delete, set progress.
-- Staff: set progress on milestones of their company's projects.

-- Status always follows the percentage, so the two can never disagree.
create function public.milestones_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name = trim(new.name);
  new.status = case
    when new.progress_percent >= 100 then 'done'::public.milestone_status
    when new.progress_percent <= 0 then 'not_started'::public.milestone_status
    else 'in_progress'::public.milestone_status
  end;

  -- Staff may only move progress; structure is the owner's.
  if tg_op = 'UPDATE' then
    if (new.name is distinct from old.name or new.position is distinct from old.position)
       and not public.is_project_owner(old.project_id) then
      raise exception 'Only the company owner can rename or reorder milestones.';
    end if;
  end if;
  return new;
end;
$$;

create trigger milestones_before_write
  before insert or update on public.milestones
  for each row execute function public.milestones_before_write();

-- Replace the stage 2 owner-only write policy with finer ones.
drop policy "milestones: owner writes" on public.milestones;

create policy "milestones: owner inserts"
  on public.milestones for insert to authenticated
  with check (public.is_project_owner(project_id));

create policy "milestones: owner deletes"
  on public.milestones for delete to authenticated
  using (public.is_project_owner(project_id));

create policy "milestones: members update"
  on public.milestones for update to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

revoke insert, update, delete on public.milestones from authenticated;
grant insert (project_id, name, position, progress_percent) on public.milestones to authenticated;
grant update (name, position, progress_percent) on public.milestones to authenticated;
grant delete on public.milestones to authenticated;

-- Both functions run as the caller, so the policies above apply.
create function public.add_milestone(p_project_id uuid, p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Please enter a milestone name.';
  end if;
  if (select count(*) from public.milestones where project_id = p_project_id) >= 20 then
    raise exception 'Please keep milestones to 20 or fewer.';
  end if;

  insert into public.milestones (project_id, name, position)
  select p_project_id, trim(p_name), coalesce(max(position), 0) + 1
  from public.milestones
  where project_id = p_project_id
  returning id into v_id;

  if v_id is null then
    raise exception 'You can''t add milestones to this project.';
  end if;
  return v_id;
end;
$$;

-- Swaps a milestone with its neighbour. p_direction is 'up' or 'down'.
create function public.move_milestone(p_milestone_id uuid, p_direction text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_this record;
  v_other record;
begin
  select id, project_id, position into v_this
  from public.milestones where id = p_milestone_id;
  if not found then
    raise exception 'Milestone not found.';
  end if;

  if p_direction = 'up' then
    select id, position into v_other from public.milestones
    where project_id = v_this.project_id and (position, id) < (v_this.position, v_this.id)
    order by position desc, id desc limit 1;
  elsif p_direction = 'down' then
    select id, position into v_other from public.milestones
    where project_id = v_this.project_id and (position, id) > (v_this.position, v_this.id)
    order by position asc, id asc limit 1;
  else
    raise exception 'Direction must be up or down.';
  end if;

  if not found then
    return; -- already first or last
  end if;

  -- Give the pair distinct positions even if they were tied.
  update public.milestones
  set position = case when id = v_this.id then v_other.position else v_this.position end
  where id in (v_this.id, v_other.id);

  if v_this.position = v_other.position then
    update public.milestones set position = position + 1
    where id = (case when p_direction = 'down' then v_this.id else v_other.id end);
  end if;
end;
$$;

revoke execute on function
  public.add_milestone(uuid, text),
  public.move_milestone(uuid, text)
from public, anon;
grant execute on function
  public.add_milestone(uuid, text),
  public.move_milestone(uuid, text)
to authenticated;
