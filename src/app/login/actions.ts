"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// `values` echoes submitted fields back so a failed save doesn't wipe the form
// (React resets uncontrolled inputs when a form action finishes).
export type FormState = {
  error?: string;
  message?: string;
  values?: Record<string, string>;
};

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email");
  const password = text(formData, "password");
  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "That email or password isn't right. Please try again." };
  }
  redirect("/dashboard");
}

export async function sendMagicLink(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, "email");
  if (!email) return { error: "Please enter your email." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Homeowners are invited by their contractor, never self-registered here.
      shouldCreateUser: false,
    },
  });
  if (error) {
    // Too many emails in a short time is a different problem from a wrong address.
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      return { error: "Too many sign-in emails were requested. Please wait a few minutes and try again, or sign in with your password." };
    }
    return {
      error:
        "We couldn't send a sign-in link to that email. Check the address, or ask your contractor to invite you.",
    };
  }
  return { message: "Check your email — we've sent you a sign-in link." };
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name");
  const email = text(formData, "email");
  const password = text(formData, "password");
  if (!name || !email || !password) {
    return { error: "Please fill in all the fields." };
  }
  if (password.length < 8) {
    return { error: "Your password needs at least 8 characters." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return { error: "We couldn't create your account. Try a different email or password." };
  }

  // With email confirmation on, there is no session yet.
  if (!data.session) {
    return { message: "Almost there — check your email to confirm your account." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
