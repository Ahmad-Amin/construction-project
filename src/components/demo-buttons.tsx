import { HardHat, Home } from "lucide-react";
import { enterDemo } from "@/app/demo/actions";
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
        <button name="as" value="contractor" className={button("secondary", "sm")}>
          <HardHat className="size-4" aria-hidden /> {compact ? "Contractor" : "View as contractor"}
        </button>
        <button name="as" value="client" className={button("secondary", "sm")}>
          <Home className="size-4" aria-hidden /> {compact ? "Homeowner" : "View as homeowner"}
        </button>
      </form>
    </div>
  );
}
