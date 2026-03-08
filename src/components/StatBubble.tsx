import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, KeyboardEvent, ReactNode } from "react";

interface StatBubbleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  icon?: ReactNode;
  label?: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
}

const StatBubble = forwardRef<HTMLInputElement, StatBubbleProps>(
  ({ icon, label, unit, value, onChange, className, ...props }, ref) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    };

    return (
      <div className={cn("glass rounded-xl p-3 flex flex-col items-center gap-1.5", className)}>
        {icon && <div className="flex items-center justify-center">{icon}</div>}
        {!icon && label && <span className="text-noto-label text-muted-foreground">{label}</span>}
        <div className="flex items-baseline gap-1">
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-16 bg-transparent text-center text-2xl font-black text-foreground outline-none placeholder:text-muted-foreground/40"
            placeholder="—"
            {...props}
          />
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      </div>
    );
  }
);
StatBubble.displayName = "StatBubble";

export default StatBubble;
