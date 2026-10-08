"use client";

import { setCompanyWeeklySummary } from "@/app/dashboard/settings/actions";
import { PreferenceToggle } from "@/components/preference-toggle";

export function CompanyWeeklySummaryToggle({ initial }: { initial: boolean }) {
  return (
    <PreferenceToggle
      id="company-weekly-summary"
      label="Send a weekly summary to my clients"
      description="Every Sunday evening each client gets one email per active project, in your company's name: progress, photos and payments. It only contains what they can already see, and weeks with nothing new are skipped. You can pause it for a single project from its Overview."
      initial={initial}
      save={setCompanyWeeklySummary}
    />
  );
}
