import Link from "next/link";
import {
  Banknote,
  Check,
  Database,
  Eye,
  EyeOff,
  FileDown,
  KeyRound,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { CONTACT_EMAIL, DELETION_DAYS, LEGAL_UPDATED, PRODUCT_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

export const metadata = {
  title: "Private by design",
  description: "How your project records, client details and money information are protected.",
};

const promises = [
  {
    icon: ShieldCheck,
    title: "Your records are yours",
    body: "We don't sell them, we don't show ads, and we use them for one thing: running your portal.",
  },
  {
    icon: EyeOff,
    title: "You choose what clients see",
    body: "Expenses start hidden. Only the ones you share appear for your client, receipts included.",
  },
  {
    icon: FileDown,
    title: "Take it with you",
    body: "Download your projects, updates, expenses and payments as spreadsheets whenever you like.",
  },
  {
    icon: Lock,
    title: "Separate by design",
    body: "Every company is walled off from every other, enforced by the database, not just the screens.",
  },
];

type Cell = "yes" | "no" | "choice";
const matrix: { what: string; you: Cell; client: Cell; others: Cell }[] = [
  { what: "Progress and milestones", you: "yes", client: "yes", others: "no" },
  { what: "Site updates and photos", you: "yes", client: "yes", others: "no" },
  { what: "Payments (each one confirmed by both sides)", you: "yes", client: "yes", others: "no" },
  { what: "Expenses you share, with receipts", you: "yes", client: "yes", others: "no" },
  { what: "Expenses you keep hidden, with receipts", you: "yes", client: "no", others: "no" },
  { what: "Project budget", you: "yes", client: "choice", others: "no" },
];

function Mark({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-success">
        <Check className="size-4" aria-hidden /> Yes
      </span>
    );
  }
  if (value === "choice") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-primary-hover">
        <Eye className="size-4" aria-hidden /> If you choose
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <X className="size-4" aria-hidden /> No
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TrustPage() {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-data-accent">Private by design</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Your data is yours.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          A project record holds your clients&apos; names, your costs and your site photos. That&apos;s sensitive,
          so here is exactly how {PRODUCT_NAME} handles it, in plain words.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {promises.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-data-accent">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>

        <Section title="Who can see what">
          <p>Each person sees only what their role allows. Here it is for a typical project.</p>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th scope="col" className="px-4 py-3 font-semibold">You</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Your client</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Anyone else</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {matrix.map((row) => (
                  <tr key={row.what}>
                    <th scope="row" className="px-4 py-3 font-medium text-foreground">{row.what}</th>
                    <td className="px-4 py-3"><Mark value={row.you} /></td>
                    <td className="px-4 py-3"><Mark value={row.client} /></td>
                    <td className="px-4 py-3"><Mark value={row.others} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Your client only ever sees their own project. They can&apos;t see your other clients or your company&apos;s
            other records.
          </p>
        </Section>

        <Section title="Hidden expenses stay hidden">
          <p>
            New expenses start hidden. When you hide an expense, it is left out of your client&apos;s expense list,
            their totals, their timeline and the receipt file itself. The totals your client sees are calculated
            from the shared expenses only, so a hidden cost can&apos;t be worked out from a sum.
          </p>
          <p>
            This is enforced where the data is stored, not just on the screen, so a request made directly to the
            database is refused too. On every project you can see a summary of what is shared and what is hidden.
            The PDF statement and the WhatsApp messages you send from the app follow the same rule: they contain
            only what your client can already see.
          </p>
        </Section>

        <Section title="Photos and receipts">
          <p>
            They are kept in private storage. There are no public links: each picture is shown through a link that
            expires after about an hour, and only to people allowed to see that project. Photos are resized on the
            phone before upload, and the location information phones put inside photos is removed.
          </p>
          <p className="mt-3">
            The one exception is the weekly summary email a homeowner receives: it shows a few of the week&apos;s
            photos, so those links last seven days. Homeowners can switch the summary off in Settings, and
            contractors can pause it for a project.
          </p>
        </Section>

        <Section title="Payments are records, not money">
          <p className="flex items-start gap-2">
            <Banknote className="mt-1 size-4 shrink-0 text-data-accent" aria-hidden />
            <span>
              {PRODUCT_NAME} never holds or moves money. A payment is a record: whoever records it, the other side
              confirms or disputes it. Confirmed payments are locked, and each confirmation keeps who confirmed and
              when.
            </span>
          </p>
        </Section>

        <Section title="Taking your data with you">
          <p>
            In Settings, under <strong className="text-foreground">Your data</strong>, you can download your
            projects, milestones, site updates, expenses (including hidden ones) and payments as spreadsheets that
            open in Excel or Google Sheets. Photos and receipts stay in the app; if you want a full copy of those,
            ask us.
          </p>
        </Section>

        <Section title="Leaving">
          <p>
            If you want to stop, tell us and we will delete your company&apos;s projects, photos, receipts and
            records within {DELETION_DAYS} days. Download your spreadsheets first if you want to keep a copy.
          </p>
        </Section>

        <Section title="Who can reach the data">
          <p className="flex items-start gap-2">
            <Database className="mt-1 size-4 shrink-0 text-data-accent" aria-hidden />
            <span>
              Your data is stored with trusted infrastructure providers for the database, sign-in and file storage.
              The few people who run {PRODUCT_NAME} can technically reach the system to keep it working, and only
              do so to fix problems or to help when you ask.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <KeyRound className="mt-1 size-4 shrink-0 text-data-accent" aria-hidden />
            <span>
              We never see your password. We use only the cookies needed to keep you signed in and to remember your
              theme choice, and no advertising trackers.
            </span>
          </p>
          <p>
            No system is perfectly secure. If we ever find out that your data was exposed, we will tell you
            promptly.
          </p>
        </Section>

        <div className="mt-14 rounded-3xl bg-hero border border-line p-6 text-center sm:p-8">
          <h2 className="text-xl font-bold tracking-tight">Questions about your data?</h2>
          <p className="mt-2 text-muted">
            {CONTACT_EMAIL ? (
              <>
                Write to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-4">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            ) : (
              "Ask the person who set up your account, and they will pass it on."
            )}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={button("primary")}>
              Create contractor account
            </Link>
            <Link href="/" className={button("secondary")}>
              Back to home
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted">Last updated {LEGAL_UPDATED}</p>
      </main>

      <PublicFooter />
    </div>
  );
}
