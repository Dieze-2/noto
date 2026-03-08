import { cn } from "@/lib/utils";
import { CalendarDays, Dumbbell, LayoutDashboard, BookOpen, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { ReactNode } from "react";

const NAV_ITEMS = [
  { path: "/", label: "Today", icon: Dumbbell },
  { path: "/week", label: "Week", icon: CalendarDays },
  { path: "/dashboard", label: "Stats", icon: LayoutDashboard },
  { path: "/catalog", label: "Exos", icon: BookOpen },
  { path: "/settings", label: "Réglages", icon: Settings },
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[92%] max-w-md items-center justify-around rounded-2xl glass py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-noto-label text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
