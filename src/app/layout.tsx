import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { RouteProgress } from "@/components/route-progress";
import { PRODUCT_NAME } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Progress, money, receipts and project updates, shared between contractor and homeowner.";

export const metadata: Metadata = {
  // Makes every address in the tags below absolute, which link previews need. Set SITE_URL in production.
  metadataBase: new URL(process.env.SITE_URL?.trim() || "http://localhost:3000"),
  applicationName: PRODUCT_NAME,
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: DESCRIPTION,
  icons: { apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: "default" },
  // What shows when a link is shared on WhatsApp, Facebook, LinkedIn and the like. The picture
  // comes from opengraph-image.tsx next to this file.
  openGraph: { type: "website", siteName: PRODUCT_NAME, title: PRODUCT_NAME, description: DESCRIPTION, locale: "en_PK" },
  twitter: { card: "summary_large_image", title: PRODUCT_NAME, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint, so there is no flash of the wrong one.
            The string is a constant; nothing user-supplied goes into it. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}',
          }}
        />
      </head>
      {/* Some browser extensions (ColorZilla's cz-shortcut-listen, password managers) add attributes
          to <body> before React loads. This only silences that attribute mismatch on this one
          element; real mismatches anywhere inside the page are still reported. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <RouteProgress />
        {children}
        {/* Vercel Web Analytics: page views only, no cookies. It does nothing until you turn Analytics on for the project in Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
