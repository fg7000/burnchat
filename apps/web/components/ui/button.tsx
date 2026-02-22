import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "accent-gradient-bg text-[#0a0a0b] shadow hover:opacity-90",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outline:
          "bg-transparent shadow-sm hover:opacity-80",
        secondary:
          "shadow-sm hover:opacity-80",
        ghost:
          "hover:opacity-80",
        link: "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
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
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const baseStyle: React.CSSProperties = {
      borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-primary)",
      transition: "all 0.25s ease",
      ...style,
    };

    if (variant === "outline") {
      baseStyle.border = "1px solid var(--border)";
      baseStyle.color = "var(--text-secondary)";
    } else if (variant === "secondary") {
      baseStyle.background = "var(--surface)";
      baseStyle.border = "1px solid var(--border)";
      baseStyle.color = "var(--text-secondary)";
    } else if (variant === "ghost") {
      baseStyle.color = "var(--text-secondary)";
    } else if (variant === "link") {
      baseStyle.color = "var(--text-secondary)";
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={baseStyle}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
