-- =============================================================================
-- Nhật Ký Của Ý — private Storage bucket + access policies
--
-- Object path layout:  <owner uuid>/<entry uuid>/<random uuid>.<ext>
--
--   owner  : upload into their own folder for an entry they own, read and
--            delete their own files. No overwrite (no UPDATE policy).
--   viewer : read ONLY files that are registered as diary attachments.
--   anon   : nothing (bucket is private; no policy grants anon access).
--
-- Files are served through short-lived signed URLs created with the
-- caller's own session, so these policies are always enforced.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diary-files',
  'diary-files',
  false,
  52428800, -- 50 MB hard ceiling (Supabase free tier maximum). The app applies smaller per-type limits.
  array[
    -- images
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif',
    -- audio (MediaRecorder output differs per browser)
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-wav',
    'audio/x-m4a', 'audio/m4a', 'audio/flac',
    -- documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/rtf', 'text/rtf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
on conflict (id) do update
set public             = false,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Policies on storage.objects (RLS is already enabled by Supabase).
-- -----------------------------------------------------------------------------
drop policy if exists "diary-files: owner reads own folder" on storage.objects;
create policy "diary-files: owner reads own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'diary-files'
    and (select private.is_owner())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "diary-files: viewer reads registered attachments" on storage.objects;
create policy "diary-files: viewer reads registered attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'diary-files'
    and (select private.is_member())
    and exists (select 1 from public.diary_attachments a where a.storage_path = name)
  );

drop policy if exists "diary-files: owner uploads to own entry" on storage.objects;
create policy "diary-files: owner uploads to own entry"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'diary-files'
    and (select private.is_owner())
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.diary_entries e
      where e.id::text = (storage.foldername(name))[2]
        and e.owner_id = (select auth.uid())
    )
  );

-- No UPDATE policy: files can never be overwritten in place.

drop policy if exists "diary-files: owner deletes own files" on storage.objects;
create policy "diary-files: owner deletes own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'diary-files'
    and (select private.is_owner())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
