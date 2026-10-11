-- Project documents: the contract, drawings, permits, quotations and invoices for a project.
-- Same privacy model as expenses: the owner decides which ones the homeowner can see, and the
-- database (not the app) enforces it, for the rows AND for the files.

create type public.document_category as enum (
  'contract', 'drawing', 'permit', 'quotation', 'invoice', 'other'
);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  category public.document_category not null default 'other',
  -- <project_id>/<document_id>/<file> in the private "project-documents" bucket.
  file_path text not null,
  -- What the file was called when it was added (shown, and used as the download name).
  file_name text not null default '' check (char_length(file_name) <= 200),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  mime_type text not null,
  -- Hidden until the owner shares it, like an expense. The app's form turns it on for the owner.
  client_visible boolean not null default false,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

create index project_documents_project_idx
  on public.project_documents (project_id, created_at desc);

create trigger project_documents_set_updated_at
  before update on public.project_documents
  for each row execute function public.set_updated_at();

-- Business rules that must hold no matter which client calls the database.
create function public.project_documents_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  new.title = trim(new.title);

  if tg_op = 'INSERT' then
    if left(new.file_path, length(new.project_id::text || '/' || new.id::text || '/'))
         <> new.project_id::text || '/' || new.id::text || '/' then
      raise exception 'The file was uploaded to the wrong place. Please try again.';
    end if;

    select nullif(trim(name), '') into v_name from public.profiles where id = auth.uid();
    new.created_by_name = coalesce(v_name, split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');
    -- Only the owner decides what the homeowner sees.
    if not public.is_project_owner(new.project_id) then
      new.client_visible = false;
    end if;
  else
    -- The file itself never changes: to replace it, add a new document.
    if (new.file_path, new.file_name, new.file_size, new.mime_type, new.project_id)
       is distinct from (old.file_path, old.file_name, old.file_size, old.mime_type, old.project_id) then
      raise exception 'A document''s file can''t be changed. Add a new document instead.';
    end if;
    if new.client_visible is distinct from old.client_visible
       and not public.is_project_owner(new.project_id) then
      raise exception 'Only the company owner can change what the client sees.';
    end if;
  end if;

  return new;
end;
$$;

create trigger project_documents_before_write
  before insert or update on public.project_documents
  for each row execute function public.project_documents_before_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.project_documents enable row level security;

create policy "documents: members read, client reads shared"
  on public.project_documents for select to authenticated
  using (
    public.is_project_member(project_id)
    or (client_visible and public.is_project_client(project_id))
  );

create policy "documents: members add as themselves"
  on public.project_documents for insert to authenticated
  with check (public.is_project_member(project_id) and created_by = auth.uid());

create policy "documents: owner or creator edits"
  on public.project_documents for update to authenticated
  using (
    public.is_project_owner(project_id)
    or (public.is_project_member(project_id) and created_by = auth.uid())
  )
  with check (
    public.is_project_owner(project_id)
    or (public.is_project_member(project_id) and created_by = auth.uid())
  );

create policy "documents: owner or creator deletes"
  on public.project_documents for delete to authenticated
  using (
    public.is_project_owner(project_id)
    or (public.is_project_member(project_id) and created_by = auth.uid())
  );

revoke all on public.project_documents from anon, authenticated;
grant select, delete on public.project_documents to authenticated;
grant insert (id, project_id, title, category, file_path, file_name, file_size, mime_type, client_visible)
  on public.project_documents to authenticated;
grant update (title, category, client_visible) on public.project_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Files. A separate private bucket (the photo bucket only takes images), 20 MB each, and only
-- the kinds of file a contractor actually exchanges. Nothing that a browser could run.
--   <project_id>/<document_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 20971520, array[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A file can be read by the team, and by the homeowner only while its document is shared.
create function public.can_read_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_documents d
    where d.id = public.storage_path_uuid(p_name, 2)
      and d.project_id = public.storage_path_uuid(p_name, 1)
      and d.file_path = p_name
      and (
        public.is_project_member(d.project_id)
        or (d.client_visible and public.is_project_client(d.project_id))
      )
  );
$$;

revoke execute on function public.can_read_document_file(text) from public, anon;
grant execute on function public.can_read_document_file(text) to authenticated;

create policy "project documents: members upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and public.is_project_member(public.storage_project_id(name))
  );

create policy "project documents: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and public.can_read_document_file(name)
  );

create policy "project documents: uploader or owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      owner_id = (select auth.uid())::text
      or public.is_project_owner(public.storage_project_id(name))
    )
  );

-- ---------------------------------------------------------------------------
-- The homeowner is told when a document is shared with them (bell and email).
-- ---------------------------------------------------------------------------
create function public.notify_document_shared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_client_user uuid;
begin
  begin
    select p.name, c.user_id
    into v_project, v_client_user
    from public.projects p
    join public.clients c on c.id = p.client_id
    where p.id = new.project_id;

    perform public.notify(
      v_client_user,
      auth.uid(),
      new.project_id,
      'document_shared',
      'New document: ' || new.title,
      'Added to ' || v_project || '. You can open or download it from the Documents tab.',
      '/dashboard/projects/' || new.project_id::text || '/documents'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger project_documents_notify_insert
  after insert on public.project_documents
  for each row
  when (new.client_visible)
  execute function public.notify_document_shared();

create trigger project_documents_notify_shared
  after update of client_visible on public.project_documents
  for each row
  when (new.client_visible and not old.client_visible)
  execute function public.notify_document_shared();
