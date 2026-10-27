-- =============================================================================
-- Nhật Ký Của Ý — Row Level Security
--
--   owner  : full CRUD on their own entries, attachments and drafts
--   viewer : read-only access to entries + attachments (never drafts)
--   anon   : nothing at all
--
-- Policies call helpers in the private schema, wrapped in (select ...) so
-- Postgres evaluates them once per statement instead of once per row.
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.diary_entries     enable row level security;
alter table public.diary_attachments enable row level security;
alter table public.diary_drafts      enable row level security;

-- Note: RLS is intentionally not FORCEd. The API roles (anon, authenticated)
-- never own these tables, so RLS always applies to them, while the
-- SECURITY DEFINER role helpers (owned by postgres) can still read profiles.

-- -----------------------------------------------------------------------------
-- Table privileges. The anonymous role gets nothing.
-- -----------------------------------------------------------------------------
revoke all on public.profiles          from anon;
revoke all on public.diary_entries     from anon;
revoke all on public.diary_attachments from anon;
revoke all on public.diary_drafts      from anon;

-- profiles: users may read, and update ONLY these preference columns.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, language, theme, onboarded_at) on public.profiles to authenticated;

grant select, insert, update, delete on public.diary_entries to authenticated;

-- Attachments are immutable once registered (no UPDATE privilege at all).
revoke all on public.diary_attachments from authenticated;
grant select, insert, delete on public.diary_attachments to authenticated;

grant select, insert, update, delete on public.diary_drafts to authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
drop policy if exists "profiles: members can read" on public.profiles;
create policy "profiles: members can read"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));

drop policy if exists "profiles: update own preferences" on public.profiles;
create policy "profiles: update own preferences"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- No INSERT / DELETE policies: profiles are managed by the administrator only.

-- -----------------------------------------------------------------------------
-- diary_entries
-- -----------------------------------------------------------------------------
drop policy if exists "entries: members can read" on public.diary_entries;
create policy "entries: members can read"
  on public.diary_entries for select
  to authenticated
  using ((select private.is_member()));

drop policy if exists "entries: owner can insert" on public.diary_entries;
create policy "entries: owner can insert"
  on public.diary_entries for insert
  to authenticated
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "entries: owner can update" on public.diary_entries;
create policy "entries: owner can update"
  on public.diary_entries for update
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()))
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "entries: owner can delete" on public.diary_entries;
create policy "entries: owner can delete"
  on public.diary_entries for delete
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- diary_attachments
-- -----------------------------------------------------------------------------
drop policy if exists "attachments: members can read" on public.diary_attachments;
create policy "attachments: members can read"
  on public.diary_attachments for select
  to authenticated
  using ((select private.is_member()));

drop policy if exists "attachments: owner can insert" on public.diary_attachments;
create policy "attachments: owner can insert"
  on public.diary_attachments for insert
  to authenticated
  with check (
    (select private.is_owner())
    and uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.diary_entries e
      where e.id = diary_id and e.owner_id = (select auth.uid())
    )
  );

-- No UPDATE policy: attachments are immutable.

drop policy if exists "attachments: owner can delete" on public.diary_attachments;
create policy "attachments: owner can delete"
  on public.diary_attachments for delete
  to authenticated
  using (
    (select private.is_owner())
    and exists (
      select 1 from public.diary_entries e
      where e.id = diary_id and e.owner_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- diary_drafts — owner only; the viewer never sees unfinished writing.
-- -----------------------------------------------------------------------------
drop policy if exists "drafts: owner can read" on public.diary_drafts;
create policy "drafts: owner can read"
  on public.diary_drafts for select
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "drafts: owner can insert" on public.diary_drafts;
create policy "drafts: owner can insert"
  on public.diary_drafts for insert
  to authenticated
  with check (
    (select private.is_owner())
    and owner_id = (select auth.uid())
    and (
      entry_id is null
      or exists (select 1 from public.diary_entries e where e.id = entry_id and e.owner_id = (select auth.uid()))
    )
  );

drop policy if exists "drafts: owner can update" on public.diary_drafts;
create policy "drafts: owner can update"
  on public.diary_drafts for update
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()))
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists "drafts: owner can delete" on public.diary_drafts;
create policy "drafts: owner can delete"
  on public.diary_drafts for delete
  to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));
