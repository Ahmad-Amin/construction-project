"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/login/actions";
import { dateOrNull, parseAmount, snapshot, text } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "Something went wrong saving this payment. Please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (formData: FormData, error: string): FormState => ({
  error,
  values: snapshot(formData),
});

// Our database raises plain-English messages (error code P0001); show those as-is.
const friendly = (error: { code?: string; message: string }) =>
  error.code === "P0001" ? error.message : GENERIC;

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
}

type PaymentFields = { amount: number; payment_date: string; reference: string; note: string };

function readPayment(
  formData: FormData,
): { ok: false; error: string } | { ok: true; value: PaymentFields } {
  const amount = parseAmount(text(formData, "amount"), "the amount");
  if (amount.error) return { ok: false, error: amount.error };
  if (!amount.value) return { ok: false, error: "Please enter the amount." };
  const date = dateOrNull(text(formData, "payment_date"));
  if (!date) return { ok: false, error: "Please choose the date of the payment." };
  return {
    ok: true,
    value: {
      amount: amount.value,
      payment_date: date,
      reference: text(formData, "reference"),
      note: text(formData, "note"),
    },
  };
}

// Either the owner or the homeowner can record a payment. The database works out
// which side is recording and leaves it waiting for the other side to confirm.
export async function createPayment(
  projectId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "id");
  if (!UUID.test(id)) return fail(formData, GENERIC);
  const parsed = readPayment(formData);
  if (!parsed.ok) return fail(formData, parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .insert({ id, project_id: projectId, ...parsed.value });

  // The same form arriving twice (double tap, retry after a lost reply) is fine.
  if (error && error.code !== "23505") {
    return fail(
      formData,
      error.code === "42501" ? "You can't record payments on this project." : friendly(error),
    );
  }

  refresh(projectId);
  redirect(`/dashboard/projects/${projectId}/payments`);
}

export async function updatePayment(
  projectId: string,
  paymentId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readPayment(formData);
  if (!parsed.ok) return fail(formData, parsed.error);

  const supabase = await createClient();
  // RLS ignores updates you aren't allowed to make, so check a row came back.
  const { data, error } = await supabase
    .from("payments")
    .update(parsed.value)
    .eq("id", paymentId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return fail(formData, friendly(error));
  if (!data?.length) {
    return fail(formData, "Only the person who recorded this payment can edit it, and not once it's confirmed.");
  }

  refresh(projectId);
  redirect(`/dashboard/projects/${projectId}/payments`);
}

export async function deletePayment(
  projectId: string,
  paymentId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: "We couldn't delete that payment. Please try again." };
  if (!data?.length) {
    return { error: "Only the person who recorded this payment can delete it, and not once it's confirmed." };
  }

  refresh(projectId);
  return {};
}

// The other side confirms a payment, or disputes it with a reason.
export async function respondToPayment(
  projectId: string,
  paymentId: string,
  action: "confirm" | "dispute",
  reason: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_payment", {
    p_payment_id: paymentId,
    p_action: action,
    p_reason: reason,
  });
  if (error) return { error: friendly(error) };

  refresh(projectId);
  return {};
}
