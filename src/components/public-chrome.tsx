import Link from "next/link";
import { CookieSettingsButton } from "@/components/analytics-consent";
import { BrandImage, Logo } from "@/components/logo";
import { ThemeQuickToggle } from "@/components/theme-quick-toggle";
import { GA_ID } from "@/lib/analytics";
import { CONTACT_EMAIL, OPERATOR_NAME, PRODUCT_NAME } from "@/lib/site";
import { button } from "@/lib/ui";

// `wide` is for the landing page; the text pages (privacy) use the narrow width. `children` replaces the
// Pricing and Guides links (the landing page shows its own section links there).
export function PublicHeader({ wide = false, children }: { wide?: boolean; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-background/85 backdrop-blur">
      <div className={`mx-auto flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-6 ${wide ? "max-w-[96rem] lg:px-12 2xl:px-16" : "max-w-3xl"}`}>
        <Logo />
        {children ?? (
          <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
            <Link href="/pricing" className={button("ghost", "sm")}>
              Pricing
            </Link>
            <Link href="/guides" className={button("ghost", "sm")}>
              Guides
            </Link>
          </nav>
        )}
        <nav className="flex items-center gap-1">
          <ThemeQuickToggle />
          <Link href="/login" className={button("ghost", "sm")}>
            Sign in
          </Link>
          {/* On narrow phones there isn't room for all three; the page's own button covers sign-up. */}
          <Link href="/signup" className={`${button("primary", "sm")} max-[459px]:hidden`}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

const footerLink = "text-muted transition-colors hover:text-foreground";

// The footer of every public page: the logo and a line about what BuildPeek is, three short lists
// of links, and the small print along the bottom.
export function PublicFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="mt-16 border-t border-line bg-surface-2/40">
      <div className={`mx-auto w-full px-5 py-12 sm:px-6 ${wide ? "max-w-[96rem] lg:px-12 2xl:px-16" : "max-w-3xl"}`}>
        <div className={`grid gap-10 ${wide ? "sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]" : "sm:grid-cols-3"}`}>
          <div className={wide ? "sm:col-span-2 lg:col-span-1" : "sm:col-span-3"}>
            <Link href="/" aria-label={PRODUCT_NAME} className="inline-block">
              <BrandImage variant="vertical" className="h-24" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              Show your clients how the work is going: progress, photos, payments and documents in one place.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Product</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/" className={footerLink}>
                  Overview
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={footerLink}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/guides" className={footerLink}>
                  Guides and templates
                </Link>
              </li>
              <li>
                <Link href="/signup" className={footerLink}>
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/login" className={footerLink}>
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Trust and legal">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Trust</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/trust" className={footerLink}>
                  Private by design
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={footerLink}>
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={footerLink}>
                  Terms of use
                </Link>
              </li>
              {GA_ID && (
                <li>
                  <CookieSettingsButton className={footerLink} />
                </li>
              )}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Contact</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {CONTACT_EMAIL ? (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={footerLink}>
                    {CONTACT_EMAIL}
                  </a>
                </li>
              ) : (
                <li className="text-muted">Ask the person who set up your account.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:pr-16">
          <p>
            © {new Date().getFullYear()} {OPERATOR_NAME}. All rights reserved.
          </p>
          <p>Built for contractors and the people they build for.</p>
        </div>
      </div>
    </footer>
  );
}
