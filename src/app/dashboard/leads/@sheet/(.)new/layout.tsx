import { Sheet } from "@/components/sheet";

// The panel's frame lives here, so it stays put (and keeps its slide-in) while what is inside loads.
export default function LeadSheetLayout({ children }: { children: React.ReactNode }) {
  return <Sheet>{children}</Sheet>;
}
