import { CalendarClock, Mail, MessageCircle, Phone, Trophy, XCircle } from "lucide-react";
import { whatsappNumber } from "@/lib/format";
import { followUpLabel, followUpState, lostReasonLabel, type Lead } from "@/lib/leads";

// Small pieces the leads board and a lead's panel share.

const chipTone = {
  overdue: "bg-danger-soft text-danger",
  today: "bg-primary-soft text-primary-hover",
  soon: "bg-surface-2 text-foreground",
  later: "bg-surface-2 text-muted",
} as const;

// When the next follow-up is: red when overdue, amber today.
export function FollowUpChip({ day, today, className = "" }: { day: string | null; today: string; className?: string }) {
  const state = followUpState(day, today);
  if (!day || !state) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${chipTone[state]} ${className}`}>
      <CalendarClock className="size-3" aria-hidden />
      <span className="sr-only">Follow up: </span>
      {followUpLabel(day, today)}
    </span>
  );
}

const contactButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-sm font-semibold text-foreground transition-colors hover:bg-surface-2";

// One tap to WhatsApp or call the lead (and email, in the panel).
export function ContactButtons({ lead, withEmail = false, compact = false }: { lead: Pick<Lead, "name" | "phone" | "email">; withEmail?: boolean; compact?: boolean }) {
  const wa = whatsappNumber(lead.phone);
  const size = compact ? "size-8" : "px-3 py-2";
  if (!wa && !(withEmail && lead.email)) return null;
  return (
    <span className="relative z-10 flex flex-wrap items-center gap-1.5">
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${lead.name}`} title="WhatsApp" className={`${contactButton} ${size}`}>
          <MessageCircle className="size-4 text-success" aria-hidden />
          {!compact && "WhatsApp"}
        </a>
      )}
      {lead.phone && (
        <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.name}`} title="Call" className={`${contactButton} ${size}`}>
          <Phone className="size-4" aria-hidden />
          {!compact && "Call"}
        </a>
      )}
      {withEmail && lead.email && (
        <a href={`mailto:${lead.email}`} aria-label={`Email ${lead.name}`} title="Email" className={`${contactButton} ${size}`}>
          <Mail className="size-4" aria-hidden />
          {!compact && "Email"}
        </a>
      )}
    </span>
  );
}

// Where a lead stands: its stage while open, or how it ended.
export function LeadStatusBadge({ lead, stageName, color }: { lead: Pick<Lead, "status" | "lostReason">; stageName: string | null; color?: string }) {
  if (lead.status === "won") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
        <Trophy className="size-3.5" aria-hidden /> Won
      </span>
    );
  }
  if (lead.status === "lost") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-muted">
        <XCircle className="size-3.5" aria-hidden /> Lost{lead.lostReason ? ` · ${lostReasonLabel(lead.lostReason)}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-foreground ring-1 ring-line">
      <span className="size-2 rounded-full bg-primary" style={color ? { background: color } : undefined} aria-hidden />
      {stageName ?? "Open"}
    </span>
  );
}
