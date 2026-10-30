-- =============================================================================
-- RLS / authorization tests. Run with: npm run test:db  (needs local PostgreSQL)
-- Every failing assertion raises an exception and stops the run (ON_ERROR_STOP).
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

-- ---------- test helpers (created as superuser) ----------
create schema if not exists test;
grant usage on schema test to anon, authenticated;

create or replace function test.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

-- Runs a statement and returns rows affected.
create or replace function test.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

-- Expects the statement to be rejected (privilege / RLS / constraint error).
create or replace function test.denied(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege or check_violation or raise_exception or not_null_violation
      or foreign_key_violation or unique_violation then
      raise notice 'ok - % (rejected: %)', msg, sqlerrm;
      return;
  end;
  raise exception 'FAIL: % — statement was allowed: %', msg, stmt;
end $$;

grant execute on all functions in schema test to anon, authenticated;

-- ---------- fixtures (as admin) ----------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'viewer@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@test.local');

-- Admin assigns roles (stranger gets no profile at all).
insert into public.profiles (id, display_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Ý', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'Viewer', 'viewer');

select test.ok(
  (select count(*) from storage.buckets where id = 'diary-files' and public = false) = 1,
  'storage bucket diary-files exists and is private');

-- A second owner can never be created.
select test.denied($$ insert into public.profiles (id, display_name, role) values ('33333333-3333-3333-3333-333333333333','X','owner') $$,
  'only one owner profile may exist') ;

-- =============================================================================
-- Scenario 1: unauthenticated user
-- =============================================================================
begin;
set local role anon;
select test.denied($$ select * from public.diary_entries $$, '[1] anon cannot read diary entries');
select test.denied($$ select * from public.diary_attachments $$, '[1] anon cannot read attachments');
select test.denied($$ select * from public.profiles $$, '[1] anon cannot read profiles');
select test.denied($$ insert into public.diary_entries (owner_id, title) values ('11111111-1111-1111-1111-111111111111','x') $$,
  '[1] anon cannot insert entries');
select test.ok((select count(*) from storage.objects) = 0, '[9] anon sees no storage objects');
rollback;

-- =============================================================================
-- Scenario 2/3/12: owner creates, edits, multiple entries same day
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set local request.jwt.claim.role = 'authenticated';

insert into public.diary_entries (id, owner_id, title, content, mood, diary_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Một ngày đẹp trời', 'Hôm nay mình đi dạo ở Hồ Gươm. 100% vui_vẻ', 'happy', '2026-10-27'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Buổi tối', 'Mệt nhưng bình yên', 'tired', '2026-10-27'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Hôm qua', 'Viết bù cho hôm qua', null, '2026-10-26');
select test.ok(true, '[2] owner can create entries');
select test.ok((select count(*) from public.diary_entries where diary_date = '2026-10-27') = 2,
  '[12] multiple entries on the same Vietnamese date are allowed');

select test.ok(test.affected($$ update public.diary_entries set title = 'Một ngày rất đẹp trời', mood = 'excited'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$) = 1, '[3] owner can edit own entry');

select test.denied($$ update public.diary_entries set owner_id = '22222222-2222-2222-2222-222222222222'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$, '[3] owner cannot re-assign entry ownership');

select test.denied($$ insert into public.diary_entries (owner_id, title) values ('22222222-2222-2222-2222-222222222222', 'giả mạo') $$,
  'owner cannot create an entry on behalf of someone else');

select test.denied($$ insert into public.diary_entries (owner_id, title, mood) values ('11111111-1111-1111-1111-111111111111', 'x', 'depressed') $$,
  'unknown moods are rejected by constraint');

select test.denied($$ insert into public.diary_entries (owner_id, title) values ('11111111-1111-1111-1111-111111111111', '   ') $$,
  'blank titles are rejected by constraint');

-- Owner can change preferences but never their role.
select test.ok(test.affected($$ update public.profiles set display_name = 'Ý nhỏ', theme = 'dark'
  where id = '11111111-1111-1111-1111-111111111111' $$) = 1, 'owner can update display name / theme');
select test.denied($$ update public.profiles set role = 'viewer' where id = '11111111-1111-1111-1111-111111111111' $$,
  'owner cannot change own role');
select test.ok(test.affected($$ update public.profiles set display_name = 'hacked'
  where id = '22222222-2222-2222-2222-222222222222' $$) = 0, 'owner cannot modify the viewer profile');

-- Drafts
insert into public.diary_drafts (owner_id, draft_key, title, content)
values ('11111111-1111-1111-1111-111111111111', 'new', 'nháp', 'đang viết dở...');
insert into public.diary_drafts (owner_id, entry_id, draft_key, title, content)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'sửa dở', '...');
select test.ok((select title from public.diary_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Một ngày rất đẹp trời',
  '[13] saving an edit draft does not touch the published entry');
commit;

-- =============================================================================
-- Scenario 7: owner uploads an image (storage + metadata)
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into storage.objects (bucket_id, name, metadata) values
  ('diary-files', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/f1.jpg', '{"size": 2048, "mimetype": "image/jpeg"}'),
  ('diary-files', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/a1.webm', '{"size": 4096, "mimetype": "audio/webm"}'),
  ('diary-files', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/unregistered.png', '{"size": 10, "mimetype": "image/png"}');
select test.ok(true, '[7][10] owner can upload image and audio into own entry folder');

insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'hồ gươm.jpg',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/f1.jpg', 'image/jpeg', 2048, 'image'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ghi âm.webm',
   '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/a1.webm', 'audio/webm', 4096, 'audio');
select test.ok(true, '[7][10] owner can register image + audio attachments');

select test.denied($$ insert into storage.objects (bucket_id, name) values
  ('diary-files', '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000001/x.jpg') $$,
  'owner cannot upload into another user''s folder');
select test.denied($$ insert into storage.objects (bucket_id, name) values
  ('diary-files', '11111111-1111-1111-1111-111111111111/bbbbbbbb-0000-0000-0000-000000000009/x.jpg') $$,
  'owner cannot upload for an entry that does not exist');
select test.denied($$ insert into storage.objects (bucket_id, name) values
  ('diary-files', '11111111-1111-1111-1111-111111111111/x.jpg') $$,
  'owner cannot upload outside an entry folder');
select test.ok(test.affected($$ update storage.objects set name = name || '.bak' where bucket_id = 'diary-files' $$) = 0,
  'files can never be overwritten/renamed (no UPDATE policy)');

select test.denied($$ insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x.svg',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/x.svg', 'image/svg+xml', 10, 'image') $$,
  'SVG (scriptable) images are rejected');
select test.denied($$ insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'big.pdf',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/big.pdf', 'application/pdf', 60000000, 'document') $$,
  'files over 50 MB are rejected');
select test.denied($$ insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x.jpg',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000002/x.jpg', 'image/jpeg', 10, 'image') $$,
  'attachment path must match its entry folder');
select test.denied($$ insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'x.pdf',
  '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/x.pdf', 'application/pdf', 10, 'image') $$,
  'attachment_type must match the MIME type');
select test.denied($$ update public.diary_attachments set file_name = 'renamed' $$,
  'attachments are immutable (no UPDATE privilege)');
commit;

-- =============================================================================
-- Scenario 5/6/8: viewer is strictly read-only
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local request.jwt.claim.role = 'authenticated';

select test.ok((select count(*) from public.diary_entries) = 3, '[5] viewer can read all diary entries');
select test.ok((select count(*) from public.diary_attachments) = 2, '[5] viewer can read attachment metadata');
select test.ok((select count(*) from public.profiles) = 2, 'viewer can see display names');
select test.ok((select count(*) from public.diary_drafts) = 0, 'viewer cannot see unfinished drafts');

select test.ok((select count(*) from storage.objects where name like '%/f1.jpg') = 1, '[8] viewer can access an authorised image');
select test.ok((select count(*) from storage.objects where name like '%/a1.webm') = 1, '[8] viewer can access an authorised audio file');
select test.ok((select count(*) from storage.objects where name like '%/unregistered.png') = 0,
  'viewer cannot list/read files that are not registered attachments');

select test.denied($$ insert into public.diary_entries (owner_id, title) values ('22222222-2222-2222-2222-222222222222', 'viewer writes') $$,
  '[6] viewer cannot create entries');
select test.denied($$ insert into public.diary_entries (owner_id, title) values ('11111111-1111-1111-1111-111111111111', 'viewer impersonates') $$,
  '[6] viewer cannot create entries as the owner');
select test.ok(test.affected($$ update public.diary_entries set title = 'hacked' $$) = 0, '[6] viewer cannot edit entries');
select test.ok(test.affected($$ delete from public.diary_entries $$) = 0, '[6] viewer cannot delete entries');
select test.ok(test.affected($$ delete from public.diary_attachments $$) = 0, 'viewer cannot delete attachments');
select test.denied($$ insert into public.diary_attachments (diary_id, uploaded_by, file_name, storage_path, mime_type, file_size, attachment_type)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'v.jpg',
  '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000001/v.jpg', 'image/jpeg', 10, 'image') $$,
  'viewer cannot register attachments');
