import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-50 font-sans cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5",
        secondary: "border-2 border-slate-200 text-slate-600 hover:border-brand hover:text-brand bg-white",
        ghost: "text-slate-600 hover:text-brand hover:bg-brand/5",
        outline: "border border-brand/30 bg-brand/5 text-brand hover:bg-brand/10",
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
