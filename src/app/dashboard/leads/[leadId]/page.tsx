import { LeadDetailView } from "@/components/lead-views";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailView leadId={leadId} />;
}
