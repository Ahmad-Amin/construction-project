import type { NextConfig } from "next";

// Headers that go out on every response. None of them change how the app looks or works; they
// stop other sites from framing it (clickjacking), stop browsers guessing file types, and keep
// links with invite tokens from leaking to other sites. HSTS makes browsers use https only.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // The parts of a content policy that can't break anything: nobody frames us, nobody can point
  // our forms elsewhere or swap our <base>, and no plugins. (Restricting where scripts and
  // images load from needs per-request nonces; add that when there's time to test it thoroughly.)
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
