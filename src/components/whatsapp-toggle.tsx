"use client";

import { setWhatsAppNotifications } from "@/app/dashboard/notifications/actions";
import { PreferenceToggle } from "@/components/preference-toggle";

export function WhatsAppToggle({ initial, phone }: { initial: boolean; phone: string | null }) {
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
