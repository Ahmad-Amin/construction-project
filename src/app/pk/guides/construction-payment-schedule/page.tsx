import { GuideArticle, GuideSection, Screenshot, StageTable, Tips, type GuideQuestion } from "@/components/guide-article";
import { PaymentScheduleCalculator, type SchedulePreset } from "@/components/payment-schedule-calculator";
import { guideAt, guideVersions } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo";
import { PRODUCT_NAME } from "@/lib/site";

// The Pakistan version of the payment schedule guide: instalments in rupees, grey structure and finishing,
// and the arguments that come up on Pakistani sites. The worldwide version is at /guides/...; keep the two in
// step when the advice changes.
const guide = guideAt("/pk/guides/construction-payment-schedule");

export const metadata = pageMetadata({
  title: guide.metaTitle,
  description: guide.description,
  path: guide.path,
  versions: guideVersions(guide),
  locale: "en_PK",
  type: "article",
  published: guide.published,
  modified: guide.updated,
  ownImage: true,
});

const GREY_STRUCTURE: [string, number][] = [
  ["Advance, on signing", 10],
  ["Foundation and plinth (DPC)", 15],
  ["Ground floor walls", 10],
  ["Ground floor roof slab (lenter)", 15],
  ["First floor walls", 10],
  ["First floor roof slab (lenter)", 15],
  ["Plaster, electrical conduits and plumbing lines", 15],
  ["Handover, after the snag check", 10],
];

const FINISHING: [string, number][] = [
  ["Advance, on signing", 10],
  ["Tiles and flooring", 25],
  ["Woodwork: doors, kitchen and wardrobes", 20],
  ["Electrical and sanitary fittings", 20],
  ["Paint and polish", 15],
  ["Handover, after the snag check", 10],
];

const presets: SchedulePreset[] = [
  { id: "grey", label: "Grey structure", stages: GREY_STRUCTURE.map(([name, percent]) => ({ name, percent })) },
  { id: "finishing", label: "Finishing", stages: FINISHING.map(([name, percent]) => ({ name, percent })) },
];

const faqs: GuideQuestion[] = [
  {
    q: "How much advance should I pay a contractor in Pakistan?",
    a: "Many contracts start with an advance of about 10% of the contract value: enough to bring labour to site and buy the first material. Be careful about paying a large share before any work is done. The rest should follow the stages.",
  },
  {
    q: "What does grey structure include?",
    a: "Usually the foundation, columns and beams, brickwork, roof slabs, plaster, and the pipes for electrical wiring and plumbing laid inside the walls and slabs. Tiles, woodwork, fittings and paint are finishing. It varies from contractor to contractor, so write down exactly what is included before you sign.",
  },
  {
    q: "Should I pay in cash or by bank transfer?",
    a: "A bank transfer, a cheque, or a JazzCash or Easypaisa payment leaves a record, which helps if there is a disagreement later. If you pay in cash, get a written receipt from the person who took the money, and record the payment somewhere both of you can see.",
  },
  {
    q: "What if steel or cement prices go up during the work?",
    a: "It depends on the contract. With a fixed rate, the contractor carries the risk. With an escalation clause, the price changes in a way you agreed in advance. Decide which one before you sign: it is one of the most common arguments on Pakistani sites.",
  },
  {
    q: "How can I follow my house construction from abroad?",
    a: `Ask your contractor for photos or a short video at every stage, and release each instalment only when its stage is done. With ${PRODUCT_NAME}, you see the progress, photos and payments on your phone wherever you are, and you confirm each payment yourself.`,
  },
  {
    q: "Is the template really free?",
    a: "Yes. Download it, change it and share it with your contractor or your client. You don't need an account.",
  },
];

