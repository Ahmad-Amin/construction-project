import type { Role } from "@/components/role-tag";

// The guided tours. Each step points at something on the page by its `data-tour` name; a step whose
// element isn't on screen (the sidebar on a phone, the owner's buttons for a homeowner) is skipped,
// so one list serves every kind of person and every screen size. A step without a target is shown in
// the middle of the screen. Tours are for desktop and larger screens only.
export type TourId = "dashboard" | "project";

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
};

export function tourFor(id: TourId, role: Role): TourStep[] {
  return TOURS[id].filter((s) => !s.roles || s.roles.includes(role));
}

// Which tour belongs to the page being looked at: the dashboard, or a project's overview.
export function tourIdForPath(pathname: string): TourId | null {
  if (pathname === "/dashboard") return "dashboard";
  if (/^\/dashboard\/projects\/[0-9a-f-]{36}$/.test(pathname)) return "project";
  return null;
}
