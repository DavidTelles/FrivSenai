# FrivSenai

Community game portal: play browser games without an account, publish your own through a ZIP file or an external URL.

Stack: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Auth, Postgres, Storage).

## Setup

1. Create a project at <https://supabase.com/dashboard>.
2. Copy `.env.example` to `.env.local` and fill it in:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings > API > Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings > API Keys > anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings > API Keys > service_role / secret key. Server only. |

3. Open SQL Editor, paste `supabase/migrations/20261105000000_initial_schema.sql` and run it. It creates tables, RLS policies, categories and storage buckets.
4. Under Authentication > URL Configuration, set the Site URL and add `http://localhost:3000/auth/callback` (plus your production equivalent) to Redirect URLs.
5. Check Storage > Settings: the global upload limit must be at least 100 MB to accept the largest ZIPs. The Free plan caps it at 50 MB.
6. Run:

   ```sh
   npm install
   npm run dev
   ```

## Scripts

- `npm run dev`, `npm run build`, `npm start`
- `npm test`: ZIP validation, URL/SSRF rules, and RLS tests on an in-process Postgres (PGlite)
- `npm run lint`

## Architecture

```
src/app          routes, pages and API handlers
src/components   UI by domain (games, community, publish, auth, profile, layout)
src/services     data access and the publishing workflow
src/lib/games    ZIP, file, URL and sandbox rules
src/lib/supabase browser, server and service-role clients
src/proxy.ts     session refresh and protected routes
supabase/        SQL migration
tests/           Vitest suites
```

## Security model

- **Publishing is server-only.** Clients have no insert rights on `games` or `game_files`, and no write rights on the `game-files` and `game-covers` buckets. They upload to a private staging folder; `POST /api/games` validates the content, then writes with the service role.
- **ZIP validation.** Limits: 100 MB archive, 250 MB extracted, 50 MB per file, 1000 files, 10 levels. Paths are checked for traversal, absolute forms and hidden files. Extensions come from an allow-list, and content is verified by signature. Executables and nested archives are rejected. Nothing is executed on the server.
- **Game isolation.** Games are served by `/play/{id}/...` with a `Content-Security-Policy: sandbox` header and a sandboxed iframe without `allow-same-origin`. They get an opaque origin, so they cannot read cookies, the parent page or the Supabase session. Network access is limited to the game's host.
- **URL import.** Only `https` on the default port. Private, loopback and link-local addresses are refused at parse time and again at connection time, for every redirect hop. `X-Frame-Options` and `frame-ancestors` are inspected and respected: blocked sites get a link instead of a player.

## Known limitations

- Hosted games have no persistent storage. `localStorage` is replaced by an in-memory version, so saves last until the page reloads.
- Hosted games cannot call external servers (multiplayer, remote assets, CDN scripts). Bundle assets in the ZIP.
- Pre-compressed builds (`.br`, `.gz`) are rejected. Export HTML5 builds without compression.
- A sandboxed game shares the app's host. For stronger separation in production, serve `/play` from a dedicated domain.
- View counts are de-duplicated per browser and day, not protected against deliberate inflation.
- Reports are stored for moderation; there is no admin dashboard. Use the Supabase dashboard to review them, set `status = 'hidden'` or `is_featured = true`.
