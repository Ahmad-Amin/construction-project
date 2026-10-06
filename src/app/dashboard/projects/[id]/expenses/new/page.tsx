import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { todayInKarachi } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Add expense" };

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Homeowners are read-only; only the company's team can record expenses.
  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id) {
    redirect(`/dashboard/projects/${id}/expenses`);
  }
  const today = todayInKarachi();

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Add expense</h2>
      <ExpenseForm
        projectId={id}
        today={today}
        isOwner={viewer.company.role === "owner"}
        initial={{
          amount: "",
          date: today,
          category: "material",
          note: "",
          clientVisible: false,
          receiptPath: null,
          receiptUrl: null,
        }}
      />
    </div>
  );
}
