"use client";

import { useState, useTransition } from "react";
import { saveReminderWhatsApp } from "@/app/dashboard/leads/actions";
import { PhoneField } from "@/components/phone-input";
import { useToast } from "@/components/toast";
import { button } from "@/lib/ui";

// The number a contractor (or staff member) gets their own follow-up reminders on, and the switch. Only they can see
// it. WhatsApp reminders come with the paid plans; on Free they still come in the app and by email.
export function ReminderWhatsApp({ phone, reminders, paid, phoneCountry }: { phone: string | null; reminders: boolean; paid: boolean; phoneCountry: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(phone ? reminders : true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const number = String(new FormData(e.currentTarget).get("reminder_phone") ?? "");
        start(async () => {
          const result = await saveReminderWhatsApp(number, on);
          if (result.error) toast.error("Your number wasn't saved", result.error);
          else toast.success(result.phone ? "Saved" : "Number removed");
        });
      }}
      className="space-y-3"
    >
      <div>
        <p className="text-sm font-medium">Follow-up reminders on WhatsApp</p>
        <p className="mt-1 text-sm text-muted">
          {paid
            ? "On the day a lead's follow-up is due, we send one message to this number. Only you can see it."
            : "WhatsApp reminders come with Pro and Business. Until then you get them in the app and by email."}
        </p>
      </div>
      <div className="max-w-sm">
        <PhoneField name="reminder_phone" defaultValue={phone ?? ""} defaultCountry={phoneCountry.toLowerCase()} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-primary" />
        Send my reminders on WhatsApp
      </label>
      <button type="submit" disabled={pending} className={button("secondary", "sm")}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
