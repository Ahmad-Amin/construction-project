-- Stage 8: company logos.
-- Logos are not sensitive and every homeowner of the company sees them, so they
-- live in a public bucket. Only the company owner can add or remove files.
-- Paths look like:  <company_id>/<random>.png   (SVG is refused: it can carry scripts)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "company logos: owner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-logos'
    and public.is_company_owner(public.storage_path_uuid(name, 1))
  );

create policy "company logos: owner reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'company-logos'
    and public.is_company_owner(public.storage_path_uuid(name, 1))
  );

create policy "company logos: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-logos'
    and public.is_company_owner(public.storage_path_uuid(name, 1))
  );
