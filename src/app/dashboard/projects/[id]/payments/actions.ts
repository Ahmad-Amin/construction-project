"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/login/actions";
import { dateOrNull, parseAmount, snapshot, text } from "@/lib/forms";
import { queueNotificationDelivery } from "@/lib/notifications";
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
  // The side navigation shows how many payments are waiting for you.
  revalidatePath("/dashboard", "layout");
}

type PaymentFields = {
  amount: number;
  payment_date: string;
  reference: string;
  note: string;
  receipt_path: string | null;
};

function readPayment(
  formData: FormData,
  folder: string,
): { ok: false; error: string } | { ok: true; value: PaymentFields } {
  const amount = parseAmount(text(formData, "amount"), "the amount");
  if (amount.error) return { ok: false, error: amount.error };
  if (!amount.value) return { ok: false, error: "Please enter the amount." };
  const date = dateOrNull(text(formData, "payment_date"));
  if (!date) return { ok: false, error: "Please choose the date of the payment." };
  // The receipt photo is uploaded straight to storage by the form; here we only accept a file
  // that sits in this payment's own folder.
  const receipt = text(formData, "receipt_path");
  if (receipt && !receipt.startsWith(folder)) {
    return { ok: false, error: "The receipt didn't upload properly. Please attach it again." };
  }
  return {
    ok: true,
    value: {
      amount: amount.value,
      payment_date: date,
      reference: text(formData, "reference"),
      note: text(formData, "note"),
      receipt_path: receipt || null,
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
  const parsed = readPayment(formData, `${projectId}/payments/${id}/`);
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
  queueNotificationDelivery();
  redirect(`/dashboard/projects/${projectId}/payments`);
}

export async function updatePayment(
  projectId: string,
  paymentId: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = readPayment(formData, `${projectId}/payments/${paymentId}/`);
  if (!parsed.ok) return fail(formData, parsed.error);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("payments")
    .select("receipt_path")
    .eq("id", paymentId)
    .eq("project_id", projectId)
    .maybeSingle();
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

  // A replaced or removed receipt photo is tidied away.
  if (before?.receipt_path && before.receipt_path !== parsed.value.receipt_path) {
    await supabase.storage.from("project-media").remove([before.receipt_path]);
  }

  refresh(projectId);
  redirect(`/dashboard/projects/${projectId}/payments`);
}

export async function deletePayment(
  projectId: string,
  paymentId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("payments")
    .select("receipt_path")
    .eq("id", paymentId)
    .eq("project_id", projectId)
    .maybeSingle();
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
  if (existing?.receipt_path) {
    await supabase.storage.from("project-media").remove([existing.receipt_path]);
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
  queueNotificationDelivery();
  return {};
}

export type ReminderResult = {
  ok: boolean;
  // What the button should tell the contractor.
  message: string;
  // True when WhatsApp itself could not be used and the contractor may want to send it by hand.
  offerManual?: boolean;
};

// The contractor reminds the homeowner to confirm a payment: a bell notification and email always
// (when the homeowner has them on), and a WhatsApp message when the homeowner switched it on.
export async function sendPaymentReminder(projectId: string, paymentId: string): Promise<ReminderResult> {
  if (!UUID.test(projectId) || !UUID.test(paymentId)) return { ok: false, message: GENERIC };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_payment_reminder", { p_payment: paymentId });
  if (error) return { ok: false, message: friendly(error) };

  const r = data as {
    result: "sent" | "too_soon" | "not_joined";
    client?: string;
    minutes?: number;
    whatsapp?: boolean;
    email?: boolean;
    whatsapp_reason?: "no_phone" | "not_opted_in" | "unavailable" | null;
  };
  const name = r.client?.trim().split(/\s+/)[0] || "Your client";

  if (r.result === "not_joined") {
    return { ok: false, message: `${name} hasn't joined yet. Send them their invite link first.` };
  }
  if (r.result === "too_soon") {
    const hours = Math.floor((r.minutes ?? 0) / 60);
    const wait = hours >= 1 ? `${hours} h` : `${r.minutes} min`;
    return { ok: false, message: `${name} was reminded recently. You can remind them again in about ${wait}.` };
  }

  refresh(projectId);
  queueNotificationDelivery();

  if (r.whatsapp) {
    return { ok: true, message: `Reminder sent to ${name} on WhatsApp${r.email ? " and by email" : ""}.` };
  }
  const why =
    r.whatsapp_reason === "no_phone"
      ? `there's no phone number saved for ${name}`
      : r.whatsapp_reason === "not_opted_in"
        ? `${name} hasn't switched on WhatsApp updates`
        : "WhatsApp isn't available right now";
  return {
    ok: true,
    offerManual: true,
    message: `Reminder sent to ${name} in the app${r.email ? " and by email" : ""}, but not on WhatsApp because ${why}.`,
  };
}
