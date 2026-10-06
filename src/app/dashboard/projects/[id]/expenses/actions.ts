"use server";

import { revalidatePath } from "next/cache";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const GENERIC = "Something went wrong saving this expense. Please try again.";

type ExpenseInput = {
  amount: number;
  date: string;
  category: string;
  note: string;
  receiptPath: string | null;
  clientVisible: boolean;
};

// Our database triggers raise plain-English messages (error code P0001); show those as-is.
const friendly = (error: { code?: string; message: string }) =>
  error.code === "P0001" ? error.message : GENERIC;

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
}

function validate(input: ExpenseInput): string | null {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    return "Please enter the amount as a whole number greater than zero.";
  }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
    return "Please choose a category.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Please choose a valid date.";
  return null;
}

export async function createExpense(
  projectId: string,
  id: string,
  input: ExpenseInput,
): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    id,
    project_id: projectId,
    amount: input.amount,
    expense_date: input.date,
    category: input.category,
    vendor_note: input.note,
    receipt_path: input.receiptPath,
    client_visible: input.clientVisible,
  });

  // The same draft id arriving twice (double tap, retry after a lost reply) is fine.
  if (error && error.code !== "23505") {
    return { error: error.code === "42501" ? "You can't add expenses to this project." : friendly(error) };
  }

  refresh(projectId);
  return {};
}

export async function updateExpense(
  projectId: string,
  id: string,
  input: ExpenseInput,
  replacedReceiptPath: string | null,
): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({
      amount: input.amount,
      expense_date: input.date,
      category: input.category,
      vendor_note: input.note,
      receipt_path: input.receiptPath,
      client_visible: input.clientVisible,
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "You can only edit expenses you added, unless you're the owner." };

  // Tidy up the old receipt file now that nothing points at it.
  if (replacedReceiptPath) {
    await supabase.storage.from("project-media").remove([replacedReceiptPath]);
  }

  refresh(projectId);
  return {};
}

export async function setExpenseVisibility(
  projectId: string,
  id: string,
  visible: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ client_visible: visible })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "Only the company owner can change what the client sees." };

  refresh(projectId);
  return {};
}

export async function deleteExpense(projectId: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("expenses")
    .select("receipt_path")
    .eq("id", id)
    .maybeSingle();

  // RLS only lets the owner delete; a blocked delete returns no row.
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: "We couldn't delete that expense. Please try again." };
  if (!data?.length) return { error: "Only the company owner can delete expenses." };

  if (existing?.receipt_path) {
    await supabase.storage.from("project-media").remove([existing.receipt_path]);
  }

  refresh(projectId);
  return {};
}
