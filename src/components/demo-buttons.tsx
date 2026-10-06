import { HardHat, Home } from "lucide-react";
import { enterDemo } from "@/app/demo/actions";
import { getDemoConfig } from "@/lib/demo";
import { button } from "@/lib/ui";

// "Try the demo" without signing up. Renders nothing unless demo mode is configured.
export function DemoButtons({ align = "start" }: { align?: "start" | "center" }) {
  if (!getDemoConfig()) return null;

  return (
    <div className={align === "center" ? "text-center" : undefined}>
      <p className="mb-2 text-sm font-medium">See it with a real sample project, no sign-up:</p>
      <form
        action={enterDemo}
        className={`flex flex-col gap-2 sm:flex-row ${align === "center" ? "sm:justify-center" : ""}`}
      >
        <button name="as" value="contractor" className={button("secondary", "sm")}>
          <HardHat className="size-4" aria-hidden /> View as contractor
        </button>
        <button name="as" value="client" className={button("secondary", "sm")}>
          <Home className="size-4" aria-hidden /> View as homeowner
        </button>
      </form>
    </div>
  );
}
