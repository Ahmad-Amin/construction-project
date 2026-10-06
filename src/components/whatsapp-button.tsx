import { MessageCircle } from "lucide-react";
import { button } from "@/lib/ui";

// A plain link that opens WhatsApp with the message ready. Server-rendered; no script needed.
export function WhatsAppButton({
  href,
  children,
  variant = "secondary",
  size = "sm",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={button(variant, size)}>
      <MessageCircle className="size-4" aria-hidden /> {children}
    </a>
  );
}
