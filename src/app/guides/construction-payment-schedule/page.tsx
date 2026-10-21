import { GuideArticle, GuideSection, Screenshot, StageTable, Tips, type GuideQuestion } from "@/components/guide-article";
import { PaymentScheduleCalculator, type SchedulePreset } from "@/components/payment-schedule-calculator";
import { guideAt, guideVersions } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";
import { PRODUCT_NAME } from "@/lib/site";

// The worldwide version of the payment schedule guide. The Pakistan version (/pk/guides/...) has its own
// stages, money and words; keep the two in step when the advice changes.
const guide = guideAt("/guides/construction-payment-schedule");

export const metadata = pageMetadata({
  title: guide.metaTitle,
  description: guide.description,
  path: guide.path,
  versions: guideVersions(guide),
  type: "article",
  published: guide.published,
  modified: guide.updated,
  ownImage: true,
});

const NEW_HOME: [string, number][] = [
  ["Deposit, on signing", 5],
  ["Foundation or slab", 10],
  ["Frame", 15],
  ["Roof on and closed in (lock-up)", 20],
  ["Rough-ins: plumbing, electrical, heating and cooling", 15],
  ["Drywall or plaster", 15],
  ["Fixtures and finishes", 15],
  ["Final completion and handover", 5],
];

const RENOVATION: [string, number][] = [
  ["Deposit, on signing", 10],
  ["Demolition and rough-ins", 30],
  ["Drywall or plaster", 25],
  ["Finishes and fixtures", 25],
  ["Final completion and handover", 10],
];

const presets: SchedulePreset[] = [
  { id: "home", label: "New home", stages: NEW_HOME.map(([name, percent]) => ({ name, percent })) },
  { id: "renovation", label: "Renovation", stages: RENOVATION.map(([name, percent]) => ({ name, percent })) },
];

const faqs: GuideQuestion[] = [
  {
    q: "What is a draw schedule?",
    a: "It is the usual American name for a construction payment schedule: the list of payments, or draws, released as each stage of the build is finished. When the build is paid for with a construction loan, the lender often sends an inspector to check the stage before it releases each draw.",
  },
  {
    q: "How much deposit should a builder ask for?",
    a: "Often 5 to 10% of the contract: enough to book the job and order the first materials. Some places limit the deposit by law, such as California for home improvement work and several Australian states for home building, so check the rules where you build.",
  },
  {
    q: "Should payments be tied to dates or to stages?",
    a: "To stages. A payment tied to a date can fall due before the work is done, or long after it is finished. A payment tied to a stage follows the work itself, so neither side pays or waits for nothing.",
  },
  {
    q: "What is retention?",
    a: "A part of each payment, often around 5%, that the client holds back until the work is finished and early defects are fixed. It is common on commercial jobs. On homes, a final payment released at handover usually does the same job.",
  },
  {
    q: "What if the client says a stage isn't finished?",
    a: `Agree in advance what "finished" means for each stage, and show it with photos or an inspection result before asking for the payment. In ${PRODUCT_NAME}, a client can dispute a payment and say why, and nothing counts towards the total until it is sorted.`,
  },
  {
    q: "Is the template really free?",
    a: "Yes. Download it, change it and use it with your clients. You don't need an account.",
  },
];

