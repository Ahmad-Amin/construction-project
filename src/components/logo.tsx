import Image from "next/image";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/site";

// The BuildPeek logo. Each version comes in a light-page and a dark-page colouring; the page's
// theme decides which one shows (see .brand-light / .brand-dark in globals.css).
//   horizontal: the house mark with the name beside it (headers)
//   mark:       just the house (the folded sidebar)
//   vertical:   the mark with the name below it (the footer)
const files = {
  horizontal: { src: "buildpeek-horizontal", width: 772, height: 210 },
  mark: { src: "buildpeek-mark", width: 274, height: 245 },
  vertical: { src: "buildpeek-vertical", width: 598, height: 378 },
} as const;

type Variant = keyof typeof files;

export function BrandImage({
  variant,
  className = "",
  priority = false,
}: {
  variant: Variant;
  // The size, as a height class such as "h-8". The width follows the picture's shape.
  className?: string;
  priority?: boolean;
}) {
  const f = files[variant];
  return (
    <>
      <Image
        src={`/brand/${f.src}.png`}
        alt={PRODUCT_NAME}
        width={f.width}
        height={f.height}
        priority={priority}
        className={`brand-light w-auto ${className}`}
      />
      <Image
        src={`/brand/${f.src}-dark.png`}
        alt={PRODUCT_NAME}
        width={f.width}
        height={f.height}
        priority={priority}
        className={`brand-dark w-auto ${className}`}
      />
    </>
  );
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center whitespace-nowrap" aria-label={PRODUCT_NAME}>
      {compact ? <BrandImage variant="mark" className="h-9" priority /> : <BrandImage variant="horizontal" className="h-9 sm:h-10" priority />}
    </Link>
  );
}
