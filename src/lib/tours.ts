import type { Role } from "@/components/role-tag";

// The guided tours. Each step points at something on the page by its `data-tour` name; a step whose
// element isn't on screen (the sidebar on a phone, the owner's buttons for a homeowner) is skipped,
// so one list serves every kind of person and every screen size. A step without a target is shown in
// the middle of the screen. Tours are for desktop and larger screens only.
export type TourId = "dashboard" | "project" | "updates" | "expenses" | "payments" | "documents" | "timeline" | "progress";

// Only these start by themselves, the first time someone sees the page (kept on their account). The tour of
// each section inside a project is there for whoever wants it: the compass button in the top bar plays it.
export type AutoTourId = "dashboard" | "project";
export const isAutoTour = (id: TourId): id is AutoTourId => id === "dashboard" || id === "project";

export type TourStep = {
  target?: string;
  title: string;
  body: string;
  // Only for these kinds of people (everyone if left out).
  roles?: Role[];
};

const TOURS: Record<TourId, TourStep[]> = {
  dashboard: [
    {
      title: "Welcome to BuildPeek",
      body: "Here is a one-minute look around. You can skip it at any time, and play it again any time with the compass button at the top.",
      roles: ["contractor", "staff"],
    },
    {
      title: "Welcome to BuildPeek",
      body: "This is where you follow your building projects: progress, site photos, payments and documents. Here is a quick look around.",
      roles: ["homeowner"],
    },
    {
      target: "new-project",
      title: "Start with a project",
      body: "Add the project and your client's details. You then get a private link to send them, and they see only their own project.",
      roles: ["contractor"],
    },
    {
      target: "projects",
      title: "Your projects",
      body: "Every project is listed here with its progress. Open one to post updates, record payments and expenses, and share documents.",
      roles: ["contractor", "staff"],
    },
    {
      target: "projects",
      title: "Your projects",
      body: "Each project shows how far along it is. Open one to see the latest photos, payments and documents.",
      roles: ["homeowner"],
    },
    {
      target: "team",
      title: "Your team",
      body: "Invite site supervisors here. You choose which projects each person can open, and whether they can also see payments.",
      roles: ["contractor"],
    },
    {
      target: "bell",
      title: "Notifications",
      body: "When something happens on a project, like a payment, an update or a shared document, it shows up here. You can get an email too.",
    },
    {
      target: "plan",
      title: "Your plan",
      body: "This shows what your plan includes. The free plan has one active project; see what the paid plans add, or ask to upgrade, in Settings.",
      roles: ["contractor"],
    },
    {
      target: "feedback",
      title: "Tell us what you think",
      body: "Something confusing, broken or missing? Send feedback from here. It comes straight to the people building BuildPeek.",
    },
    {
      target: "settings",
      title: "Settings",
      body: "Your name, notification choices and appearance live here. Contractors also set the company name, logo, currency and time zone.",
    },
  ],
  project: [
    {
      title: "This is your project",
      body: "A quick look at how a project works. You can skip this at any time.",
    },
    {
      target: "project-hero",
      title: "Progress at a glance",
      body: "The latest site photo, how much of the project is complete, and which stage is being built right now.",
    },
    {
      target: "project-sections",
      title: "Everything is in these sections",
      body: "Post site updates with photos, record expenses and payments, keep documents, and follow the timeline and progress by stage.",
      roles: ["contractor", "staff"],
    },
    {
      target: "project-sections",
      title: "Everything is in these sections",
      body: "Follow the site updates and photos, see and confirm payments, and open documents. You can add your own documents too, and choose whether your contractor sees them.",
      roles: ["homeowner"],
    },
    {
      target: "invite",
      title: "Invite your client",
      body: "Send this private link on WhatsApp. They set a password and see only this project, never your other clients.",
      roles: ["contractor"],
    },
    {
      target: "client-sees",
      title: "You choose what your client sees",
      body: "Expenses and documents stay hidden from your client until you share them. This card shows what is visible to them right now.",
      roles: ["contractor"],
    },
    {
      target: "bell",
      title: "Stay in the loop",
      body: "You are notified here when something needs you, such as a payment to confirm or a new update.",
    },
  ],
  updates: [
    {
      title: "Site updates",
      body: "Post what happened on site, with photos. Your client sees each update straight away and is notified.",
      roles: ["contractor", "staff"],
    },
    {
      title: "Site updates",
      body: "Notes and photos from the site, posted by your contractor, newest first.",
      roles: ["homeowner"],
    },
    {
      target: "add",
      title: "Post an update",
      body: "Write a short note and add photos from your phone. It appears here and on your client's page at once.",
      roles: ["contractor", "staff"],
    },
    {
      target: "list",
      title: "Newest first",
      body: "Every update keeps its note and photos. When your client has a phone number saved, an update also has a WhatsApp button to tell them about it.",
      roles: ["contractor", "staff"],
    },
    {
      target: "list",
      title: "Newest first",
      body: "Each update keeps its note and the photos from that day, so you can look back at how the work progressed.",
      roles: ["homeowner"],
    },
  ],
  expenses: [
    {
      title: "Expenses",
      body: "Record what you spend on this project and attach the receipt. Only the expenses you choose to share are shown to your client.",
      roles: ["contractor", "staff"],
    },
    {
      title: "Expenses",
      body: "The expenses your contractor has chosen to share with you, with receipts.",
      roles: ["homeowner"],
    },
    {
      target: "total",
      title: "Total spent",
      body: "The total for this project, and how much of it your client can see.",
      roles: ["contractor", "staff"],
    },
    {
      target: "total",
      title: "What has been spent",
      body: "The total of the expenses shared with you.",
      roles: ["homeowner"],
    },
    {
      target: "add",
      title: "Add an expense",
      body: "Enter the amount, what it was for and a photo of the receipt. If you are the owner, you also choose whether your client sees it.",
      roles: ["contractor", "staff"],
    },
    {
      target: "filters",
      title: "Find an expense",
      body: "Narrow the list by date, and tap a category in the breakdown to focus on it.",
    },
    {
      target: "list",
      title: "Every expense",
      body: "Each one shows what it was for, the amount and its receipt. The owner decides which ones the client sees.",
      roles: ["contractor", "staff"],
    },
    {
      target: "list",
      title: "Every expense",
      body: "Each one shows what it was for, the amount and its receipt.",
      roles: ["homeowner"],
    },
  ],
  payments: [
    {
      title: "Payments",
      body: "Record each instalment you receive. Your client confirms it, so you both have the same record. This only keeps a record; no money moves through the app.",
      roles: ["contractor"],
    },
    {
      title: "Payments",
      body: "The payments recorded on this project, and whether each one has been confirmed.",
      roles: ["staff"],
    },
    {
      title: "Payments",
      body: "When you pay your contractor, record it here. They confirm it, so you both have the same record. No money moves through the app.",
      roles: ["homeowner"],
    },
    {
      target: "total",
      title: "Confirmed total",
      body: "Only confirmed payments are counted. Payments still waiting, and any that were disputed, are listed under the total.",
    },
    {
      target: "schedule",
      title: "Payment schedule",
      body: "Plan the instalments ahead, for example advance, slab and finishing. When one is due it is flagged here.",
      roles: ["contractor"],
    },
    {
      target: "schedule",
      title: "Payment schedule",
      body: "The instalments your contractor planned, and which one is due next.",
      roles: ["staff", "homeowner"],
    },
    {
      target: "add",
      title: "Record a payment",
      body: "Add the amount and date, and a receipt photo if you have one. Your client is asked to confirm it.",
      roles: ["contractor"],
    },
    {
      target: "add",
      title: "Record what you paid",
      body: "Add the amount and date, and a receipt photo if you have one. Your contractor then confirms it.",
      roles: ["homeowner"],
    },
    {
      target: "list",
      title: "Payment history",
      body: "Each payment shows whether it is waiting, confirmed or disputed. The other side confirms it from here.",
    },
  ],
  documents: [
    {
      title: "Documents",
      body: "Keep the contract, drawings, permits and quotations in one place. You choose which ones your client can open, and your client can add documents for you too.",
      roles: ["contractor", "staff"],
    },
    {
      title: "Documents",
      body: "The contract, drawings and permits your contractor shares are here. You can add your own documents too.",
      roles: ["homeowner"],
    },
    {
      target: "filters",
      title: "Filter by type",
      body: "Show only contracts, drawings and so on. The last button shows just the documents your client added for you.",
      roles: ["contractor", "staff"],
    },
    {
      target: "filters",
      title: "Filter by type",
      body: "Show only contracts, drawings and so on. The last button shows just the documents you added yourself.",
      roles: ["homeowner"],
    },
    {
      target: "add",
      title: "Add a document",
      body: "A PDF, Word, Excel or image file up to 20 MB. If you are the owner, you choose whether your client can see it.",
      roles: ["contractor", "staff"],
    },
    {
      target: "add",
      title: "Add your own document",
      body: "Upload something your contractor needs, like an ID or an approval letter. You choose whether to share it with them; if not, it stays private to you.",
      roles: ["homeowner"],
    },
    {
      target: "list",
      title: "Open or download",
      body: "Tap Open to view a PDF or image, or Download to save any file. Each document shows who it is shared with.",
    },
  ],
  timeline: [
    {
      title: "Timeline",
      body: "Everything that happens on this project in one history: site updates, shared expenses and payments, newest first.",
    },
    {
      target: "list",
      title: "One history",
      body: "Scroll back through what happened and when. Use “Show older” at the bottom to go further back.",
    },
  ],
  progress: [
    {
      title: "Progress",
      body: "The project is tracked stage by stage, and the overall percentage comes from those stages.",
    },
    {
      target: "summary",
      title: "Overall progress",
      body: "How far along the whole project is, and how many stages are finished.",
    },
    {
      target: "milestones",
      title: "Update your stages",
      body: "Change a stage's progress as the work moves along. Your client sees every change.",
      roles: ["contractor", "staff"],
    },
    {
      target: "milestones",
      title: "Stage by stage",
      body: "How far along each stage is, in the order the work is done.",
      roles: ["homeowner"],
    },
  ],
};

export function tourFor(id: TourId, role: Role): TourStep[] {
  return TOURS[id].filter((s) => !s.roles || s.roles.includes(role));
}

const SECTION_TOURS = ["updates", "expenses", "payments", "documents", "timeline", "progress"] as const;

// Which tour belongs to the page being looked at: the dashboard, a project's overview, or one of its sections
// (the list page itself, not the add or edit forms).
export function tourIdForPath(pathname: string): TourId | null {
  if (pathname === "/dashboard") return "dashboard";
  const m = pathname.match(/^\/dashboard\/projects\/[0-9a-f-]{36}(?:\/([a-z]+))?$/);
  if (!m) return null;
  if (!m[1]) return "project";
  return (SECTION_TOURS as readonly string[]).includes(m[1]) ? (m[1] as TourId) : null;
}
