-- =============================================================================
-- Nhật Ký Của Ý — core schema
-- Tables, constraints, indexes, helper functions and triggers.
-- Row Level Security policies live in 20261027000200_rls_policies.sql.
-- Storage bucket + policies live in 20261027000300_storage.sql.
--
-- Run these files IN ORDER in the Supabase SQL editor (or with `supabase db push`).
-- All statements are idempotent where practical, but they are designed to be
-- applied once to a fresh project.
-- =============================================================================

-- Extensions (Supabase installs extensions into the `extensions` schema).
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
-- Supabase already grants this; repeated here so search works for signed-in users.
grant usage on schema extensions to authenticated;

-- A private schema that is NOT exposed through the Data API.
-- Helper functions used by RLS policies live here.
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Helper: accent-insensitive text for Vietnamese search ("nhat ky" finds "nhật ký")
-- -----------------------------------------------------------------------------
create or replace function private.f_unaccent(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- One row per authorised account. Rows are created ONLY by an administrator
-- (SQL editor / service role) — there is no insert policy for end users.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  role          text not null,
  language      text not null default 'vi',
  theme         text not null default 'system',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_role_valid       check (role in ('owner', 'viewer')),
  constraint profiles_language_valid   check (language in ('vi', 'en')),
  constraint profiles_theme_valid      check (theme in ('light', 'dark', 'system'))
);

comment on table public.profiles is 'Authorised diary accounts. role is assigned by an administrator only.';

-- Exactly one owner and at most one viewer.
create unique index if not exists profiles_single_owner  on public.profiles (role) where role = 'owner';
create unique index if not exists profiles_single_viewer on public.profiles (role) where role = 'viewer';

-- -----------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies can read the caller's role
-- without recursive RLS evaluation). They only ever reveal the caller's own role.
-- -----------------------------------------------------------------------------
create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'owner', false)
$$;

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('owner', 'viewer'), false)
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_owner()         from public, anon;
revoke all on function private.is_member()        from public, anon;
revoke all on function private.f_unaccent(text)   from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_owner()         to authenticated;
grant execute on function private.is_member()        to authenticated;
grant execute on function private.f_unaccent(text)   to authenticated;

-- -----------------------------------------------------------------------------
-- Profile guard: end users can never change role / id / created_at.
-- Only the database administrator (postgres / service role, e.g. the SQL editor)
-- can assign roles.
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'Changing roles is not allowed' using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Changing profile id is not allowed' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- -----------------------------------------------------------------------------
-- diary_entries
-- diary_date is the intended *Vietnamese* calendar date (Asia/Ho_Chi_Minh).
-- created_at / updated_at are stored in UTC (timestamptz).
-- Multiple entries per day are allowed (no unique constraint on diary_date).
-- -----------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  content     text not null default '',
  mood        text,
  diary_date  date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint diary_entries_title_len    check (char_length(btrim(title)) between 1 and 200),
  constraint diary_entries_content_len  check (char_length(content) <= 100000),
  constraint diary_entries_mood_valid   check (mood is null or mood in ('happy', 'sad', 'anxious', 'angry', 'peaceful', 'excited', 'tired')),
  constraint diary_entries_date_range   check (diary_date between date '1900-01-01' and date '2200-12-31')
);

create index if not exists diary_entries_owner_date_idx
  on public.diary_entries (owner_id, diary_date desc, created_at desc);
create index if not exists diary_entries_date_idx
  on public.diary_entries (diary_date desc, created_at desc);
create index if not exists diary_entries_mood_idx
  on public.diary_entries (mood) where mood is not null;
create index if not exists diary_entries_search_trgm_idx
  on public.diary_entries
  using gin (lower(private.f_unaccent(title || ' ' || content)) extensions.gin_trgm_ops);

-- Only an account whose profile role is 'owner' can own entries (defence in depth,
-- also applies to inserts made from the SQL editor).
create or replace function private.enforce_entry_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.owner_id and p.role = 'owner') then
    raise exception 'Diary entries can only belong to the owner account' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_entry_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Changing the owner of an entry is not allowed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists diary_entries_enforce_owner on public.diary_entries;
create trigger diary_entries_enforce_owner
  before insert on public.diary_entries
  for each row execute function private.enforce_entry_owner();

drop trigger if exists diary_entries_guard_update on public.diary_entries;
create trigger diary_entries_guard_update
  before update on public.diary_entries
  for each row execute function private.guard_entry_update();

