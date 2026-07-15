import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button (shadcn/ui) con tokens de GlucoVida (ver docs/BRANDING.md).
 * El variant `primary` sale con gradiente celeste (bg-gradient-primary) y radio
 * de pill (rounded-pill), como pide el branding. Touch target mínimo 44px.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-bold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-primary-foreground hover:shadow-btn-hover",
        soft: "bg-primary-air text-primary-strong hover:bg-primary-soft",
        outline: "border border-border bg-white text-text hover:bg-primary-air",
        ghost: "text-muted hover:bg-primary-air hover:text-text",
      },
      size: {
        default: "min-h-11 px-6 py-3 text-base",
        sm: "min-h-11 px-4 py-2 text-sm",
        lg: "min-h-12 px-8 py-4 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
