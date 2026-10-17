import { redirect } from "next/navigation";

// Invoices are listed on the Payments page.
export default async function InvoicesIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/projects/${id}/payments#invoices`);
}
