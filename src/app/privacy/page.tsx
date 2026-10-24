import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { GA_ID, GA_REQUIRES_CONSENT } from "@/lib/analytics";
import { GOOGLE_AUTH_ENABLED } from "@/lib/auth-flow";
import { streamConfig } from "@/lib/stream";
import { CONTACT_EMAIL, DELETION_DAYS, OPERATOR_NAME, PRODUCT_NAME } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description: `What ${PRODUCT_NAME} collects, why, who it is shared with, and your choices.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Privacy policy"
      title="What we collect, and why."
      intro={`This page explains what personal information ${PRODUCT_NAME} holds${OPERATOR_NAME === PRODUCT_NAME ? "" : `, run by ${OPERATOR_NAME},`} what we do with it and what choices you have. For a plain-language tour of who can see what, read Private by design.`}
    >
      <LegalSection title="What we collect">
        <p>
          <strong className="text-foreground">From a contractor or staff member:</strong> your name, email address
          and password (we never see your password in readable form), your company name and logo, and your
          currency and time zone settings. If you choose to get your lead reminders on WhatsApp, the phone number you
          save for them; only you can see it.
          {GOOGLE_AUTH_ENABLED && " If you sign in with Google, Google tells us your name and email address; we never receive your Google password or anything else from your Google account."}
        </p>
        <p>
          <strong className="text-foreground">About a client:</strong> the name, email address and phone number the
          contractor enters when inviting them, and the account they create when they accept.
        </p>
        <p>
          <strong className="text-foreground">About a contractor&apos;s leads:</strong> the name, phone number, email
          and details of people who enquire about work, the notes the contractor keeps about them, and their
          follow-up dates. A contractor adds these, and they are seen only by the contractor and the staff the
          contractor allows. The contractor is responsible for having the right to keep them.
        </p>
        <p>
          <strong className="text-foreground">The project records you add:</strong> milestones, site updates and
          photos, expenses and receipts, payment records and receipts, invoices, and documents such as contracts and
          drawings. These can include prices and other business or personal information. A client can add
          documents of their own (for example an ID or an approval letter). They are private to the client unless
          the client chooses to share them with the contractor.
        </p>
        <p>
          <strong className="text-foreground">Messages we send you:</strong> a record of the notifications we
          created and whether they were delivered.
        </p>
        <p>
          <strong className="text-foreground">If you send us feedback:</strong> we keep what you wrote, your name and
          email, your role and company, the page you were on and the device you were using, so we can understand and
          answer you. Please don&apos;t put passwords in a message.
        </p>
        <p>
          <strong className="text-foreground">If you message our WhatsApp number:</strong> that number only sends
          updates and does not read messages. We reply once a day to say so, and to do that we keep your phone
          number for up to 30 days. We don&apos;t store or look at what you wrote.
        </p>
        <p>
          <strong className="text-foreground">Technical information:</strong> the usual details a web service sees,
          such as your IP address, browser and the time of a request, kept in logs for security and to fix problems.
        </p>
      </LegalSection>

      <LegalSection title="What we use it for">
        <LegalList>
          <li>To run the service: show a contractor&apos;s projects to the right people, and nobody else.</li>
          <li>To send you what you asked for: sign-in and confirmation emails, notifications and, if you switch them on, WhatsApp messages and the weekly summary.</li>
          <li>To keep the service secure and working, and to answer your questions.</li>
        </LegalList>
        <p>
          We don&apos;t sell your data, we don&apos;t show advertising, and we don&apos;t use your records for anything
          other than running {PRODUCT_NAME} for you.
        </p>
      </LegalSection>

      <LegalSection title="Who sees your data">
        <p>
          Each person sees only what their role allows. A client sees only their own project, and only what the
          contractor has chosen to share. Other companies and other clients never see it. Photos, receipts and
          documents are kept in private storage and opened through short-lived links; the one public file is a
          company logo.
        </p>
        <p>
          The few people who run {PRODUCT_NAME} can technically reach the system to keep it working, and only do so
          to fix problems or to help when you ask.
        </p>
      </LegalSection>

      <LegalSection title="Companies that handle data for us">
        <p>We use these providers to run the service. They process data only to provide their part of it.</p>
        <LegalList>
          <li><strong className="text-foreground">Supabase:</strong> the database, sign-in and file storage.</li>
          <li><strong className="text-foreground">Vercel:</strong> hosting the website and the app, and counting visits to pages (see Cookies below).</li>
          <li><strong className="text-foreground">Resend:</strong> delivering emails.</li>
          {GOOGLE_AUTH_ENABLED && (
            <li><strong className="text-foreground">Google (Sign in with Google):</strong> letting contractors sign in with their Google account, only if they choose to.</li>
          )}
          {GA_ID && (
            <li><strong className="text-foreground">Google (Analytics):</strong> counting visits to our public pages{GA_REQUIRES_CONSENT ? ", only if you accept analytics cookies" : ", unless you switch it off"}.</li>
          )}
          <li><strong className="text-foreground">Meta (WhatsApp):</strong> delivering WhatsApp messages, only for people who switched them on.</li>
          {streamConfig() && (
            <li><strong className="text-foreground">Cloudflare (Stream):</strong> storing and playing the site videos contractors add to their updates.</li>
          )}
          <li><strong className="text-foreground">A content delivery network</strong> that serves the small country-flag pictures in the phone-number picker, which means your browser contacts it when that picker is shown.</li>
        </LegalList>
        <p>
          These providers may store or process data in countries other than your own. We choose providers that
          protect data, but we can&apos;t control how their systems work. We may also share information if the law
          requires it.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar storage" id="cookies">
        <p>
          We use only what is needed to keep you signed in and to remember small choices, such as your theme, whether
          the sidebar is folded and whether a card is hidden. {GA_ID ? "Apart from the optional analytics described below, there" : "There"} are no advertising or tracking cookies. To see which pages are visited, we use Vercel Web Analytics, which counts page views without cookies and without following you across other sites.
        </p>
        {GA_ID && (
          <p>
            <strong className="text-foreground">{GA_REQUIRES_CONSENT ? "Optional analytics" : "Analytics"}:</strong> on our
            public pages only (the home page, pricing, sign-in and sign-up, and the legal pages) we use Google Analytics to
            understand which pages are useful. It sets cookies.{" "}
            {GA_REQUIRES_CONSENT
              ? "It starts only if you choose Accept in the banner there, and you can change your mind at any time with “Cookie settings” at the bottom of those pages, which also removes the cookies."
              : "It is on by default, and you can switch it off at any time with “Turn off analytics” at the bottom of those pages, which also removes the cookies."}{" "}
            We turn off Google&apos;s advertising features, and Google Analytics is never used inside your account (your
            projects, payments, documents and photos) or on invitation links. Google acts on our behalf, and the
            information it collects, such as your browser and approximate location, may be processed in the United States.
          </p>
        )}
      </LegalSection>

      <LegalSection title="Photos">
        <p>
          Photos are resized on your phone before upload, and the location information phones put inside photos is
          removed.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your data while your account exists. If you ask us to delete your company&apos;s data, we will do so
          within {DELETION_DAYS} days. Copies in logs or provider backups may remain for a short time after that
          before they are overwritten.
        </p>
        <p>
          A client&apos;s account and the records they confirmed belong to a project that a contractor controls: if
          the contractor deletes the project, the client&apos;s view of it goes too.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalList>
          <li>Ask to see, correct or delete the personal information we hold about you.</li>
          <li>Download your records from Settings, under Your data, whenever you like.</li>
          <li>Turn off email and WhatsApp messages in Settings.</li>
          <li>If you are a client and want your information removed, ask your contractor or write to us. Where a contractor holds the project records, we may have to ask them first.</li>
        </LegalList>
        <p>
          {CONTACT_EMAIL ? (
            <>
              Write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>{" "}
              for any of these. We will answer as soon as we can.
            </>
          ) : (
            "Ask the person who set up your account, and they will pass it on."
          )}
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Access to data is enforced where it is stored, not only on screen. No system is perfectly secure. If we
          find out that your data was exposed, we will tell you promptly.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>{PRODUCT_NAME} is for businesses and their clients. It is not meant for anyone under 18.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy in a way that matters, we will update the date at the top and tell you in the
          app or by email.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
