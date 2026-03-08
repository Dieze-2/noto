import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatBubbleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  icon?: ReactNode | LucideIcon;
  label?: string;
  unit?: string;
  value: string;
  colorClass?: string;
  accent?: boolean;
  onChange: (value: string) => void;
}

const StatBubble = forwardRef<HTMLInputElement, StatBubbleProps>(
  ({ icon, label, unit, value, colorClass, accent, onChange, className, ...props }, ref) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    };

    // Support both ReactNode and LucideIcon component
    const renderIcon = () => {
      if (!icon) return null;
      // Check if it's a component (function or forwardRef object) vs a ReactNode
      if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "$$typeof" in icon && "render" in (icon as any))) {
        const IconComp = icon as LucideIcon;
        return <IconComp size={20} className={cn(accent ? "text-primary" : colorClass || "text-muted-foreground")} />;
      }
      return icon;
    };

    return (
      <div className={cn("glass rounded-xl p-3 flex flex-col items-center gap-1.5", className)}>
        {renderIcon()}
        {!icon && label && <span className="text-noto-label text-muted-foreground">{label}</span>}
        <div className="flex items-baseline gap-1">
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-20 bg-transparent text-center text-2xl font-black text-foreground outline-none placeholder:text-muted-foreground/40"
            placeholder="—"
            {...props}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {icon && label && <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>}
      </div>
    );
  }
);
StatBubble.displayName = "StatBubble";

export default StatBubble;
