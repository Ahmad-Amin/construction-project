import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
