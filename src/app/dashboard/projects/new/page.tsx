import { redirect } from "next/navigation";
import { emptyProjectValues, ProjectForm } from "@/components/project-form";
import { getViewer } from "@/lib/viewer";
import { createProject } from "../actions";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">New project</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Add the project and your client. You&apos;ll get a link to invite them next.
      </p>
      <ProjectForm
        action={createProject}
        mode="create"
        defaults={emptyProjectValues}
        cancelHref="/dashboard"
      />
    </main>
  );
}
