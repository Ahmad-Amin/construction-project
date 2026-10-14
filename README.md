# BuildPeek

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
| Documents | add, edit, delete, choose what the client sees; open what the client shares with you | add (not shared until the owner shares it), edit or delete own; open what the client shares | open what the contractor shares; add their own, choose whether the contractor sees each, edit or delete own |
| Expenses and receipts | add, edit, delete, choose what the client sees | add (always hidden from the client), edit own | read shared ones only |
| Payments | record, respond | read | record, respond |
| Timeline | read | read | read |

**Plans:** every company has a plan: Free (1 active project), Pro (10) or Business (unlimited). All three numbers, the prices and the feature list live in `src/lib/plans.ts`; the database has the same limits in `…_plans.sql` and is what actually enforces them (a trigger on `projects` refuses a project becoming Active past the limit, with a lock so two at once are counted correctly; Completed, On hold and Archived projects don't count). Free has no automatic WhatsApp updates (`notify()` and the weekly job check `plan_allows_whatsapp()`) and no PDF statements (the statement route refuses). `companies.plan` and `companies.plan_until` have no update grant for signed-in users: change them in the Supabase table editor (or with the service key, later from the payment provider's webhook). A paid plan whose `plan_until` has passed counts as Free (`effective_plan()`); a paid plan with no end date never runs out. Nothing is ever deleted when a plan ends or is lower than the projects a company already has: it just can't start another. The plan shows in the sidebar (`components/plan-badge.tsx`), in Settings → Plan (`plan-section.tsx`), and publicly at `/pricing`. **Asking for a plan:** the owner taps *Request Pro/Business* in Settings → Plan; `request_plan_upgrade()` records it (one an hour per company, owner only) and the server emails the request to the addresses in `PLATFORM_ADMIN_EMAILS` (or the contact address if that is empty), with the owner as reply-to, and sends the owner a confirmation (`settings/plan-actions.ts`). If the email can't be sent the request is taken back. **The plans admin page** (`/dashboard/admin`, link in the sidebar) is only for the emails in `PLATFORM_ADMIN_EMAILS` (confirmed accounts; everyone else gets a 404): it lists companies with plan, end date and project counts, shows open requests, and sets a plan with `admin_set_plan()` (service role only; every change is written to `plan_changes`, and the **History** tab at `/dashboard/admin/history` lists them with `admin_plan_history()`). Both the page and each server action check the allow-list on the server. **Feedback:** everyone signed in has *Send feedback* at the bottom of the sidebar (`components/feedback-button.tsx`): a problem, an idea or a question, up to 2,000 characters. `submit_feedback()` saves it (who sent it is worked out from the account, never trusted from the request; five an hour per person) into `public.feedback`, which only the service role can read, and `feedback-actions.ts` also emails it to the addresses in `PLATFORM_ADMIN_EMAILS` (or the contact address if that is empty) with the sender as reply-to; if the email fails the message is still saved. The page and the device are sent along to help reproduce problems. The people on `PLATFORM_ADMIN_EMAILS` also get a bell notification (`notify_platform_admins()`, kinds `feedback_received` and `plan_requested`; bell only, no second email), created only after the feedback is saved and emailed and never able to stop it. You read and answer it on the **Feedback** tab of the plans admin (`/dashboard/admin/feedback`, with a count of new ones), where it can be marked done. The demo company is made Business by `npm run seed:demo`; your own existing companies start on Free, so give them a plan by hand.

**Currency:** each company works in one currency, picked on the "Set up your company" screen (guessed from the visitor's country) and changeable by the owner in Settings → Company. It is stored on `companies.currency` and is only a label: amounts are whole units and are never converted, so changing it relabels existing amounts. Every amount is shown as `<code> <number>` through `formatMoney` / `formatMoneyCompact` in `src/lib/format.ts`; pages read it from `project.currency` (homeowners can already read their contractor's company row). Notification text written by the database uses `format_money(amount, project_id)`, and the weekly summary carries `currency`. 

