import Link from "next/link";
import { Logo } from "@/components/logo";
import { CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

// `wide` is for the landing page; the text pages (privacy) use the narrow width.
export function PublicHeader({ wide = false, children }: { wide?: boolean; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-background/85 backdrop-blur">
      <div className={`mx-auto flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6 ${wide ? "max-w-7xl lg:px-12" : "max-w-3xl"}`}>
        <Logo />
        {children}
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

export function PublicFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className={`mx-auto w-full px-5 pb-10 pt-4 text-sm text-muted sm:px-6 ${wide ? "max-w-7xl lg:px-12" : "max-w-3xl"}`}>
      <nav className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Footer">
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
