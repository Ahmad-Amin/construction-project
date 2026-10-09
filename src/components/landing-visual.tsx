import { Banknote, Camera, CheckCircle2 } from "lucide-react";
import { ProjectPreview } from "@/components/project-preview";

// The hero picture: a phone showing a sample project, with two small cards around it that show
// what the client gets without asking. All of it is an illustration, not real data.
export function LandingVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] 2xl:max-w-[38rem]">
      <div className="bg-hero absolute inset-x-2 inset-y-8 -z-10 rounded-[2.5rem]" aria-hidden />

      <div className="relative py-2 sm:py-4">
        {/* The phone, on the right. */}
        <div className="animate-float" style={{ animationDuration: "9s" }}>
        <div className="mx-auto w-[20rem] max-w-full rounded-[2.4rem] border-[9px] border-[color-mix(in_srgb,var(--foreground)_42%,var(--background))] bg-background p-3 shadow-2xl shadow-black/15 sm:mr-4 sm:ml-auto">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-foreground/15" aria-hidden />
          <ProjectPreview />
        </div>
        </div>

        {/* What it feels like for the client: things simply show up. */}
        <div
          className="animate-rise absolute left-0 top-[24%] hidden w-56 -rotate-1 sm:block"
          style={{ animationDelay: "260ms" }}
        >
          <div
            className="animate-float rounded-2xl border border-line bg-surface p-3.5 shadow-xl shadow-black/10"
            style={{ animationDuration: "6s", animationDelay: "-1.5s" }}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Payment confirmed</p>
                <p className="mt-0.5 text-xs text-muted">PKR 4,000,000, confirmed by Ahmed</p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="animate-rise absolute bottom-[18%] left-0 hidden w-56 rotate-1 sm:block"
          style={{ animationDelay: "380ms" }}
        >
          <div
            className="animate-float rounded-2xl border border-line bg-surface p-3.5 shadow-xl shadow-black/10"
            style={{ animationDuration: "7.5s", animationDelay: "-4s" }}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-data-accent">
                <Camera className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">New site update</p>
                <p className="mt-0.5 text-xs text-muted">Roof slab cast, 3 photos</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <Banknote className="size-3.5" aria-hidden /> A sample project, for illustration.
      </p>
    </div>
  );
}
