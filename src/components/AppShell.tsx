import { cn } from "@/lib/utils";
import { CalendarDays, Dumbbell, LayoutDashboard, BookOpen, Settings, Users, ClipboardList } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRoles } from "@/auth/RoleProvider";
import InvitationBanner from "@/components/InvitationBanner";

interface NavItem {
  path: string;
  key: string;
  icon: React.ElementType;
  coachOnly?: boolean;
}

const NAV_ICONS: NavItem[] = [
  { path: "/", key: "today", icon: Dumbbell },
  { path: "/week", key: "week", icon: CalendarDays },
  { path: "/dashboard", key: "stats", icon: LayoutDashboard },
  { path: "/program", key: "program", icon: ClipboardList },
  { path: "/coach", key: "coach", icon: Users, coachOnly: true },
  { path: "/catalog", key: "exercises", icon: BookOpen },
  { path: "/settings", key: "settings", icon: Settings },
];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isCoach } = useRoles();

  const visibleItems = NAV_ICONS.filter((item) => !item.coachOnly || isCoach);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <InvitationBanner />
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[92%] max-w-md items-center justify-around rounded-2xl glass py-3 px-2">
        {visibleItems.map((item) => {
          const active = location.pathname === item.path ||
            (item.path === "/coach" && location.pathname.startsWith("/coach")) ||
            (item.path === "/program" && location.pathname.startsWith("/program"));
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
              <span className="text-noto-label text-[10px]">{t(`nav.${item.key}`)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
