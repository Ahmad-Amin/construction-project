# Client Portal

A lightweight contractor ↔ homeowner project portal. A contractor opens one project and shows the homeowner what has been completed, what has been spent, what has been paid, the receipts, and what happened recently, without searching WhatsApp or Excel.

Built as a responsive web app / PWA. See the MVP requirements for scope; this is deliberately **not** a construction ERP.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + Tailwind CSS, installable as a PWA |
| Database, auth, files | Supabase (Postgres, Auth, Storage), hosted cloud project |
| Access control | Postgres Row-Level Security: the database, not the page, decides who sees what |
| Photos and receipts | Private storage bucket, served through expiring signed links; compressed in the browser before upload |

> This version of Next.js has breaking changes from older releases (for example `middleware` is now `proxy`, and error boundaries receive `retry`). Check `node_modules/next/dist/docs/` before changing framework-level code.

## Setup

1. `npm install`
2. Create a Supabase project. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key.
3. Apply the migrations in `supabase/migrations/` in order, either:
   - `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npx supabase db push`, or
   - paste each file into the Supabase SQL Editor, oldest first.
4. In Supabase → Authentication → URL Configuration, set the Site URL (for example `http://localhost:3000`) and add `<site>/auth/callback` as a redirect URL.
5. `npm run dev`

No Docker is needed. Everything runs against the hosted project.

## Who can do what

| | Owner | Site staff | Homeowner |
|---|---|---|---|
| Projects, clients, milestones | create, edit | read; set milestone progress | read |
| Site updates and photos | post, delete | post, delete own | read |
| Expenses and receipts | add, edit, delete, choose what the client sees | add (always hidden from the client), edit own | read shared ones only |
| Payments | record, respond | read | record, respond |
| Timeline | read | read | read |

Payments are two-sided: whoever records one, the other side confirms or disputes it. Only confirmed payments count toward the total, and confirmed payments are locked. The timeline shows only expenses that are shared with the client.

Staff accounts are not invitable yet; the role exists in the database for when that is added.

## Privacy and your data

- `/trust` ("Private by design") explains, in plain words, who sees what, how hidden expenses work, and how people take their data or leave. Every claim on it matches how the product behaves, so **update it when behaviour changes** (and bump `LEGAL_UPDATED` in `src/lib/site.ts`).
- Owners can download their records as CSV from **Settings → Your data**: projects, milestones, site updates, expenses (including hidden ones) and payments. The route is `src/app/dashboard/export/[kind]/route.ts`; it is owner-only and cell values that look like spreadsheet formulas are neutralised.
- The owner's project Overview has a **What your client sees** card that summarises what is shared and what is hidden, from the live data.
- Set `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_OPERATOR_NAME` before sharing the product (see `.env.example`). The page promises deletion within `DELETION_DAYS` (30) of a request; keep that promise or change the number.

## Project lifecycle

- **Templates and first run:** a new project starts from a milestone template (`src/lib/templates.ts`: new house, extra floor, renovation, shop or office fit-out, or blank). Owners also see a **Get started** checklist on the dashboard (`src/lib/getting-started.ts`), built from what they have actually done and hidden for good once dismissed. It does not show for the shared demo account.
- **Complete:** the Overview's **Mark complete** lists loose ends (unfinished stages, payments awaiting or disputed), then marks the project complete, records the date, notifies the client and offers the final statement. **Reopen** undoes it.
- **Archive:** hides a project from the owner's lists and dashboard totals, reversible, and the client keeps their view.
- **Delete:** permanent and for mistakes and test projects. It needs the project's name typed in, removes everything including the photo and receipt files, and **is refused once the project has confirmed payments** (the client has agreed to those records; archive it instead). Enforced by `delete_project` in the database.
- **Expenses:** the tab shows a "Where the money went" chart by category, with date presets, a custom range, and (owner only) an All / Shared / Hidden switch. A homeowner's chart is computed only from expenses shared with them. An expense is marked **Edited** only when its amount, date, category, note or receipt changes, not when it is shared.

## Notifications

People are told when something needs them: a payment waiting for their confirmation, a payment confirmed or disputed, a new site update, a finished milestone, or a client joining. Each notification shows in the **bell** (top bar), on `/dashboard/notifications`, and, unless they switch it off in **Settings → Notifications**, arrives by email.

