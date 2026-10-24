import { LeadDetailView } from "@/components/lead-views";

export default async function LeadSheet({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailView leadId={leadId} sheet />;
}
