import { cn } from "@/lib/utils";
import { CalendarDays, Dumbbell, LayoutDashboard, BookOpen, Settings, Users, ClipboardList, Shield } from "lucide-react";
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
  adminOnly?: boolean;
}

const NAV_ICONS: NavItem[] = [
  { path: "/", key: "today", icon: Dumbbell },
  { path: "/week", key: "week", icon: CalendarDays },
  { path: "/dashboard", key: "stats", icon: LayoutDashboard },
  { path: "/program", key: "program", icon: ClipboardList },
  { path: "/coach", key: "coach", icon: Users, coachOnly: true },
  { path: "/admin", key: "admin", icon: Shield, adminOnly: true },
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
  const { isCoach, isAdmin } = useRoles();

  const visibleItems = NAV_ICONS.filter((item) => {
    if (item.coachOnly && !isCoach) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* ── Desktop sidebar nav ── */}
      <nav className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-20 flex-col items-center gap-2 pt-6 pb-4 border-r border-border bg-background/80 backdrop-blur-xl">
        {visibleItems.map((item) => {
          const active = location.pathname === item.path ||
            (item.path === "/coach" && location.pathname.startsWith("/coach")) ||
            (item.path === "/program" && location.pathname.startsWith("/program"));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 text-xs transition-colors w-full py-3 rounded-xl",
                active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-noto-label text-[10px]">{t(`nav.${item.key}`)}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 flex flex-col lg:ml-20">
        <InvitationBanner />
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">{children}</main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[92%] max-w-md items-center justify-around rounded-2xl glass py-3 px-2">
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