**Time zone:** each company also has an IANA time zone (`companies.timezone`, default `Asia/Karachi`), chosen on the setup screen (guessed from Vercel's `x-vercel-ip-timezone` header) and changeable in Settings → Company. It decides what "today" is (`todayIn`), which day an event belongs to (`dayInZone`), the clock time shown (`formatTime`, `formatTimestamp`) and relative dates, all in `src/lib/format.ts`. Pages read it from `project.timeZone` and the viewer's own company from `viewer.company.timeZone`; the database timeline uses `project_time_zone()`. The weekly summary still runs once a week (Sunday 13:00 UTC) for everyone.

**Documents:** the Documents tab holds a project's contract, drawings, permits, quotations and invoices (PDF, Word, Excel or image, up to 20 MB). Files live in their own private bucket, `project-documents`, at `<project>/<document>/<file>`. Like expenses they start hidden for staff; the owner chooses what the homeowner sees (the form defaults to shared for the owner), and a shared document sends the homeowner a notification (bell and email, kind `document_shared`). Visibility is enforced by row-level security on `project_documents` and by `can_read_document_file` on the files themselves. Open and Download go through `documents/[documentId]/file`, which checks who is asking and redirects to a signed link that expires in a minute. A document's file can't be changed, only its name, type and sharing.

**Documents from the homeowner:** the homeowner can add documents too (same types and 20 MB limit). Each is private to them until they tick **Share this document with the contractor**; the owner and staff can then open or download it (never edit or delete it), it appears under **From your client**, and the owner gets a bell notification and email (kind `document_received`, migrations `38` and `39`). Enforced in the database: `project_documents.from_client` is set by a trigger from who is adding it, `team_visible` is the homeowner's sharing flag, the homeowner never sees the contractor's unshared documents, a homeowner may add at most 25 documents per project, and the storage rules mirror all of it (`can_read_document_file`, an upload cap of 40 files per homeowner per project, and the owner can't delete a homeowner's file).

**Google Analytics:** optional, off until `NEXT_PUBLIC_GA_ID` (the `G-…` measurement ID) is set. It runs only on the public pages listed in `src/lib/analytics.ts` (home, pricing, sign-in and sign-up, legal pages), never in the dashboard or on invite links, and only after the visitor chooses **Accept** in the cookie banner (`src/components/analytics-consent.tsx`; Decline is just as prominent). The choice is kept in the browser; **Cookie settings** in the public footer takes it back and removes Google's cookies. Google's advertising features are switched off. The privacy and trust pages mention it only when the ID is set. Vercel Web Analytics still runs separately, without cookies.

**Guided tour:** the first time someone opens the dashboard, and the first time they open a project's overview, on desktop and larger screens (not phones), a short tour dims the page and points at the main parts, step by step (`src/components/tour.tsx`, steps in `src/lib/tours.ts`). Steps point at elements by their `data-tour` name and are skipped when that element isn't on screen, so one list serves contractors, site staff and homeowners. It starts by itself once per person per tour: `profiles.tours_seen` records which tours were shown (migration `40`, written only through `mark_tour_seen`), so it holds on any device or browser. It can be replayed with the compass **Take a tour** button in the top bar, beside the theme switch. Each section of a project (Updates, Expenses, Payments, Documents, Timeline, Progress) has its own short tour too, played with the compass button while on that page; these never start by themselves, so nobody is shown six pop-ups (`isAutoTour` in `src/lib/tours.ts` decides which ones do, and a new auto tour also needs its name added to `mark_tour_seen`). To add a step, put `data-tour="name"` on the element and add an entry to the list.

Payments can carry an **optional receipt photo** (bank transfer, cheque or receipt), attached by whoever records the payment and visible to both sides. It is uploaded from the form (`components/payment-receipt-field.tsx`), stored privately at `<project>/payments/<payment>/…`, and locked with the payment once confirmed; adding, replacing or removing it sends the payment back for confirmation. Payments are two-sided: whoever records one, the other side confirms or disputes it. Only confirmed payments count toward the total, and confirmed payments are locked. The timeline shows only expenses that are shared with the client.

The **payment schedule** (top of the Payments page) is the owner's plan of instalments, each tied to a stage ("PKR 500,000 when the foundation is complete") or to the start of the work. It is a plan and a reminder only: it never creates a payment. A payment can optionally say which instalment it settles (`payments.schedule_item_id`), and an instalment shows as Paid once confirmed payments cover it; pending ones show "Awaiting confirmation", disputed ones don't count. When a stage reaches 100% its instalments fall due: the homeowner's stage notification mentions it, the dashboard "Needs attention" list shows it, and the owner can press **Request payment** (bell and email, at most once every 6 hours per instalment, via `send_schedule_reminder`). Only the owner edits the schedule; the homeowner and site staff can read it. WhatsApp is not used for payment-due requests yet (it needs its own approved template), so the button offers the message ready to send from the owner's own WhatsApp.

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

## WhatsApp messages

Homeowners who switch on **Settings → Notifications → Send me updates on WhatsApp** (off by default, and only once the contractor has saved their phone number) get a WhatsApp message for: a payment waiting for their confirmation, a new site update, a finished stage, a completed project, and "your weekly update is ready". Contractors have no phone number on file, so they keep the bell and email. The tap-to-send share buttons are still there as a fallback.

- **How it works:** like email. The database queues a message when it creates the notification (`…_whatsapp_notifications.sql`), the server sends it with the WhatsApp Cloud API right after the action (`lib/whatsapp-api.ts`, `queueNotificationDelivery()` in `lib/notifications.ts`), and reports back. Failed sends are retried up to 3 times; messages older than 30 minutes are never sent. The weekly job sends its own through the same code.
- **Reminder button:** on a payment the contractor recorded that is still waiting, **Remind the homeowner** (shown when `WHATSAPP_MODE` is `log` or `live`) sends the reminder from the app: the bell and email, plus WhatsApp if the homeowner switched it on (`send_payment_reminder`, `…_payment_reminder.sql`). It can be used once per payment every 6 hours. When WhatsApp can't be used for that homeowner (switch off or no phone saved) the button says why and offers the old tap-to-send link. With `WHATSAPP_MODE=off` it is the old link only.
- **Templates:** WhatsApp only lets a business start a chat with an approved template. The five we use are in `src/lib/whatsapp-templates.json`. `npm run whatsapp:templates` creates them in your WhatsApp Business Account and `npm run whatsapp:templates -- --status` shows whether Meta approved them. An approved template can't be edited; to change the wording, change the template's name too.
- **One-way, with an automatic notice:** the number only sends updates and nobody reads replies. When someone writes to it, Meta calls `POST /api/whatsapp/webhook` (`src/app/api/whatsapp/webhook/route.ts`), which checks Meta's `X-Hub-Signature-256` signature with `WHATSAPP_APP_SECRET`, and answers once per person per 24 hours with a short message ("this number can't receive messages, contact your contractor; to stop updates, turn off WhatsApp in settings"). `claim_whatsapp_autoreply()` (`…_whatsapp_auto_reply.sql`) keeps the one-a-day rule and only holds phone numbers, deleted after 30 days; the message text is never stored. `GET` on the same address answers Meta's one-time check using `WHATSAPP_VERIFY_TOKEN`. In Meta: app → WhatsApp → Configuration → callback URL `https://<site>/api/whatsapp/webhook`, the verify token, subscribe to **messages**; then `npm run whatsapp:templates -- --env <file> --subscribe` once per WhatsApp account. Messages sent to any other number on the same app (the test number) are ignored.
- **Modes:** `WHATSAPP_MODE=off` (default; the switch is hidden), `log` (prints messages in the server console), `live` (sends). See `.env.example` for the values to set.
- **Meta's free test number** only delivers to up to 5 phone numbers you verify in the Meta dashboard, so use your own number as a client's phone when testing. Going to production needs business verification, your own number and display name, and a permanent token; after that, only the three values in `.env.local` change.

## Weekly summary

**Off by default:** nothing is sent until the contractor turns it on in **Settings → Client updates** (a company-wide switch, migration `…_weekly_summary_opt_in.sql`). Once on, every Sunday evening each homeowner gets one email per active project (and a bell notification) with the week's progress, finished stages, site updates and photos, and payments, sent in the contractor's company name. Weeks with nothing new and nothing waiting on the homeowner are skipped.

- **Privacy:** the content is built by `build_weekly_summary` in the database (`…_weekly_summary.sql`) and contains only what the homeowner can already see: no expenses, and the budget only if the contractor shared it. The email's photo links last seven days (everywhere else they last an hour); the Private by design page says so.
- **Controls:** it is the contractor's choice: the company switch in Settings, plus a pause per project on the Overview's **Weekly summary** card. Homeowners have no separate switch for it; turning off **Email me about activity** in their Settings stops the email (they still get the bell notification), and the email footer says they can ask their contractor to stop it. The Overview card also has **Email me a preview** (sent to your own address, with this week's real data).
- **Scheduling:** `vercel.json` registers the job with Vercel Cron: `GET /api/cron/weekly-summary` every Sunday at 13:00 UTC (18:00 in Pakistan). In the Vercel project set `CRON_SECRET` and `SUPABASE_SECRET_KEY` (Production only, mark them Sensitive, never prefix with `NEXT_PUBLIC_`), plus the usual Supabase and email variables, and optionally `SITE_URL`. Vercel sends `Authorization: Bearer $CRON_SECRET` itself; the route refuses anything else. On the free plan Vercel may start the job any time within that hour. The database remembers who was already sent this week, so calling it twice is harmless. To run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/weekly-summary` (or `localhost:3000` locally). Vercel's project page, Settings → Cron Jobs, has a **Run** button and the logs.
- **Keep-alive:** a second job, `GET /api/cron/keep-alive`, runs every day at 06:00 UTC and does one tiny read of the database (`src/app/api/cron/keep-alive/route.ts`), so a free-plan Supabase project never pauses from inactivity. Same `CRON_SECRET` protection (`src/lib/cron-auth.ts`). It is not needed on a paid Supabase plan and can be removed from `vercel.json` then.
- **Failures:** an email that fails is marked failed on its notification and not retried; the next summary goes out the following week.

## Phone numbers and amounts

- **Phones** are picked with a country selector (`components/phone-input.tsx`, Pakistan by default) and saved in the international format, like `+923001234567` (`lib/phone.ts`, built on `libphonenumber-js`). That is what WhatsApp needs and it works for any country. Older entries such as `0300 1234567` are still understood as Pakistani numbers, and are converted the next time the project is saved. The country flags are loaded from the Twemoji set on cdnjs.cloudflare.com; self-host them if you want no third-party requests.
- **Dates** use a proper calendar (`components/date-field.tsx`, built on DayPicker) instead of the browser's own date input. It submits `YYYY-MM-DD` like before, so nothing server-side changed. Pass `max` to stop future dates, and `today` so "Today" follows the company's time zone.
- **Money fields** (`components/amount-input.tsx`) show commas as you type and submit plain digits.

## Security and link previews

- **Who can see what** is enforced by the database (row-level security on every table, private storage, and server-side checks inside every function), not by the pages. `supabase/` has the rules; nothing in the app trusts the browser.
- **Headers** (`next.config.ts`): no framing of the site, no content-type guessing, a strict referrer policy, HTTPS-only (HSTS), and a content policy that stops other sites framing it or redirecting its forms.
- **`SITE_URL` must be set in production** (for example `https://app.yourdomain.com`). Links in emails, invites and WhatsApp messages, the sitemap and the link-preview tags are all built from it, so a forged request can't put another site's address into a message someone receives.
- **Link previews:** the picture shown when the site is shared is drawn in code (`src/app/opengraph-image.tsx`); the title and description come from each page's metadata. Invite pages are kept out of search engines and say nothing about the person or project.
- **Search engines:** `robots.txt` and the sitemap are generated (`src/app/robots.ts`, `sitemap.ts`). The dashboard, invite links, sign-in and API routes are not indexed.

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
