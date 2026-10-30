# Nhật Ký Của Ý 🌷

A private, bilingual (Tiếng Việt / English) digital diary — a small notebook with pressed tulips, made as a gift.

- **Owner** writes: text, mood, photos, voice recordings, files.
- **Viewer** reads everything, changes nothing (enforced in the database, not just hidden buttons).
- No public sign-up, no trackers, no paid services. Runs on the free tiers of Vercel and Supabase.

> Security model: [`docs/SECURITY.md`](docs/SECURITY.md) · Test results: [`docs/TESTING.md`](docs/TESTING.md)

---

## Contents

1. [Features](#features)
2. [Technology](#technology)
3. [Project layout](#project-layout)
4. [Local development](#local-development)
5. [Supabase setup (step by step)](#supabase-setup)
6. [Deploying to Vercel](#deploying-to-vercel)
7. [Production checklist](#production-checklist)
8. [Backups](#backups)
9. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
| --- | --- |
| Dashboard | “Chào Ý, hôm nay của cậu thế nào? 🌷”, today's Vietnamese date, a gentle daily line, quick actions, recent memories |
| Writing | Distraction-free editor (works with Vietnamese IMEs), light formatting (`**bold**`, `*italic*`, `> quote`, `- list`), mood, back-dating |
| Drafts | Saved instantly on the device and synced to the database every few seconds; restore after refresh / crash / offline; never overwrite a published page |
| Attachments | Many photos, voice recordings and documents per page, always shown **after** the text: gallery → recordings → files. Drag & drop, progress bars, retry, client-side photo compression |
| Voice diary | Native `MediaRecorder` — start / pause / resume / stop / preview / keep / delete. Format detected per browser (WebM/Opus, Safari MP4/AAC, Ogg) |
| Calendar | Monthly grid in Vietnamese dates, mood markers, many pages per day, jump to today, “write for this day” |
| Moods | Gentle, non-judgemental month view and day-by-day list. No scores, no analysis |
| Search | Accent-insensitive (“ho guom” finds “Hồ Gươm”), by title/content/date (`27/10/2026`), filters for mood, date range, attachments |
| Settings | Display name, password, language, theme (light/dark/system), backup export (owner), log out |
| First login | One-time welcome letter for the owner, remembered in the database |
| Export | ZIP with `diary.json`, a readable `diary.html`, and every original file |

All dates use **Asia/Ho_Chi_Minh (UTC+7)**: timestamps are stored in UTC, the diary date is stored as a plain Vietnamese calendar date, and the calendar groups by that date — never by the browser's timezone.

## Technology

Next.js 16 (App Router, Server Actions, Route Handlers) · TypeScript · Tailwind CSS v4 · shadcn/ui-style components (owned source in `components/ui`) · Lucide icons · Motion · Supabase (Postgres + RLS, Auth, private Storage) · Vercel Hobby.

Runtime dependencies are deliberately few: `next`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `motion`, `lucide-react`, `jszip` (loaded only when exporting), `clsx`, `tailwind-merge`, `class-variance-authority`, `server-only`.

## Project layout

```
app/
  login/                 sign-in (no sign-up page exists)
  welcome/               owner's one-time welcome
  (diary)/               all private pages (layout checks the session + role)
    page.tsx             dashboard
    entries/             list + search, [id] reader, [id]/edit, new
    calendar/ moods/ settings/
  actions/               server actions (entries, drafts, profile, auth)
  api/export/            owner-only export manifest
components/              ui primitives, editor, recorder, gallery, calendar…
lib/                     pure logic (time, calendar, files, i18n, validation…) + Supabase clients
proxy.ts                 refreshes the session; sends signed-out visitors to /login
supabase/
  migrations/            schema, RLS, storage bucket + policies
  admin/assign-roles.sql the only way to grant owner/viewer
  tests/                 RLS test-suite + local runner
tests/unit/              unit tests (node:test, no extra dependencies)
docs/                    SECURITY.md, TESTING.md
```

## Local development

Requirements: **Node.js 22** (LTS) and npm.

```bash
npm install
cp .env.example .env.local      # then fill in your Supabase URL + publishable key
npm run dev                     # http://localhost:3000
```

Quality checks:

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm test            # unit tests
npm run build       # production build
npm run check       # all of the above
npm run test:db     # RLS tests against a throwaway local PostgreSQL (needs postgres server binaries)
```

> On macOS, `npm run test:db` needs PostgreSQL ≥ 15 installed (e.g. `brew install postgresql@16`), then
> `PG_BIN=$(brew --prefix postgresql@16)/bin npm run test:db`. No Docker or Supabase account needed.

---

## Supabase setup

### 1. Create the project

1. Go to <https://supabase.com>, sign in with GitHub (free, no credit card).
2. **New project** → name `nhat-ky-cua-y`, generate a strong database password and keep it in a password manager (the app never needs it).
3. **Region:** choose **Southeast Asia (Singapore)** — the closest region to Vietnam, so the diary feels fast for Ý. (Sydney also works if most reading happens in Australia.)
4. Plan: **Free**.

### 2. Apply the database migrations

Either way works:

**A. SQL editor (simplest)** — Dashboard → *SQL Editor* → *New query*. Paste and **Run** each file **in order**:

1. `supabase/migrations/20261027000100_core_schema.sql`
2. `supabase/migrations/20261027000200_rls_policies.sql`
3. `supabase/migrations/20261027000300_storage.sql`

**B. Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 3. Check the private storage bucket

Migration 3 creates the bucket for you. Verify in *Storage*: a bucket named **`diary-files`** exists and is marked **Private** (not Public). Its file-size limit is 50 MB and only the allowed photo/audio/document types are accepted.

If you prefer to create it by hand: *Storage → New bucket* → name `diary-files`, **Public bucket: off**, then re-run migration 3 (it updates the limits and adds the policies).

### 4. Configure authentication and disable public sign-up

Dashboard → *Authentication*:

1. **Sign In / Providers → Email**: enabled. *Confirm email* may stay on.
2. **Sign In / Providers → User Signups**: turn **“Allow new users to sign up” OFF**. This is what disables public registration.
3. **URL Configuration**: set *Site URL* to your Vercel URL (after deployment, e.g. `https://nhat-ky-cua-y.vercel.app`). For local development add `http://localhost:3000` to *Redirect URLs*.
4. Passwords need at least 6 characters (the Supabase minimum).

Even if sign-up were accidentally re-enabled, a new account has **no role** and the database returns nothing to it (tested).

### 5. Create the owner account

*Authentication → Users → Add user → Create new user*:

- Email: Ý's email · Password: a temporary password (6+ characters) · **Auto Confirm User: on**.

Give Ý the password privately; she can change it in *Cài đặt → Đổi mật khẩu*.

#### Alternative: invite by e-mail (the person sets their own password)

1. *Authentication → URL Configuration*: **Site URL** = your app address (`http://localhost:3000` while testing, the Vercel URL in production).
2. *Authentication → Emails → Invite user*: subject `Một món quà nhỏ dành cho cậu 🌷`, body = contents of `supabase/templates/invite.html`. (Optional: *Reset password* → `supabase/templates/reset-password.html`.)
3. *Authentication → Users → Add user → Send invitation* with the e-mail.
4. The link opens `/auth/confirm` → **Đặt mật khẩu** → (owner) the welcome letter. The default Supabase template also works: the app picks the session up from the link.
5. Supabase's built-in mailer only delivers to members of your Supabase team and a few e-mails per hour. To reach any Gmail address, use Gmail as SMTP (free): turn on 2-Step Verification on your Google account → create an **App password** (myaccount.google.com/apppasswords) → *Project Settings → Authentication → SMTP Settings*: host `smtp.gmail.com`, port `465`, username = your Gmail address, password = the 16-character app password, sender = the same Gmail address.

You can run `assign-roles.sql` right after sending the invitation — the account already exists.

### 6. Create the viewer account

Same as above with your own email (*Auto Confirm User: on*).

### 7. Assign the roles (securely)

Roles are granted **only** by running SQL as the database administrator:

1. Open `supabase/admin/assign-roles.sql`, replace `owner@example.com` and `viewer@example.com` with the two real emails (in the SQL editor — don't commit real emails if the repo is public).
2. Run it in the *SQL Editor*. The final `select` should show exactly one `owner` and one `viewer`.

Users cannot change their own role: column privileges, a trigger and RLS all block it, and the database allows only one owner and one viewer.

### 8. Get the environment variables

*Project Settings → API Keys* (or *Data API*):

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** key (`sb_publishable_…`). Older projects: the legacy **anon public** key works too. |

**Never** use the `service_role` / secret key in this app. It isn't needed anywhere.

Optional upload limits (MB): `NEXT_PUBLIC_MAX_IMAGE_MB` (15), `NEXT_PUBLIC_MAX_AUDIO_MB` (25), `NEXT_PUBLIC_MAX_DOCUMENT_MB` (25). Max 50.

---

## Deploying to Vercel

> Nothing is deployed automatically. These steps are for you to run when ready.

1. **Push to GitHub**
   ```bash
   git add -A
   git commit -m "Nhật Ký Của Ý: initial version"
   git push -u origin main
   ```
   `.env.local` is git-ignored — double-check with `git status` that it is not staged.
2. **Connect to Vercel**: <https://vercel.com> → sign in with GitHub → *Add New… → Project* → import `khaihung0310/nhat-ky-cua-y`. Framework preset: Next.js (auto). Plan: Hobby.
3. **Environment variables** (Project → Settings → Environment Variables, for Production *and* Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (+ optional limits).
4. **Deploy**. You get `https://<project>.vercel.app` — no custom domain needed.
5. **Supabase auth URLs**: set *Site URL* to that address and add it to *Redirect URLs* (step 4.3 above).

## Production checklist

Do these once after the first deploy (they need real accounts, so they can't be automated here):

- [ ] **Login**: owner and viewer can sign in; a wrong password shows a gentle error; `/` while signed out redirects to `/login`.
- [ ] **Owner first login** shows the welcome letter once, then never again (also on another device).
- [ ] **Database permissions**: as the viewer, there is no “Viết” button, `/entries/new` redirects home, and the entry page shows “Chế độ chỉ đọc”. For a stronger check, run `npm run test:db` locally.
- [ ] **Private files**: open a photo, copy its URL, wait > 1 hour → the link has expired. Paste `https://<ref>.supabase.co/storage/v1/object/public/diary-files/<anything>` in a private window → it fails (bucket is private).
- [ ] **Audio on mobile**: record on an iPhone (Safari) and an Android phone (Chrome); allow the microphone; pause/resume; save; play back on the other device.
- [ ] **Vietnam time**: write an entry shortly after 00:00 Vietnam time (UTC+7) — it must appear on the *new* day in the calendar, whatever the device's timezone.
- [ ] **Language**: switch Tiếng Việt ⇄ English on the login page and in Settings.
- [ ] **Backup**: Settings → *Tải bản sao lưu* → open `diary.html` from the ZIP.

## Backups

The **owner** can download a full backup any time (*Cài đặt → Sao lưu nhật ký*): a ZIP containing `diary.json` (complete structured data), `diary.html` (open in any browser), and every original photo, recording and file. The ZIP is built in the browser, files are fetched straight from private storage with 15-minute signed links, so large diaries don't hit Vercel's function limits.

Please export regularly (e.g. monthly) and keep the ZIP somewhere safe and private. **Supabase must not be the only copy of these memories.**

Limitations: the browser holds the ZIP in memory, so a diary with several GB of media may be slow on a phone — export from a laptop. Files that fail to download are listed in `missing-files.txt`.

## Free-tier notes

- **Supabase Free pauses a project after ~1 week without activity.** Opening the diary regularly keeps it awake; if paused, restore it from the dashboard (data is kept).
- Supabase Free includes ~500 MB database and 1 GB file storage. Photos are compressed in the browser (max 2560 px) and voice notes recorded at 64 kbps (~0.5 MB/min) to stretch that a long way.
- Vercel Hobby is for personal, non-commercial use — which this is.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| “Supabase is not configured” on the login page | `.env.local` (or Vercel env vars) missing / still has placeholder values. Restart `npm run dev` after editing. |
| Correct password but “not been given access” | The account has no profile row. Run `supabase/admin/assign-roles.sql` with the right email. |
| Login works locally but not on Vercel | Env vars not set for *Production*, or Supabase *Site URL / Redirect URLs* don't include the Vercel URL. Redeploy after changing env vars. |
| Upload fails with “storage server rejected” | File type not allowed or larger than the bucket/app limit. Check `diary-files` bucket settings match migration 3. |
| Upload fails with “session expired” | Sign out and back in. |
| Microphone “permission denied” | iOS: *Settings → Safari → Microphone → Allow*. Chrome: lock icon in the address bar → Microphone → Allow. Recording needs HTTPS (Vercel provides it; `localhost` is fine). |
| Changing password asks to sign in again | Supabase “Secure password change” is on: sign out, sign in, then change it within a few minutes. |
| Search misses accents | Make sure migration 1 ran fully (needs the `unaccent` extension). |
| Images don't display (CSP error in console) | `NEXT_PUBLIC_SUPABASE_URL` at build time must be the same project the images come from. Redeploy after changing it. |
| Project “paused” | Supabase dashboard → *Restore project*. |
