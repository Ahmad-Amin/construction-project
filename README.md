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
