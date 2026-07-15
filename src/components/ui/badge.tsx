import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Badge (shadcn/ui) con tokens de GlucoVida. Pill siempre. */
const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-3 py-0.5 text-xs font-bold transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        soft: "bg-primary-air text-primary-strong",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        danger: "bg-danger/15 text-danger",
        outline: "border border-border text-text",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