export default function Page() {
  return (
    <GuideArticle
      guide={guide}
      shortTitle="Payment schedule"
      intro="A payment schedule says how much the client pays, and what has to be finished before each payment is due. Here are typical stages and percentages for a new home and a renovation, a calculator to make your own, and a free template to download."
      minutes={7}
      otherNote="Building in Pakistan?"
      contents={[
        { id: "what-it-is", title: "What a payment schedule is" },
        { id: "new-home", title: "Example: a new home" },
        { id: "renovation", title: "Example: a renovation" },
        { id: "template", title: "Make your own: free template" },
        { id: "avoid-disputes", title: "How to avoid payment disputes" },
        { id: "in-buildpeek", title: `Tracking it in ${PRODUCT_NAME}` },
      ]}
      faqs={faqs}
    >
      <GuideSection id="what-it-is" title="What a payment schedule is">
        <p>
          A construction payment schedule lists every payment in a building contract: how much it is, and what has to
          be finished before it is due. It is agreed before the work starts, and it usually sits in the contract or
          next to it.
        </p>
        <p>
          It goes by different names. In the United States it is often called a <strong>draw schedule</strong>. In the
          UK, Ireland and Australia people say <strong>stage payments</strong> or <strong>progress payments</strong>. In
          much of South Asia and the Middle East they are <strong>instalments</strong>. The idea is the same
          everywhere: the client pays as the work gets done, not all at once and not by the calendar.
        </p>
        <p>
          A good schedule protects both sides. The builder has money in time to pay for the labour and materials of
          the next stage. The client never pays far ahead of work they can see.
        </p>
      </GuideSection>

      <GuideSection id="new-home" title="Example: payment schedule for a new home">
        <p>
          Here is a common shape for a new house. The percentages are a starting point, not a rule: change them to suit
          your contract, your cash flow and the law where you build.
        </p>
        <StageTable caption="New home, contract value USD 450,000" currency="USD" total={450000} stages={NEW_HOME} />
        <p>
          Notice the pattern: a small deposit, the largest payments in the middle, when most of the money goes into
          materials (frame, roof, rough-ins), and a final payment kept until handover. That last payment matters. It
          gives everyone a reason to finish the small jobs at the end.
        </p>
      </GuideSection>

      <GuideSection id="renovation" title="Example: payment schedule for a renovation">
        <p>A renovation has fewer stages and a shorter timeline, so each payment is a bigger share of the whole.</p>
        <StageTable
          caption="Kitchen and bathroom renovation, contract value USD 60,000"
          currency="USD"
          total={60000}
          stages={RENOVATION}
        />
        <p>
          For a small job that lasts a week or two, two or three payments are often enough: a deposit, one in the
          middle and the rest on completion.
        </p>
      </GuideSection>

      <GuideSection id="template" title="Make your own: free payment schedule template">
        <p>
          Enter your contract value and change the stages to match your job. The amounts update as you type. When it
          looks right, download it as a spreadsheet, with space to record each payment as it comes in.
        </p>
        <PaymentScheduleCalculator currency="USD" presets={presets} defaultValue={450000} />
      </GuideSection>

      <GuideSection id="avoid-disputes" title="How to set it up so it doesn't cause arguments">
        <Tips
          items={[
            {
              title: "Tie each payment to something you can both see.",
              body: "“Frame complete” can be checked. “End of March” can't, and if the work runs late, a date-based payment falls due for work that isn't there.",
            },
            {
              title: "Say what “complete” means.",
              body: "Write down what has to be true for each stage: an inspection passed, the roof watertight, every outlet wired. Most stage disputes come down to this one word.",
            },
            {
              title: "Keep the deposit small.",
              body: "A large deposit makes clients nervous, and some places cap it by law, so check the rules where you build.",
            },
            {
              title: "Show the work before you ask for money.",
              body: "A few photos and a short note at each stage answer the client's question before they ask it.",
            },
            {
              title: "Hold back the last payment until handover.",
              body: "Keeping 5 to 10% until the final walk-through and the punch list (snag list) are done gives everyone a reason to finish.",
            },
            {
              title: "Price extra work separately.",
              body: "When the client asks for something that isn't in the contract, agree the price in writing before you do it, and keep it apart from the stage payments.",
            },
            {
              title: "Record every payment, and have the other side confirm it.",
              body: "A record both sides agree on puts an end to “I'm sure I paid that”.",
            },
          ]}
        />
      </GuideSection>

      <GuideSection id="in-buildpeek" title={`Tracking the schedule in ${PRODUCT_NAME}`}>
        <p>
          A spreadsheet works until there are two copies of it. In {PRODUCT_NAME}, the schedule lives on the project, where
          you and your client both see it:
        </p>
        <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-foreground">
          <li>Add each payment with its amount, and choose when it is due: from the start, or when a stage is complete.</li>
          <li>When that stage reaches 100%, the payment falls due and your client is told.</li>
          <li>
            When the money arrives, record it with the date, a reference and a photo of the receipt. Your client confirms
            it. Or your client records it, and you confirm.
          </li>
          <li>Both of you always see what has been received, what has been invoiced and what is still outstanding.</li>
        </ol>
        <Screenshot
          src="/guides/payments-and-schedule.webp"
          alt="The Payments page in BuildPeek: money received and confirmed, money invoiced and outstanding, and the payment schedule"
          width={1600}
          height={498}
          caption="What's been received, invoiced and planned, on one page. Projects can be in any currency; this one is in Pakistani rupees."
        />
        <Screenshot
          src="/guides/record-payment.webp"
          alt="The Record payment form in BuildPeek, with the amount, date, reference and a photo of the bank receipt"
          width={900}
          height={1207}
          caption="Recording a payment with its receipt. The client is asked to confirm it."
          narrow
        />
      </GuideSection>
    </GuideArticle>
  );
}
