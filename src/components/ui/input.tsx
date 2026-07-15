import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input (shadcn/ui) con tokens de GlucoVida. Radio intermedio (rounded-input,
 * 14px — cómodo para campos de texto, ver docs/BRANDING.md §6), borde celeste,
 * ring primary. Touch target mínimo 44px (min-h-11).
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-11 w-full rounded-input border border-border-strong bg-white px-4 py-2 text-base text-text transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