- **Created by the database** (`supabase/migrations/…_notifications.sql` triggers), so every path that changes a payment, update or milestone notifies the right person, and a failure to notify can never break the real action. Nobody is notified about their own actions.
- **Emails** are sent by the server after the action finishes (`queueEmailDelivery()` in `src/lib/notifications.ts`). The person who caused a notification claims it from the database (`claim_email_notifications`), sends it, and reports back (`finish_email_notification`). This needs no elevated key. A failed send is retried up to 3 times, the next time that person acts.
- **Provider** is chosen in `.env.local` (`src/lib/email.ts`):
  - `EMAIL_PROVIDER=ethereal` (default in development): a fake inbox, so nothing reaches a real address. Create a free account at https://ethereal.email/create, put its login in `ETHEREAL_USER` / `ETHEREAL_PASS`, and read every email at https://ethereal.email/login. Without them a new inbox is created on each server start and its login is printed in the server console. The console also prints a preview link for every email.
  - `EMAIL_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for example Gmail with an app password).
  - `EMAIL_PROVIDER=resend` with `RESEND_API_KEY` (production). This path is written but has not been tried against a real Resend account yet.
- To add a channel later (WhatsApp, push), read the same pending notifications and send them there.

## Weekly summary

**Off by default:** nothing is sent until the contractor turns it on in **Settings → Client updates** (a company-wide switch, migration `…_weekly_summary_opt_in.sql`). Once on, every Sunday evening each homeowner gets one email per active project (and a bell notification) with the week's progress, finished stages, site updates and photos, and payments, sent in the contractor's company name. Weeks with nothing new and nothing waiting on the homeowner are skipped.

- **Privacy:** the content is built by `build_weekly_summary` in the database (`…_weekly_summary.sql`) and contains only what the homeowner can already see: no expenses, and the budget only if the contractor shared it. The email's photo links last seven days (everywhere else they last an hour); the Private by design page says so.
- **Controls:** homeowners switch it off in **Settings → Notifications**. Contractors can also pause it for one project on the Overview's **Weekly summary** card, which also has **Email me a preview** (sent to your own address, with this week's real data).
- **Scheduling:** `vercel.json` registers the job with Vercel Cron: `GET /api/cron/weekly-summary` every Sunday at 13:00 UTC (18:00 in Pakistan). In the Vercel project set `CRON_SECRET` and `SUPABASE_SECRET_KEY` (Production only, mark them Sensitive, never prefix with `NEXT_PUBLIC_`), plus the usual Supabase and email variables, and optionally `SITE_URL`. Vercel sends `Authorization: Bearer $CRON_SECRET` itself; the route refuses anything else. On the free plan Vercel may start the job any time within that hour. The database remembers who was already sent this week, so calling it twice is harmless. To run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/weekly-summary` (or `localhost:3000` locally). Vercel's project page, Settings → Cron Jobs, has a **Run** button and the logs.
- **Failures:** an email that fails is marked failed on its notification and not retried; the next summary goes out the following week.

## Sharing with clients

- **WhatsApp:** one-tap, pre-written messages that open the client's chat (click-to-chat links; nothing is sent automatically). Available on each site update, on the project Overview ("Share progress"), right after posting an update, and as a reminder on payments that are waiting for the other side to confirm. Messages are built in `src/lib/whatsapp.ts` and contain only progress, update text and payments, never expenses.
- **Statement PDF:** `GET /dashboard/projects/<id>/statement` renders a document with the logo, progress, money summary, payments (with who confirmed and when), shared expenses and recent updates and photos. It is always built from the client's point of view (hidden expenses excluded, budget only if shared), so the owner can send it as is. The owner and the project's client can download it; on phones, **Share PDF** hands the file to WhatsApp or any other app. Built with `@react-pdf/renderer` in `src/lib/statement-pdf.tsx`. Names written only in Urdu script will not render in the PDF until an Urdu font is added.

## Demo mode

A polished sample project (Ahmed Residence, DHA Lahore) for sales conversations.

1. Add to `.env.local` (see `.env.example`):
   - `DEMO_CONTRACTOR_EMAIL`, `DEMO_CLIENT_EMAIL`, `DEMO_PASSWORD`
   - `SUPABASE_SECRET_KEY`, only needed to run the seed script. It bypasses row-level security, so keep it server-side and never commit it.
2. `npm run seed:demo`
3. Restart `npm run dev`. The landing and login pages now show **View as contractor / View as homeowner**.

The seed script signs in as the demo users and builds the project through the normal rules, then checks that the homeowner cannot see hidden expenses. **Run it again to reset the demo** before a pitch. It only touches the demo contractor's company.

Demo accounts cannot change their password, since everyone shares them.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run build` | Production build |
| `npm run lint` | Lint |
| `npm run seed:demo` | Build or reset the demo project |
| `npm run icons` | Regenerate the PWA icons |

## Project layout

- `src/app/dashboard/**`: everything behind login. `/`, `/login`, `/signup`, `/forgot-password` and `/invite/<token>` are public.
- `src/lib/`: data access and formatting helpers.
- `supabase/migrations/`: the schema, row-level security and business rules, one stage per file.
- `scripts/`: demo seed and icon generation.
