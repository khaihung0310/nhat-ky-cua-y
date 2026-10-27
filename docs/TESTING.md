# Testing summary

Generated while building the first version (27 Oct 2026).

## What was run, and the results

| Check | Command | Result |
| --- | --- | --- |
| Unit tests (49) | `npm test` | ✅ 49 / 49 passed (Node 22 `node:test`) |
| Database / RLS / storage policies (70 assertions) | `npm run test:db` | ✅ all passed on PostgreSQL 16 with a Supabase auth/storage shim |
| TypeScript, pure logic + tests | `tsc --strict` on `lib/*` and `tests/*` | ✅ no errors |
| TypeScript, React/Next code | `tsc` with stand-in type stubs | ✅ no real errors (only stub-related noise) — **must be re-run with real types** |
| `npm install`, ESLint, `next build` | — | ⚠️ **Not run**: the npm registry was unreachable from the build environment. Run `npm install && npm run check` on your machine. |

So: the security core (RLS, storage policies, constraints, search) and the pure logic (timezone, calendar, validation, files, i18n, drafts, export) are **tested**. The React UI has **not** been compiled or clicked through yet.

## Requested scenarios

| # | Scenario | How it's covered | Status |
| --- | --- | --- | --- |
| 1 | Unauthenticated user accesses a diary | RLS test: `anon` denied on all tables, sees no storage objects. Proxy redirects to `/login`. | ✅ DB tested · ☐ manual (UI redirect) |
| 2 | Owner creates an entry | RLS test + validation unit tests | ✅ |
| 3 | Owner edits an entry | RLS test (edit allowed, owner re-assignment blocked) | ✅ |
| 4 | Owner deletes an entry | RLS test: files deleted, entry deleted, attachments + drafts cascade | ✅ DB · ☐ manual (UI) |
| 5 | Viewer reads an entry | RLS test: viewer reads entries + attachments | ✅ |
| 6 | Viewer attempts to modify | RLS tests: insert/update/delete/upload/draft/role-escalation all refused; UI capability unit test | ✅ |
| 7 | Owner uploads an image | Storage-policy test (own folder/entry only), file validation tests | ✅ DB · ☐ manual (browser upload) |
| 8 | Viewer accesses an authorised image | Storage-policy test: registered files readable, unregistered not | ✅ |
| 9 | Unauthenticated user accesses a private file | Storage-policy test (anon sees nothing); bucket is private | ✅ DB · ☐ manual (public URL fails) |
| 10 | Owner records and uploads audio | MIME detection per browser + audio file validation + storage test | ✅ logic · ☐ manual on iPhone/Android |
| 11 | Entry created around midnight in Vietnam | Unit tests (00:30 VN → next day, any process TZ) + SQL default `diary_date` test | ✅ |
| 12 | Multiple entries on the same date | RLS test + calendar grouping unit test | ✅ |
| 13 | Refresh while editing a draft | Draft logic tests (newest wins, no overwrite of published entry, corrupt data ignored) + RLS test (draft doesn't touch entry) | ✅ logic · ☐ manual |
| 14 | Network failure during upload | Upload failure classification test; UI keeps the file with *Retry* | ✅ logic · ☐ manual (DevTools “Offline”) |
| 15 | Switching Vietnamese ⇄ English | Dictionary parity, placeholder and default-language tests | ✅ · ☐ manual |

## Needs manual verification (after `npm install`)

1. `npm run check` passes (typecheck, lint, tests, build). Fix anything the real type definitions reveal.
2. The [production checklist](../README.md#production-checklist) in the README.
3. Accessibility pass: keyboard-only navigation through login → write → save; screen reader labels on the recorder and gallery; reduced-motion setting.
4. Visual pass on iPhone Safari, Android Chrome, a tablet and a desktop browser, light and dark theme.

## Re-running the database tests

```bash
npm run test:db
# macOS with Homebrew:
PG_BIN=$(brew --prefix postgresql@16)/bin npm run test:db
```

The runner creates a temporary cluster, applies `supabase/tests/supabase-shim.sql` (minimal `auth`/`storage` stand-ins), every migration, then `supabase/tests/rls.test.sql`. Any failed assertion stops the run with `FAIL: …`.
