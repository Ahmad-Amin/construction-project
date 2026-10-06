import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { CompanyBadge } from "@/components/company-badge";
import { ProjectTabs } from "@/components/project-tabs";
import { StatusBadge } from "@/components/project-bits";
import { formatDate } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";

// Shared header and tabs for every screen of one project.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> All projects
      </Link>

      {project.company && (
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <CompanyBadge name={project.company.name} logoUrl={project.company.logo_url} size="sm" />
          {project.company.name}
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {project.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden /> {project.location}
              </span>
            )}
            {project.start_date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden /> Started {formatDate(project.start_date)}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <ProjectTabs projectId={id} />
      <div className="mt-6">{children}</div>
    </main>
  );
}