select test.denied($$ insert into storage.objects (bucket_id, name) values
  ('diary-files', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/v.jpg') $$,
  'viewer cannot upload files');
select test.ok(test.affected($$ delete from storage.objects $$) = 0, 'viewer cannot delete files');
select test.denied($$ insert into public.diary_drafts (owner_id, draft_key) values ('22222222-2222-2222-2222-222222222222', 'new') $$,
  'viewer cannot create drafts');

select test.denied($$ update public.profiles set role = 'owner' where id = '22222222-2222-2222-2222-222222222222' $$,
  'viewer cannot escalate own role to owner');
select test.ok(test.affected($$ update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111' $$) = 0,
  'viewer cannot modify the owner profile');
select test.ok(test.affected($$ update public.profiles set display_name = 'Người đọc', language = 'en' where id = '22222222-2222-2222-2222-222222222222' $$) = 1,
  'viewer can change own display name / language');
select test.denied($$ insert into public.profiles (id, display_name, role) values ('33333333-3333-3333-3333-333333333333', 'x', 'viewer') $$,
  'users cannot create profiles');
select test.denied($$ delete from public.profiles $$, 'users cannot delete profiles');

-- Search respects RLS and is accent-insensitive
select test.ok((select count(*) from public.search_diary_entries('ho guom')) = 1, 'search is accent-insensitive (ho guom → Hồ Gươm)');
select test.ok((select count(*) from public.search_diary_entries('BÌNH YÊN')) = 1, 'search is case-insensitive');
select test.ok((select count(*) from public.search_diary_entries('100%')) = 1, 'search treats % literally');
select test.ok((select count(*) from public.search_diary_entries('%')) = 1, 'a bare % only matches entries containing %, not everything');
select test.ok((select count(*) from public.search_diary_entries('_')) = 1, 'a bare _ is not a wildcard');
select test.ok((select count(*) from public.search_diary_entries(null, 'tired')) = 1, 'search mood filter');
select test.ok((select count(*) from public.search_diary_entries(null, null, '2026-10-27', '2026-10-27')) = 2, 'search date range filter');
select test.ok((select count(*) from public.search_diary_entries(null, null, null, null, true)) = 1, 'search has-attachments filter');
commit;

-- =============================================================================
-- Authenticated user WITHOUT an assigned role (e.g. someone who signed up
-- before public signup was disabled) gets nothing.
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok((select count(*) from public.diary_entries) = 0, 'user without a role cannot read entries');
select test.ok((select count(*) from public.diary_attachments) = 0, 'user without a role cannot read attachments');
select test.ok((select count(*) from storage.objects) = 0, 'user without a role cannot read files');
select test.ok((select count(*) from public.search_diary_entries('a')) = 0, 'user without a role gets no search results');
select test.denied($$ insert into public.diary_entries (owner_id, title) values ('33333333-3333-3333-3333-333333333333', 'x') $$,
  'user without a role cannot create entries');
rollback;

-- =============================================================================
-- Scenario 11: entry created around midnight in Vietnam gets the Vietnamese date
-- =============================================================================
begin;
-- 2026-10-27 17:30 UTC = 2026-10-28 00:30 in Asia/Ho_Chi_Minh
select test.ok((timestamptz '2026-10-27 17:30:00+00' at time zone 'Asia/Ho_Chi_Minh')::date = date '2026-10-28',
  '[11] 00:30 Vietnam time maps to the next calendar day');
select test.ok((timestamptz '2026-10-27 16:59:59+00' at time zone 'Asia/Ho_Chi_Minh')::date = date '2026-10-27',
  '[11] 23:59:59 Vietnam time stays on the same calendar day');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.diary_entries (id, owner_id, title) values ('aaaaaaaa-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', 'mặc định');
select test.ok((select diary_date from public.diary_entries where id = 'aaaaaaaa-0000-0000-0000-00000000000f')
  = (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'default diary_date uses the Vietnamese date, not UTC');
rollback;

-- =============================================================================
-- Scenario 4: owner deletes (attachments metadata cascades)
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok(test.affected($$ delete from storage.objects where bucket_id = 'diary-files'
  and name like '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/%' $$) = 3,
  '[4] owner can delete own files');
select test.ok(test.affected($$ delete from public.diary_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$) = 1,
  '[4] owner can delete own entry');
select test.ok((select count(*) from public.diary_attachments where diary_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  '[4] attachment rows are removed with the entry (cascade)');
select test.ok((select count(*) from public.diary_drafts where entry_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0,
  '[4] edit drafts are removed with the entry (cascade)');
commit;

-- =============================================================================
-- Saved links ("Liên kết"): owner manages, viewer reads, anon nothing
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.saved_links (id, owner_id, url, title, note) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'https://www.youtube.com/watch?v=abc', 'Bài hát hôm nay', 'Nghe lúc đi dạo quanh hồ');
select test.ok(true, '[links] owner can save a link with a note');
select test.ok((select created_at is not null from public.saved_links where id = 'cccccccc-0000-0000-0000-000000000001'),
  '[links] saved time is recorded automatically');
select test.ok(test.affected($$ update public.saved_links set note = 'đã sửa' where id = 'cccccccc-0000-0000-0000-000000000001' $$) = 1,
  '[links] owner can edit a link');
select test.denied($$ insert into public.saved_links (owner_id, url) values ('11111111-1111-1111-1111-111111111111', 'javascript:alert(1)') $$,
  '[links] javascript: links are rejected');
select test.denied($$ insert into public.saved_links (owner_id, url) values ('11111111-1111-1111-1111-111111111111', 'data:text/html,<script>x</script>') $$,
  '[links] data: links are rejected');
select test.denied($$ update public.saved_links set owner_id = '22222222-2222-2222-2222-222222222222' $$,
  '[links] link ownership cannot be reassigned');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select test.ok((select count(*) from public.saved_links) = 1, '[links] viewer can read saved links');
select test.denied($$ insert into public.saved_links (owner_id, url) values ('22222222-2222-2222-2222-222222222222', 'https://example.com') $$,
  '[links] viewer cannot add links');
select test.denied($$ insert into public.saved_links (owner_id, url) values ('11111111-1111-1111-1111-111111111111', 'https://example.com') $$,
  '[links] viewer cannot add links as the owner');
select test.ok(test.affected($$ update public.saved_links set note = 'hacked' $$) = 0, '[links] viewer cannot edit links');
select test.ok(test.affected($$ delete from public.saved_links $$) = 0, '[links] viewer cannot delete links');
commit;

begin;
set local role anon;
select test.denied($$ select * from public.saved_links $$, '[links] anon cannot read links');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select test.ok((select count(*) from public.saved_links) = 0, '[links] user without a role cannot read links');
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select test.ok(test.affected($$ delete from public.saved_links where id = 'cccccccc-0000-0000-0000-000000000001' $$) = 1,
  '[links] owner can delete a link');
commit;

\o
\echo ''
\echo 'ALL RLS TESTS PASSED'
