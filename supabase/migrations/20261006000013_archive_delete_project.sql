-- Archive and delete projects.
--
-- Archive: hides a project from the owner's lists and dashboard totals. Nothing is lost and
-- the client keeps their view. Reversible.
--
-- Delete: permanent. Everything in the project goes with it (milestones, updates, photos,
-- expenses, payments, notifications). It is refused once the project has CONFIRMED payments:
-- the client has agreed to those records, so the owner can't make them disappear alone.
-- Archive it instead.

alter table public.projects add column archived_at timestamptz;
create index projects_active_idx on public.projects (company_id) where archived_at is null;

-- The existing "owner updates" policy decides who may change it; this adds the column.
grant update (archived_at) on public.projects to authenticated;

-- Why a project can't be deleted, or null if it can. Used by the screen (to explain) and
-- by delete_project (to enforce).
create function public.delete_project_blocker(p_project_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.projects where id = p_project_id;
  if v_company is null then
    return 'Project not found.';
  end if;
  if not public.is_company_owner(v_company) then
    return 'Only the company owner can delete a project.';
  end if;
  if exists (
    select 1 from public.payments
    where project_id = p_project_id and status = 'confirmed'
  ) then
    return 'This project has confirmed payments. Your client has agreed to those records, so it can''t be deleted. Archive it instead.';
  end if;
  return null;
end;
$$;

create function public.delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_client uuid;
begin
  v_reason := public.delete_project_blocker(p_project_id);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;

  select client_id into v_client from public.projects where id = p_project_id;

  -- Everything that belongs to the project is removed by the foreign keys.
  delete from public.projects where id = p_project_id;

  -- The client's contact record goes too, unless they have other projects with this company.
  delete from public.clients c
  where c.id = v_client
    and not exists (select 1 from public.projects pr where pr.client_id = c.id);
end;
$$;

revoke execute on function
  public.delete_project_blocker(uuid),
  public.delete_project(uuid)
from public, anon;
grant execute on function
  public.delete_project_blocker(uuid),
  public.delete_project(uuid)
to authenticated;
