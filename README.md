# oggi-zatvarac

Next.js app (App Router) with a Postgres-backed contact form, deployable to Vercel and installable as a PWA (so it can be wrapped as an Android app with no URL bar via a Trusted Web Activity).

## Stack

- **Next.js 16** (App Router, Server Actions) + Tailwind CSS
- **Postgres** via **Prisma 7** (driver adapter: `@prisma/adapter-pg`)
- **Zod** for form validation
- **PWA**: `app/manifest.ts`, a minimal offline service worker (`public/sw.js`), and installability metadata in `app/layout.tsx`

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and point `DATABASE_URL` at a Postgres instance. For local dev, the quickest option is Docker:
   ```bash
   docker run -d --name oggi-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=oggi -p 55432:5432 postgres:16-alpine
   ```
   then set:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:55432/oggi?schema=public"
   ```
3. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```

## Adding/editing forms

- `prisma/schema.prisma` — data models. After changing it, run `npx prisma migrate dev --name <change>`.
- `src/app/actions.ts` — Server Actions that validate (`zod`) and persist form data.
- `src/app/contact-form.tsx` — the form UI, using `useActionState`/`useFormStatus` for pending/error states.

The included example is a single `ContactMessage` form (name, email, message). Duplicate this pattern (model + action + form component) for additional forms.

## Deploying to Vercel

1. Push this repo to GitHub (or another Git provider Vercel supports).
2. In the Vercel dashboard, import the repo as a new project.
3. Add a Postgres database: **Storage → Create Database → Postgres** (Neon-backed). Vercel automatically sets `DATABASE_URL` (and related env vars) for the project.
4. Deploy. On first deploy, run the migration against the production database once, e.g. from your machine:
   ```bash
   DATABASE_URL="<the production connection string>" npx prisma migrate deploy
   ```
5. Every subsequent push to the deployed branch redeploys automatically.

## Turning this into an Android app (no URL bar)

This app is PWA-installable (manifest + service worker + HTTPS via Vercel). To ship it as an Android app:

1. Confirm the deployed site passes PWA installability (Chrome DevTools → Lighthouse → PWA, or `chrome://inspect`).
2. Use [PWABuilder](https://www.pwabuilder.com/) or the [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/) Android Studio template pointed at your Vercel URL. This produces an `.apk`/`.aab` that launches your site full-screen, with no browser UI.
3. Replace the placeholder icons in `public/` (`icon-192x192.png`, `icon-512x512.png`) with real branded icons before shipping — the current ones are auto-generated placeholders.