export default function Page() {
  return (
    <GuideArticle
      guide={guide}
      shortTitle="Payment schedule"
      intro="Most houses in Pakistan are paid for in instalments: an advance, then a payment as each stage is finished. Here is a stage-wise plan for grey structure and for finishing, in rupees, a calculator to make your own, and a free template to download."
      minutes={7}
      otherNote="Building outside Pakistan?"
      contents={[
        { id: "how-it-works", title: "How instalments usually work" },
        { id: "grey-structure", title: "Example: grey structure for a 10 marla house" },
        { id: "finishing", title: "Example: finishing" },
        { id: "template", title: "Make your own: free template" },
        { id: "avoid-disputes", title: "How to avoid the usual arguments" },
        { id: "in-buildpeek", title: `Tracking it in ${PRODUCT_NAME}` },
      ]}
      faqs={faqs}
    >
      <GuideSection id="how-it-works" title="How instalments usually work in Pakistan">
        <p>
          Most house contracts in Pakistan are paid in instalments: an advance when the contract is signed, then a
          payment as each stage is finished. Write the plan into the contract, or sign it as a page next to it, before
          the work starts. A plan that only exists in conversation is the start of most payment arguments.
        </p>
        <p>How the plan looks depends on the kind of contract:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Grey structure, with material.</strong> The contractor builds the structure and buys the material,
            usually at an agreed rate per square foot. This is where most of the money goes, so it needs the most careful
            plan.
          </li>
          <li>
            <strong>Finishing.</strong> Tiles, woodwork, fittings and paint. Often a separate contract after the grey
            structure, or part of a complete (turnkey) contract.
          </li>
          <li>
            <strong>Labour only (theka).</strong> The owner buys the material and the contractor brings the labour. The
            instalments cover the labour only, so they are smaller, and the owner keeps their own record of the material
            they buy.
          </li>
        </ul>
      </GuideSection>

      <GuideSection id="grey-structure" title="Example: grey structure instalments for a 10 marla house">
        <p>
          Say a double-storey house on a 10 marla plot, with a grey structure contract (with material) of PKR 10,000,000,
          that is 1 crore. A stage-wise plan could look like this:
        </p>
        <StageTable
          caption="Double-storey 10 marla house, grey structure, PKR 1 crore"
          currency="PKR"
          total={10000000}
          stages={GREY_STRUCTURE}
        />
        <p>
          The advance gets the work started. The biggest payments come with the two roof slabs, when most of the steel
          and concrete is bought. The last 10% waits until handover, so the small jobs at the end get done.
        </p>
      </GuideSection>

      <GuideSection id="finishing" title="Example: finishing instalments">
        <p>For a finishing contract of PKR 6,000,000 (60 lakh), the plan follows the trades as they come on site:</p>
        <StageTable caption="Finishing, PKR 60 lakh" currency="PKR" total={6000000} stages={FINISHING} />
      </GuideSection>

      <GuideSection id="template" title="Make your own: free instalment plan template">
        <p>
          Enter your contract value in rupees and change the stages to match your contract. When it looks right,
          download it as a spreadsheet to share with your client or contractor, with space to record each payment.
        </p>
        <PaymentScheduleCalculator currency="PKR" presets={presets} defaultValue={10000000} />
      </GuideSection>

      <GuideSection id="avoid-disputes" title="How to avoid the usual arguments">
        <Tips
          items={[
            {
              title: "Tie each instalment to a stage you can both see.",
              body: "“First floor lenter cast” can be checked on site. “March” can't, and a date-based instalment falls due whether the work is there or not.",
            },
            {
              title: "Keep the advance reasonable.",
              body: "Around 10% is enough to bring labour to site and buy the first material. Be careful with large advances before any work is done.",
            },
            {
              title: "Decide what happens if steel or cement prices change.",
              body: "Prices can move a lot during a build. Write down whether the rate is fixed, or how an increase will be shared, before you sign.",
            },
            {
              title: "Pay through the bank where you can.",
              body: "A bank transfer, a cheque, or a JazzCash or Easypaisa payment leaves a record. If you pay in cash, get a written receipt signed by the person who took the money.",
            },
            {
              title: "Agree on extra work before it starts.",
              body: "A change to the drawing, an extra room, better tiles: put the price in writing first, and keep it apart from the instalments.",
            },
            {
              title: "Keep 5 to 10% until handover.",
              body: "Release it after the final walk-through, once the snag list is cleared.",
            },
            {
              title: "Living abroad?",
              body: "Ask for photos or a short video at every stage before you release the next instalment, and keep one record of payments that both of you confirm.",
            },
          ]}
        />
      </GuideSection>

      <GuideSection id="in-buildpeek" title={`Tracking instalments in ${PRODUCT_NAME}`}>
        <p>
          A register or a spreadsheet works until there are two copies of it. In {PRODUCT_NAME}, the instalment plan lives
          on the project, where the contractor and the client both see it:
        </p>
        <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-foreground">
          <li>Add each instalment with its amount, and choose when it is due: from the start, or when a stage is complete.</li>
          <li>When that stage reaches 100%, the instalment falls due and the client is told.</li>
          <li>
            When the money arrives, record it with the date, a reference such as the cheque or transfer number, and a
            photo of the receipt. The client confirms it. Or the client records it, and the contractor confirms.
          </li>
          <li>Both of you always see what has been received, what has been invoiced and what is still outstanding.</li>
        </ol>
        <Screenshot
          src="/guides/payments-and-schedule.webp"
          alt="The Payments page in BuildPeek: PKR 1,720,000 received and confirmed, PKR 100,000 invoiced, PKR 30,000 outstanding, and the payment schedule"
          width={1600}
          height={498}
          caption="What's been received, invoiced and planned, on one page."
        />
        <Screenshot
          src="/guides/record-payment.webp"
          alt="The Record payment form in BuildPeek: PKR 100,000 with an HBL transfer reference and a photo of the bank receipt"
          width={900}
          height={1207}
          caption="Recording a payment with its receipt. The homeowner is asked to confirm it."
          narrow
        />
      </GuideSection>
    </GuideArticle>
  );
}
