import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 font-sans cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-brand to-brand-dark text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(14,124,107,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1),0_8px_20px_rgba(14,124,107,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(14,124,107,0.2)]",
        secondary:
          "border-2 border-slate-200 text-slate-700 hover:border-brand hover:text-brand bg-white hover:-translate-y-0.5 hover:shadow-soft",
        ghost:
          "text-slate-600 hover:text-brand hover:bg-brand/5",
        outline:
          "border border-brand/30 bg-brand/5 text-brand hover:bg-brand/10 hover:border-brand/50",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
