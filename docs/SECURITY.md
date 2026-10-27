# Security model

This diary holds very personal writing. Security is enforced **in the database and storage layer**, so it holds even if someone bypasses the web interface and calls the Supabase API directly with a valid login.

## Layers

| Layer | What it does |
| --- | --- |
| Supabase Auth | Email + password. Public sign-up is disabled in the dashboard; accounts are created by hand. |
| `proxy.ts` | Refreshes the session cookie; sends signed-out visitors to `/login`. A convenience only. |
| Server pages & actions | Every page calls `requireMember()` / `requireOwner()`; every server action re-reads the role **from the database**. Roles are never accepted from the browser. |
| Postgres RLS | The real gate. Policies on every table decide what each account can read or change. |
| Storage policies | The `diary-files` bucket is private. Policies decide who can upload, read and delete each file. |
| DB constraints & triggers | Valid moods, sizes, MIME types, path shapes; immutable owner/role/created_at. |

The app uses only the **publishable (anon) key**. The `service_role` key is not used anywhere and must not be added to Vercel.

## How roles are assigned

- `public.profiles.role` is `owner` or `viewer`. Only an administrator can set it, by running `supabase/admin/assign-roles.sql` in the SQL editor.
- Signed-in users have **no INSERT/DELETE** privilege on `profiles`, and UPDATE privilege on only `display_name`, `language`, `theme`, `onboarded_at`.
- A trigger (`private.guard_profile_update`) additionally rejects any role/id change by the `authenticated` role.
- Unique partial indexes allow **one owner** and **one viewer** at most.
- An account that exists in Auth but has no profile row gets nothing: role helpers return false, so every policy denies.

## How RLS protects diary entries

Helper functions in a non-exposed `private` schema (`is_owner()`, `is_member()`) read the caller's role from `profiles` using `auth.uid()`.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `diary_entries` | owner + viewer | owner, `owner_id = auth.uid()` | owner, own rows | owner, own rows |
| `diary_attachments` | owner + viewer | owner, for own entry, `uploaded_by = auth.uid()` | **nobody** (immutable) | owner, own entries |
| `diary_drafts` | owner only | owner only | owner only | owner only |
| `profiles` | members (to show names) | nobody | own row, preference columns only | nobody |

Extra guards: a trigger forbids re-assigning `owner_id`; another forbids entries owned by a non-owner profile (also from the SQL editor). `anon` has every privilege revoked on these tables.

## How private files are accessed

- Bucket `diary-files` is **private**, limited to 50 MB per file and an allow-list of image/audio/document MIME types (no SVG, HTML, JS or executables).
- Path layout `<owner uuid>/<entry uuid>/<random uuid>.<ext>`.
- **Upload** (owner only): the first folder must be the owner's uid and the second an entry the owner owns. No UPDATE policy → files can never be overwritten.
- **Read**: the owner can read their own folder; the viewer can read **only objects registered in `diary_attachments`**. Anonymous users have no policy at all.
- After an upload, the server action `registerAttachment` re-reads the object's real size and MIME type from storage, validates them against the server-side limits and deletes anything invalid before recording metadata.
- Files are shown via **signed URLs created with the user's own session** (so policies apply), valid for 1 hour (15 minutes for export). Documents are served with `Content-Disposition: attachment`, so they download instead of rendering in the browser.
- Deleting an entry first deletes its files (including orphaned uploads in its folder), then the row; attachment rows cascade.

## Viewer permissions

Can: sign in/out, read all entries, view photos, play recordings, download files, see the calendar and mood history, search, change own display name, password, language and theme.

Cannot (blocked by RLS/storage policies, not just hidden): create/edit/delete entries, upload/delete files, see drafts, change any role, edit the owner's profile, use the export endpoint.

## Owner permissions

Everything the viewer can, plus create/edit/delete entries, upload/delete attachments, record audio, keep drafts, export the diary, and complete the one-time welcome.

## Application hardening

- **XSS**: diary text is never rendered as HTML. A tiny formatter turns `**bold**` etc. into React text nodes; the export's `diary.html` escapes everything. No `dangerouslySetInnerHTML` except a static theme script.
- **Headers** (`next.config.ts`): strict Content-Security-Policy (only self + your Supabase origin, no third-party scripts), `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy: same-origin`, `Permissions-Policy` (microphone only for this site), `X-Robots-Tag: noindex`.
- **Caching**: private pages are `Cache-Control: private, no-store`; robots are disallowed.
- **Input validation** on the server for every action (lengths, dates, moods, file types/sizes, UUIDs, storage paths); text normalised to NFC and stripped of control characters.
- **Open redirects**: the post-login `next` parameter only accepts same-site paths.
- **Errors**: generic messages to the user; diary content is never logged or put in page titles/metadata.
- **No analytics, ads or tracking.**

## Remaining limitations

- The viewer can technically keep a copy of anything they can read (downloads, screenshots) — inherent to read access.
- Signed URLs work for anyone who has the link until they expire (≤ 1 hour). Don't share them.
- Supabase Auth rate-limits logins, but there is no extra CAPTCHA/2FA. Use strong passwords; Supabase MFA (TOTP) could be added later.
- `script-src 'unsafe-inline'` is allowed because Next.js needs inline bootstrap scripts; a nonce-based CSP would be stricter but forces fully dynamic rendering.
- Supabase stores data unencrypted at the application level (encrypted at rest by the provider). Supabase/Vercel staff and anyone with the database password could read it.
- If an upload succeeds but the browser closes before registration, an orphaned file can remain in the entry's folder until the entry is deleted (it is not readable by the viewer).
- Leaked-password protection is a paid Supabase feature and is not enabled.
