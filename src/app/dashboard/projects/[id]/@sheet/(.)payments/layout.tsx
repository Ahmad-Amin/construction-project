import { Sheet } from "@/components/sheet";

// The panel's frame lives here, so it stays put (and keeps its slide-in) while the form inside
// loads and then replaces the loading state.
export default function PaymentSheetLayout({ children }: { children: React.ReactNode }) {
  return <Sheet>{children}</Sheet>;
}
