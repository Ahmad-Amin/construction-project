import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { CONTACT_EMAIL, GOVERNING_LAW, OPERATOR_NAME, PRODUCT_NAME } from "@/lib/site";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of use",
  description: `The rules for using ${PRODUCT_NAME}, in plain words: your account, what you share with your clients, plans and payment, and changes to these terms.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Terms of use"
      title="The rules, in plain words."
      intro={`These terms are between you and ${OPERATOR_NAME === PRODUCT_NAME ? PRODUCT_NAME : `${OPERATOR_NAME}, which runs ${PRODUCT_NAME}`}. By creating an account or signing in, you agree to them. If you don't agree, please don't use the service.`}
    >
      <LegalSection title="What the service is">
        <p>
          {PRODUCT_NAME} lets a contractor show a client how a project is going: progress, site updates and photos,
          expenses the contractor chooses to share, payments both sides confirm, and documents. A contractor
          creates an account and a company. Their clients are invited and see only their own project.
        </p>
        <p>
          {PRODUCT_NAME} is a tool for keeping and sharing records. It is not a bank, a payment service, an
          escrow service, an accountant, a lawyer or an engineer.
        </p>
      </LegalSection>

      <LegalSection title="Payments are records, not money">
        <p>
          {PRODUCT_NAME} never holds, sends or receives money. A payment in the app is a record that someone
          typed in and the other side confirmed or disputed. We don&apos;t check that a payment really happened or
          that an amount is right, and a record in the app is not proof of payment on its own.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList>
          <li>Give accurate details and keep your password to yourself. You are responsible for what happens under your account.</li>
          <li>You must be at least 18, or have the legal right to make this kind of agreement where you live.</li>
          <li>A contractor can invite staff and clients. The contractor who owns the company decides who has access and what the client can see.</li>
          <li>Tell us promptly if you think someone else is using your account.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="What you put in, and what you share">
        <p>
          You keep ownership of everything you add: records, photos, receipts, documents and details about your
          clients. You give us permission to store it and show it to the people you choose, only to run the
          service for you.
        </p>
        <LegalList>
          <li>You are responsible for the accuracy of what you add, and for having the right to add it (for example, a client&apos;s name and phone number, or a document you didn&apos;t write).</li>
          <li>The contractor decides what a client sees. Once something is shared, the client can open or download it and may keep their own copy. Stopping sharing later doesn&apos;t take back a copy already saved.</li>
          <li>If you ask us to message a client on WhatsApp or email, make sure they have agreed to hear from you that way. Clients can switch these messages off in their settings.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="What you must not do">
        <LegalList>
          <li>Break the law, or use the service to cheat or mislead anyone.</li>
          <li>Upload anything you have no right to share, or anything harmful, such as malware.</li>
          <li>Try to see another company&apos;s or client&apos;s data, or to get around the limits and privacy rules.</li>
          <li>Overload, probe or attack the service, or use it to send spam.</li>
        </LegalList>
        <p>We may suspend an account that does these things.</p>
      </LegalSection>

      <LegalSection title="Disputes between a contractor and a client">
        <p>
          The work, the contract and the money are between the contractor and the client. {PRODUCT_NAME} is not a
          party to either and can&apos;t settle a disagreement. Records in the app, including who confirmed or
          disputed a payment and when, are kept so the two of you have the same picture, but we can&apos;t say what
          they mean legally.
        </p>
      </LegalSection>

      <LegalSection title="The service as it is today">
        <p>
          {PRODUCT_NAME} is a young product. We work to keep it available and
          your data safe, but we can&apos;t promise it will never be down, slow or lose something. Keep your own
          copy of anything you can&apos;t afford to lose: Settings has downloads for your records, and documents can be
          downloaded one by one.
        </p>
        <p>
          We may change the service. If we change something in a way that affects you, we will tell you before it
          does, and you can stop using it instead.
        </p>
      </LegalSection>

      <LegalSection title="Plans and payment">
        <p>
          {PRODUCT_NAME} has a free plan and paid plans, described on the Pricing page. Only the contractor has a plan:
          clients are never charged. A plan decides how many projects can be active at once and whether automatic
          WhatsApp updates and PDF statements are included.
        </p>
        <LegalList>
          <li>Paid plans are paid in advance for a month or a year. Prices are in US dollars and may change; a change doesn&apos;t affect a period you have already paid for.</li>
          <li>If a paid plan ends, the account goes back to the free plan. Nothing is deleted: your projects and records stay, but you can&apos;t start more active projects than the free plan allows, and the paid features pause until you renew.</li>
          <li>To cancel or change a plan, write to us. We don&apos;t refund a period already paid for unless the law says we must.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Leaving, and deletion">
        <p>
          You can stop at any time. Ask us to delete your company&apos;s data and we will do so within a set time
          (see the Privacy policy). We may suspend or close an account that breaks these terms, or if the law
          requires it. We will tell you why where we can.
        </p>
      </LegalSection>

      <LegalSection title="Our responsibility to you">
        <p>
          The service is provided &ldquo;as is&rdquo;. As far as the law allows, {OPERATOR_NAME} is not liable for
          indirect or consequential losses, lost profit, lost business, or losses that come from the work done on a
          project or from a disagreement between a contractor and a client. Our total liability for anything
          connected to the service is limited to the amount you paid us in the 12 months before the problem, or
          zero if the service was free.
        </p>
        <p>Nothing here limits any right you have by law that can&apos;t be limited.</p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. When we make an important change, we will update the date at the top and tell
          you in the app or by email. If you keep using the service after that, you accept the new terms.
        </p>
      </LegalSection>

      <LegalSection title="Which law applies">
        <p>
          These terms are governed by the laws of {GOVERNING_LAW}, and its courts can decide a dispute about them,
          unless the law where you live gives you the right to bring a claim elsewhere.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {CONTACT_EMAIL ? (
            <>
              Write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>{" "}
              with any question about these terms.
            </>
          ) : (
            "Ask the person who set up your account, and they will pass it on."
          )}
        </p>
      </LegalSection>
    </LegalPage>
  );
}
