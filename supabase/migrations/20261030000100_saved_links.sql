-- =============================================================================
-- Nhật Ký Của Ý — saved links ("Liên kết")
-- A link to any web page, an optional name, a note, and when it was saved.
--   owner  : create / edit / delete own links
--   viewer : read only
--   anon   : nothing
-- =============================================================================

create table if not exists public.saved_links (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  url         text not null,
  title       text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now(),   -- "saved at" (UTC; shown in Vietnam time)
  updated_at  timestamptz not null default now(),
  constraint saved_links_url_len      check (char_length(url) between 8 and 2048),
  -- Only real web links: blocks javascript:, data:, file: … (no script injection via href)
  constraint saved_links_url_scheme   check (url ~* '^https?://[^\s]+$'),
  constraint saved_links_title_len    check (char_length(title) <= 200),
  constraint saved_links_note_len     check (char_length(note) <= 2000)
);

create index if not exists saved_links_owner_created_idx on public.saved_links (owner_id, created_at desc);
create index if not exists saved_links_created_idx       on public.saved_links (created_at desc);

-- Same guards as diary entries: only the owner account can own links,
-- owner_id can never change, created_at is fixed, updated_at is maintained.
drop trigger if exists saved_links_enforce_owner on public.saved_links;
create trigger saved_links_enforce_owner
  before insert on public.saved_links
  for each row execute function private.enforce_entry_owner();

drop trigger if exists saved_links_guard_update on public.saved_links;
create trigger saved_links_guard_update
  before update on public.saved_links
  for each row execute function private.guard_entry_update();

-- Privileges --------------------------------------------------------------------
alter table public.saved_links enable row level security;
revoke all on public.saved_links from anon;
revoke all on public.saved_links from authenticated;
grant select, insert, update, delete on public.saved_links to authenticated;

-- Policies ----------------------------------------------------------------------
drop policy if exists "links: members can read" on public.saved_links;
create policy "links: members can read"
  on public.saved_links for select
  to authenticated
  using ((select private.is_member()));

drop policy if exists "links: owner can insert" on public.saved_links;
create policy "links: owner can insert"
  on public.saved_links for insert
  to authenticated
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "links: owner can update" on public.saved_links;
create policy "links: owner can update"
  on public.saved_links for update
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()))
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "links: owner can delete" on public.saved_links;
create policy "links: owner can delete"
  on public.saved_links for delete
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));
