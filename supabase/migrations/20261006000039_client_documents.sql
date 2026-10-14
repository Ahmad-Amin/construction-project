-- Documents from the homeowner. Until now only the contractor's team added documents and chose which
-- ones the homeowner could see. Now the homeowner can add their own (an ID, an approved plan, a letter)
-- and choose whether to share each with the contractor. Everything is enforced here, in the database:
--
--   * a document from the homeowner is private to them until they share it with the contractor
--   * the contractor's team can open a shared one, but cannot edit or delete it
--   * the homeowner never sees the contractor's unshared documents, and still only sees what the
--     contractor shared with them
--   * at most 25 documents per homeowner per project, so one client can't fill the contractor's storage

alter table public.project_documents
  -- Set by the database from who is adding it, never taken from the request.
  add column from_client boolean not null default false,
  -- For a homeowner's document: whether the contractor's team can see it.
  add column team_visible boolean not null default false;

grant insert (team_visible) on public.project_documents to authenticated;
grant update (team_visible) on public.project_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Rules that must hold whichever way the database is called.
-- ---------------------------------------------------------------------------
create or replace function public.project_documents_before_write()
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

    if public.is_project_member(new.project_id) then
      -- The contractor's team. Only the owner decides what the homeowner sees.
      new.from_client = false;
      new.team_visible = false;
      if not public.is_project_owner(new.project_id) then
        new.client_visible = false;
      end if;
    elsif public.is_project_client(new.project_id) then
      -- The homeowner. Their document is never one of the contractor's, whatever the request says.
      new.from_client = true;
      new.client_visible = false;
      if (select count(*) from public.project_documents
          where project_id = new.project_id and from_client and created_by = auth.uid()) >= 25 then
        raise exception 'You can add up to 25 documents to a project.' using errcode = 'P0001';
      end if;
    else
      raise exception 'You can''t add documents to this project.' using errcode = 'P0001';
    end if;
  else
    -- The file itself never changes: to replace it, add a new document.
    if (new.file_path, new.file_name, new.file_size, new.mime_type, new.project_id)
       is distinct from (old.file_path, old.file_name, old.file_size, old.mime_type, old.project_id) then
      raise exception 'A document''s file can''t be changed. Add a new document instead.';
    end if;
    if new.from_client is distinct from old.from_client then
      raise exception 'Who added a document can''t be changed.';
    end if;

    if old.from_client then
      -- A homeowner's document: only they change it, and only their own sharing.
      if new.client_visible is distinct from old.client_visible then
        raise exception 'This is your document. The contractor''s sharing settings don''t apply to it.';
      end if;
    else
      -- The contractor's document: its sharing with the homeowner is the owner's alone.
      if new.team_visible is distinct from old.team_visible then
        raise exception 'That setting only applies to documents from your client.';
      end if;
      if new.client_visible is distinct from old.client_visible
         and not public.is_project_owner(new.project_id) then
        raise exception 'Only the company owner can change what the client sees.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security, rewritten for both sides.
-- ---------------------------------------------------------------------------
drop policy "documents: members read, client reads shared" on public.project_documents;
drop policy "documents: members add as themselves" on public.project_documents;
drop policy "documents: owner or creator edits" on public.project_documents;
drop policy "documents: owner or creator deletes" on public.project_documents;

create policy "documents: who can read"
  on public.project_documents for select to authenticated
  using (
    -- the contractor's team: their own side, plus the homeowner's documents shared with them
    (public.is_project_member(project_id) and (not from_client or team_visible))
    or
    -- the homeowner: what the contractor shared with them, and everything they added themselves
    (public.is_project_client(project_id)
      and ((not from_client and client_visible) or (from_client and created_by = auth.uid())))
  );

create policy "documents: team and client add as themselves"
  on public.project_documents for insert to authenticated
  with check (
    created_by = auth.uid()
    and (public.is_project_member(project_id) or public.is_project_client(project_id))
  );

