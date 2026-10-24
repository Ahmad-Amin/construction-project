// The leads board, with a slide-over panel for adding a lead and for a lead's details (see the @sheet folder).
export default function LeadsLayout({ children, sheet }: { children: React.ReactNode; sheet: React.ReactNode }) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
