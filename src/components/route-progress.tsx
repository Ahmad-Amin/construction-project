"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Links to these are answered with a file or a redirect to one, so the page itself never changes:
// a progress bar for them would just hang.
const NOT_PAGES = /^\/(api\/|auth\/)|\/(file|statement|export)(\/|$)|[?&]download=/;

// How long to wait before showing the bar, so a navigation that is nearly instant doesn't flash it,
// and how long to give up and hide it if the page never changes.
const SHOW_AFTER_MS = 120;
const GIVE_UP_MS = 15_000;

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;

  // The page the person was on when they clicked, and how many times the bar has started (so each
  // start begins again from the left). The bar is "loading" while they are still on that page.
  const [run, setRun] = useState({ count: 0, from: null as string | null, left: false });
  // Once the page has changed, this start is finished for good (even if they later come back to it).
  if (run.from !== null && run.from !== here && !run.left) setRun({ ...run, left: true });
  const loading = run.from !== null && run.from === here && !run.left;

  const here_ = useRef(here);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // The page changed: a start that was still waiting to show is cancelled.
    here_.current = here;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, [here]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download") || link.hasAttribute("data-no-progress")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (NOT_PAGES.test(url.pathname + url.search)) return;
      // Same page (or only a #section on it): nothing to wait for.
      const target = `${url.pathname}?${url.searchParams.toString()}`;
      if (target === here_.current) return;

      const clickedFrom = here_.current;
      timers.current.forEach(clearTimeout);
      timers.current = [
        setTimeout(() => setRun((r) => ({ count: r.count + 1, from: clickedFrom, left: false })), SHOW_AFTER_MS),
        setTimeout(() => setRun((r) => ({ ...r, from: null })), GIVE_UP_MS),
      ];
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (run.count === 0) return null;
  return <div key={run.count} aria-hidden data-state={loading ? "loading" : "done"} className="route-progress-bar" />;
}

// A thin bar along the top of the page while a link is taking its time to open. It starts when
// someone clicks a link inside the app, and finishes when the next page shows. (Buttons that fetch
// and redirect have their own spinners.)
export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
