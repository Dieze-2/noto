import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "button";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, as = "div", children, ...props }, ref) => {
    const Comp = as as any;
    return (
      <Comp
        ref={ref}
        className={cn("glass rounded-lg p-4", className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
GlassCard.displayName = "GlassCard";

export default GlassCard;
