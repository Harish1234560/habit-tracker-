# WinterArc Challenge — React + Supabase

A premium winter-inspired, mobile-first two-person habit challenge built with React + Vite + Supabase. It includes daily, weekly-target, and ongoing habits; shared read-only visibility of each participant's completion status; completion history; calendar; statistics; and cloud syncing.

## Important security setup for the two-person challenge

The login screen intentionally has **no public registration link**. It accepts either a participant username (`Harish` or `SHYAM`) or the user's email address in Supabase Auth. Usernames are mapped to the internal aliases `harish@winterarc.invalid` and `shyam@winterarc.invalid`; email addresses are passed directly to Supabase Auth. Create the two accounts yourself in Supabase Authentication (Dashboard → Authentication → Users → Add user) and set each password there. Passwords are managed by Supabase Auth and must never be inserted into the application database or frontend. Do not enable public sign-ups.

The schema adds a `challenge_members` allowlist. Harish and Shyam each have an independent habit list; the app creates starter habits separately when each account has no habits yet. The dashboard shows only the signed-in participant's habits and personal statistics. In My Habits, both participants can see each other's completion status, but only the habit owner can check off, edit, pause, or delete that habit. The two-user limit depends on keeping exactly two rows in `challenge_members` and disabling public sign-ups in Supabase.

## 1. Requirements

- Node.js 20 LTS or newer
- npm
- A Supabase project

## 2. Install

```bash
npm install
```

## 3. Configure Supabase

1. Open https://supabase.com/ and create/open your project.
2. In Authentication settings, disable public sign-ups.
3. In Authentication → Users, create exactly two users. To sign in with the usernames `Harish` and `SHYAM`, use email aliases `harish@winterarc.invalid` and `shyam@winterarc.invalid`. Alternatively, create users with real email addresses and sign in with those email addresses. Set each password in Supabase Auth and confirm/auto-confirm the users there.
4. Copy each user's UUID. Run the entire `supabase/schema.sql` file in **SQL Editor**.
5. In SQL Editor, insert the two UUIDs and participant details into `public.challenge_members`:

```sql
insert into public.challenge_members (user_id, display_name, username) values
  ('FIRST-AUTH-USER-UUID', 'Harish', 'Harish'),
  ('SECOND-AUTH-USER-UUID', 'SHYAM', 'SHYAM');
```

Keep exactly two rows in this table. Never store passwords in `challenge_members`.
If you already applied an earlier version of the schema, run the updated `supabase/schema.sql` again to apply the owner-only completion permissions.

### Troubleshooting: habit insert blocked by row-level security

The insert policy only allows signed-in users whose Supabase Auth UUID is present in `public.challenge_members`. Check that the login accounts are registered and that the app is configured for this same Supabase project:

```sql
select u.id, u.email, cm.display_name, cm.username,
       (cm.user_id is not null) as registered
from auth.users u
left join public.challenge_members cm on cm.user_id = u.id
where lower(u.email) in ('harish@winterarc.invalid', 'shyam@winterarc.invalid');
```

If you used real email addresses, replace the two example aliases in the query with those addresses. If the logged-in user has `registered = false`, insert that user's exact `id` into `public.challenge_members`. Do not disable row-level security; reapply `supabase/schema.sql` if the policies are missing.

6. Under **Project Settings → API Keys**, copy the Project URL and publishable key (or legacy anon public key).
7. Copy `.env.example` to `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Never use a `service_role` or secret key in frontend variables.

8. Configure allowed redirect URLs for localhost and your deployed site.

## 4. Run locally

```bash
npm run dev
```

Open the URL Vite prints, usually http://localhost:5173.

## 5. Production build

```bash
npm run build
npm run preview
```

The output directory is `dist/`.

## 6. Netlify deployment

The included `netlify.toml` sets:
- Build command: `npm run build`
- Publish directory: `dist`
- Node.js: 20

If your repository contains the project in a subfolder, set Netlify's **Base directory** to that subfolder. If `package.json` is at the repository root, leave Base directory blank. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify environment variables, then redeploy.

## Current feature scope

- Implemented: sign-in, two-member database allowlist, shared habits and completion visibility, either participant can check off tasks, habit owner-only editing/deletion, daily/weekly/ongoing habit types, responsive winter UI, calendar, charts/statistics, Netlify build configuration.
- Weekly target is saved and displayed as a days-per-week goal; this version still uses per-date check-ins rather than automatically scoring weekly target completion as a separate weekly metric. Ongoing means the habit has no end date. Exactly two users are enforced operationally by the `challenge_members` allowlist plus disabled public sign-ups; keep only the two intended members in that table.
- Without Supabase credentials, the app uses a non-persistent demo preview; demo changes do not sync across devices.
