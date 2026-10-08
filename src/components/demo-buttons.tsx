import { HardHat, Home } from "lucide-react";
import { enterDemo } from "@/app/demo/actions";
import { SubmitButton } from "@/components/submit-button";
import { getDemoConfig } from "@/lib/demo";
import { button } from "@/lib/ui";

// "Try the demo" without signing up. Renders nothing unless demo mode is configured.
// `compact` puts two short buttons side by side, for narrow cards.
export function DemoButtons({ align = "start", compact = false }: { align?: "start" | "center"; compact?: boolean }) {
  if (!getDemoConfig()) return null;

  return (
    <div className={align === "center" ? "text-center" : undefined}>
      <p className={`mb-2 font-medium ${compact ? "text-sm text-muted" : "text-sm"}`}>
        {compact ? "No account? Try the live demo:" : "See it with a real sample project, no sign-up:"}
      </p>
      <form
        action={enterDemo}
        className={compact ? "grid grid-cols-2 gap-2" : `flex flex-wrap gap-2 ${align === "center" ? "justify-center" : ""}`}
      >
        <SubmitButton
          name="as"
          value="contractor"
          icon={<HardHat className="size-4" aria-hidden />}
          pendingLabel="Opening…"
          className={button("secondary", "sm")}
        >
          {compact ? "Contractor" : "View as contractor"}
        </SubmitButton>
        <SubmitButton
          name="as"
          value="client"
          icon={<Home className="size-4" aria-hidden />}
          pendingLabel="Opening…"
          className={button("secondary", "sm")}
        >
          {compact ? "Homeowner" : "View as homeowner"}
        </SubmitButton>
      </form>
    </div>
  );
}
