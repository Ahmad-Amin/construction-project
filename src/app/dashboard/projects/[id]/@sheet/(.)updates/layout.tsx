import { Sheet } from "@/components/sheet";

// The panel's frame lives here, so it stays put while the form inside loads.
export default function UpdateSheetLayout({ children }: { children: React.ReactNode }) {
  return <Sheet>{children}</Sheet>;
}
