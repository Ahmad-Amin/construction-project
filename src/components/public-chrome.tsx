import Link from "next/link";
import { Logo } from "@/components/logo";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-line/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/login" className={button("ghost", "sm")}>
            Sign in
          </Link>
          <Link href="/signup" className={button("primary", "sm")}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line py-8 text-center text-sm text-muted">
      <nav className="mb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Footer">
        <Link href="/trust" className="font-medium hover:text-foreground">
          Private by design
        </Link>
        <Link href="/login" className="hover:text-foreground">
          Sign in
        </Link>
        {CONTACT_EMAIL && (
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
            {CONTACT_EMAIL}
          </a>
        )}
      </nav>
      <p className="text-xs">
        © {new Date().getFullYear()} {OPERATOR_NAME}
      </p>
    </footer>
  );
}
