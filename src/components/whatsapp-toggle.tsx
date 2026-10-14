"use client";

import { setWhatsAppNotifications } from "@/app/dashboard/notifications/actions";
import { PreferenceToggle } from "@/components/preference-toggle";

export function WhatsAppToggle({ initial, phone, available = true }: { initial: boolean; phone: string | null; available?: boolean }) {
  // The contractor's plan decides whether WhatsApp updates exist at all: say so, rather than show a switch that does nothing.
  if (!available) {
    return (
      <div>
        <p className="text-sm font-medium">Updates on WhatsApp</p>
        <p className="mt-1 text-sm text-muted">
          Not available for your project. Your contractor&apos;s plan doesn&apos;t include WhatsApp updates. You still get every
          update in the app and by email.
        </p>
      </div>
    );
  }
  return (
    <PreferenceToggle
      id="whatsapp-toggle"
      label="Send me updates on WhatsApp"
      description={
        phone
          ? `Payments to confirm, new site updates and finished stages, sent to ${phone}. Switch this off any time.`
          : "Payments to confirm, new site updates and finished stages. Your contractor hasn't saved a phone number for you yet, so nothing can be sent until they do."
      }
      initial={initial}
      save={setWhatsAppNotifications}
    />
  );
}
