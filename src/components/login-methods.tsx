"use client";

import Link from "next/link";
import { useState } from "react";
import { login, sendMagicLink } from "@/app/login/actions";
import { AuthForm } from "@/components/auth-form";

// Password and "email me a link" as a two-way switch, so the card stays short.
export function LoginMethods() {
  const [mode, setMode] = useState<"password" | "link">("password");

  const tab = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
    }`;

  return (
    <div>
      <div role="group" aria-label="Sign-in method" className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        <button type="button" aria-pressed={mode === "password"} onClick={() => setMode("password")} className={tab(mode === "password")}>
          Password
        </button>
        <button type="button" aria-pressed={mode === "link"} onClick={() => setMode("link")} className={tab(mode === "link")}>
          Email me a link
        </button>
      </div>

      {mode === "password" ? (
        <>
          {/* Separate keys: each option keeps its own errors and typed text, and switching starts clean. */}
          <AuthForm
            key="password"
            action={login}
            submitLabel="Sign in"
            fields={[
              { name: "email", label: "Email", type: "email", autoComplete: "email" },
              { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
            ]}
          />
          <p className="mt-3 text-right text-sm">
            <Link href="/forgot-password" className="font-medium text-muted underline underline-offset-4 hover:text-foreground">
              Forgot your password?
            </Link>
          </p>
        </>
      ) : (
        <>
          <AuthForm
            key="link"
            action={sendMagicLink}
            submitLabel="Email me a sign-in link"
            fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
          />
          <p className="mt-3 text-sm text-muted">No password needed. We&apos;ll email you a link that signs you in.</p>
        </>
      )}
    </div>
  );
}
