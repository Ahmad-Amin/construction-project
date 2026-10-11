// The wrapper every payment and expense form uses, whether it is a full page or inside the
// slide-over panel: a page keeps the form to a readable column, the panel fills its own width.
export function FormFrame({ sheet, children }: { sheet?: boolean; children: React.ReactNode }) {
  return <div className={sheet ? "flex flex-1 flex-col" : "max-w-3xl"}>{children}</div>;
}

// The `id` is what the panel is labelled by.
export function FormHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 id="sheet-title" className="mb-5 text-xl font-bold tracking-tight">
      {children}
    </h2>
  );
}
