import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider, { useAuth } from "@/auth/AuthProvider";
import RoleProvider from "@/auth/RoleProvider";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import AppHomePage from "@/pages/AppHomePage";
import WeekPage from "@/pages/WeekPage";
import DashboardPage from "@/pages/DashboardPage";
import CatalogPage from "@/pages/CatalogPage";
import SettingsPage from "@/pages/SettingsPage";
import CoachDashboardPage from "@/pages/CoachDashboardPage";
import CoachAthleteViewPage from "@/pages/CoachAthleteViewPage";
import ProgramPage from "@/pages/ProgramPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <RoleProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<AppHomePage />} />
          <Route path="/week" element={<WeekPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/coach" element={<CoachDashboardPage />} />
          <Route path="/coach/athlete/:athleteId" element={<CoachAthleteViewPage />} />
          <Route path="/program" element={<ProgramPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </RoleProvider>
  );
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
