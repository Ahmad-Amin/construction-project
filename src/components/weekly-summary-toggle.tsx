"use client";

import { setWeeklySummaryPreference } from "@/app/dashboard/notifications/actions";
import { PreferenceToggle } from "@/components/preference-toggle";

export function WeeklySummaryToggle({ initial }: { initial: boolean }) {
  return (
    <PreferenceToggle
      id="weekly-summary-toggle"
      label="Weekly project summary"
      description="Every Sunday evening: progress, site photos and payments for each of your projects, in one email."
      initial={initial}
      save={setWeeklySummaryPreference}
    />
  );
}
