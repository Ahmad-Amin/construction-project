"use client";

import { setEmailNotifications } from "@/app/dashboard/notifications/actions";
import { PreferenceToggle } from "@/components/preference-toggle";

export function EmailToggle({ initial }: { initial: boolean }) {
  return (
    <PreferenceToggle
      id="email-toggle"
      label="Email me about activity"
      description="Payments to confirm, new site updates and finished stages. You always see them in the bell too."
      initial={initial}
      save={setEmailNotifications}
    />
  );
}
