import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        active: "bg-[#e7f6ec] text-[#16a34a]",
        paused: "bg-muted text-[var(--gray)]",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