create policy "documents: owner or creator edits"
  on public.project_documents for update to authenticated
  using (
    (not from_client
      and (public.is_project_owner(project_id) or (public.is_project_member(project_id) and created_by = auth.uid())))
    or (from_client and created_by = auth.uid() and public.is_project_client(project_id))
  )
  with check (
    (not from_client
      and (public.is_project_owner(project_id) or (public.is_project_member(project_id) and created_by = auth.uid())))
    or (from_client and created_by = auth.uid() and public.is_project_client(project_id))
  );

create policy "documents: owner or creator deletes"
  on public.project_documents for delete to authenticated
  using (
    (not from_client
      and (public.is_project_owner(project_id) or (public.is_project_member(project_id) and created_by = auth.uid())))
    or (from_client and created_by = auth.uid() and public.is_project_client(project_id))
  );

-- ---------------------------------------------------------------------------
-- The files follow the same rules.
-- ---------------------------------------------------------------------------
create or replace function public.can_read_document_file(p_name text)
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
        (public.is_project_member(d.project_id) and (not d.from_client or d.team_visible))
        or (public.is_project_client(d.project_id)
            and ((not d.from_client and d.client_visible) or (d.from_client and d.created_by = auth.uid())))
      )
  );
$$;

-- How many files this person already has in a project's documents folder. A homeowner uploads the file
-- before the document row exists, so the 25-document limit alone wouldn't bound their storage use.
create function public.own_document_file_count(p_project uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from storage.objects o
  where o.bucket_id = 'project-documents'
    and o.owner_id = auth.uid()::text
    and public.storage_path_uuid(o.name, 1) = p_project;
$$;

revoke all on function public.own_document_file_count(uuid) from public, anon;
grant execute on function public.own_document_file_count(uuid) to authenticated;

drop policy "project documents: members upload" on storage.objects;
create policy "project documents: team and client upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      public.is_project_member(public.storage_project_id(name))
      or (
        public.is_project_client(public.storage_project_id(name))
        and public.own_document_file_count(public.storage_project_id(name)) < 40
      )
    )
  );

-- The company owner can still clear away the contractor's own files, but not a file that belongs to a
-- homeowner's document (its row can't be deleted by the team, so neither can its file).
create function public.is_client_document_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.project_documents d where d.file_path = p_name and d.from_client);
$$;

revoke all on function public.is_client_document_file(text) from public, anon;
grant execute on function public.is_client_document_file(text) to authenticated;

drop policy "project documents: uploader or owner deletes" on storage.objects;
create policy "project documents: uploader or owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      owner_id = (select auth.uid())::text
      or (
        public.is_project_owner(public.storage_project_id(name))
        and not public.is_client_document_file(name)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- The contractor's owner is told when the homeowner shares a document with them (bell and email).
-- ---------------------------------------------------------------------------
create function public.notify_document_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project text;
  v_owner uuid;
  v_client text;
begin
  begin
    select p.name, co.owner_id, c.name
    into v_project, v_owner, v_client
    from public.projects p
    join public.companies co on co.id = p.company_id
    join public.clients c on c.id = p.client_id
    where p.id = new.project_id;

    perform public.notify(
      v_owner,
      auth.uid(),
      new.project_id,
      'document_received',
      'New document from ' || coalesce(nullif(v_client, ''), 'your client') || ': ' || new.title,
      'Shared with you on ' || v_project || '. You can open or download it from the Documents tab.',
      '/dashboard/projects/' || new.project_id::text || '/documents'
    );
  exception when others then
    raise warning 'Could not create notification: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger project_documents_notify_received_insert
  after insert on public.project_documents
  for each row
  when (new.from_client and new.team_visible)
  execute function public.notify_document_received();

create trigger project_documents_notify_received_shared
  after update of team_visible on public.project_documents
  for each row
  when (new.from_client and new.team_visible and not old.team_visible)
  execute function public.notify_document_received();