-- -----------------------------------------------------------------------------
-- diary_attachments
-- Metadata only. Binary files live in the private Storage bucket `diary-files`
-- at path: <owner uuid>/<entry uuid>/<random uuid>.<ext>
-- -----------------------------------------------------------------------------
create table if not exists public.diary_attachments (
  id               uuid primary key default gen_random_uuid(),
  diary_id         uuid not null references public.diary_entries (id) on delete cascade,
  uploaded_by      uuid not null references public.profiles (id) on delete cascade,
  file_name        text not null,
  storage_path     text not null,
  mime_type        text not null,
  file_size        bigint not null,
  attachment_type  text not null,
  duration_ms      integer,
  created_at       timestamptz not null default now(),
  constraint diary_attachments_path_unique   unique (storage_path),
  constraint diary_attachments_name_len      check (char_length(file_name) between 1 and 255),
  constraint diary_attachments_path_shape    check (
    char_length(storage_path) <= 512
    and storage_path like (uploaded_by::text || '/' || diary_id::text || '/%')
    and storage_path !~ '\.\.'
  ),
  constraint diary_attachments_mime_shape    check (mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'),
  constraint diary_attachments_mime_safe     check (mime_type not in ('image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/javascript', 'application/javascript')),
  constraint diary_attachments_size_valid    check (file_size > 0 and file_size <= 52428800),
  constraint diary_attachments_type_valid    check (attachment_type in ('image', 'audio', 'document')),
  constraint diary_attachments_type_matches  check (
    (attachment_type = 'image' and mime_type like 'image/%')
    or (attachment_type = 'audio' and mime_type like 'audio/%')
    or (attachment_type = 'document' and mime_type not like 'image/%' and mime_type not like 'audio/%')
  ),
  constraint diary_attachments_duration_ok   check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 86400000))
);

create index if not exists diary_attachments_diary_idx
  on public.diary_attachments (diary_id, attachment_type, created_at);
create index if not exists diary_attachments_uploader_idx
  on public.diary_attachments (uploaded_by);

-- -----------------------------------------------------------------------------
-- diary_drafts — unfinished writing, kept separate from published entries so an
-- incomplete draft can never overwrite a published entry.
-- draft_key = 'new' for a brand-new entry, or the entry uuid when editing.
-- -----------------------------------------------------------------------------
create table if not exists public.diary_drafts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  entry_id    uuid references public.diary_entries (id) on delete cascade,
  draft_key   text not null,
  title       text not null default '',
  content     text not null default '',
  mood        text,
  diary_date  date,
  updated_at  timestamptz not null default now(),
  constraint diary_drafts_unique_key    unique (owner_id, draft_key),
  constraint diary_drafts_key_matches   check (
    (draft_key = 'new' and entry_id is null) or (entry_id is not null and draft_key = entry_id::text)
  ),
  constraint diary_drafts_title_len     check (char_length(title) <= 500),
  constraint diary_drafts_content_len   check (char_length(content) <= 100000),
  constraint diary_drafts_mood_valid    check (mood is null or mood in ('happy', 'sad', 'anxious', 'angry', 'peaceful', 'excited', 'tired'))
);

-- -----------------------------------------------------------------------------
-- Search (SECURITY INVOKER → the caller's RLS policies apply).
-- Accent-insensitive, case-insensitive substring search on title + content,
-- with optional mood / date range / has-attachments filters.
-- -----------------------------------------------------------------------------
create or replace function public.search_diary_entries(
  p_query            text    default null,
  p_mood             text    default null,
  p_from             date    default null,
  p_to               date    default null,
  p_has_attachments  boolean default null,
  p_limit            integer default 20,
  p_offset           integer default 0
)
returns setof public.diary_entries
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.diary_entries e
  where
    (
      p_query is null or btrim(p_query) = ''
      -- unaccent first, then lower(): works the same under any database locale
      or lower(private.f_unaccent(e.title || ' ' || e.content))
         like '%' || lower(private.f_unaccent(
              replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_')
            )) || '%' escape '\'
    )
    and (p_mood is null or e.mood = p_mood)
    and (p_from is null or e.diary_date >= p_from)
    and (p_to   is null or e.diary_date <= p_to)
    and (
      p_has_attachments is null
      or p_has_attachments = exists (select 1 from public.diary_attachments a where a.diary_id = e.id)
    )
  order by e.diary_date desc, e.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.search_diary_entries(text, text, date, date, boolean, integer, integer) from public, anon;
grant execute on function public.search_diary_entries(text, text, date, date, boolean, integer, integer) to authenticated;
