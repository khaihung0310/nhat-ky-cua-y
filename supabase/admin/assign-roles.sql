-- =============================================================================
-- ADMIN ONLY — run in the Supabase SQL editor AFTER creating the two users in
-- Authentication → Users (see README, "Create the two accounts").
--
-- Replace the two e-mail addresses below, then run the whole script once.
-- This is the ONLY supported way to assign roles. End users can never change
-- their own role (column privileges + trigger + RLS all prevent it).
--
-- Do not commit real e-mail addresses if your repository is public.
-- =============================================================================

begin;

-- 1) The OWNER (the person who writes the diary)
insert into public.profiles (id, display_name, role, language)
select u.id, 'Ý', 'owner', 'vi'
from auth.users u
where lower(u.email) = lower('owner@example.com')   -- ← change me
on conflict (id) do update set role = 'owner';

-- 2) The VIEWER (read-only)
insert into public.profiles (id, display_name, role, language)
select u.id, 'Viewer', 'viewer', 'vi'
from auth.users u
where lower(u.email) = lower('viewer@example.com')  -- ← change me
on conflict (id) do update set role = 'viewer';

-- Sanity check: you should see exactly two rows, one owner and one viewer.
select p.role, p.display_name, u.email, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.role;

commit;
