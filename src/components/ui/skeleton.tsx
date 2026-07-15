import { cn } from "@/lib/utils";

/**
 * Skeleton (shadcn/ui) con tokens de GlucoVida. Pulso en celeste aire
 * (bg-primary-air), nunca gris genérico. Loading que acompaña, no que alarma.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-card bg-primary-air", className)}
      {...props}
    />
  );
}

export { Skeleton };
