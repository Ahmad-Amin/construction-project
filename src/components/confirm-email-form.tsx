"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmail } from "@/app/auth/confirm/actions";
import { button } from "@/lib/ui";

// One button that uses the link's one-time token (see confirmEmail for why it isn't used on opening the page).
export function ConfirmEmailForm({ tokenHash, type }: { tokenHash: string; type: string }) {
  const [state, action, pending] = useActionState(confirmEmail, {});

  if (state.error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
        <Link href="/login" className={`${button("primary")} w-full`}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <button type="submit" disabled={pending} className={`${button("primary")} w-full`}>
        {pending ? "Confirming…" : "Confirm my email"}
      </button>
    </form>
  );
}
