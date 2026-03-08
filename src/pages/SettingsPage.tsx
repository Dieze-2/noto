import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Target, LogOut, Download, Upload, Check, Weight,
  Footprints, Flame, X, Lock, ChevronRight, Database, Sun, Moon, Globe,
  Shield, Crown, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

import GlassCard from "@/components/GlassCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import logo from "@/assets/logo.png";
import { getDailyMetricsRange } from "@/db/dailyMetrics";
import { getUserGoals, saveUserGoals } from "@/db/goals";
import { getMyCoachId } from "@/db/coachAthletes";
import { useRoles } from "@/auth/RoleProvider";
import { getMyCoachRequest, submitCoachRequest, CoachRequest } from "@/db/coachRequests";
import { createNotification } from "@/db/notifications";
import { getProfile, displayName } from "@/db/profiles";

/* ── Workouts Export ── */
async function exportWorkoutsCSV() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error(i18n.t("settings.notAuthenticated")); return; }
  // Fetch workouts with exercises and sets via the flat view
  const { data, error } = await supabase
    .from("v_workout_exercises_flat")
    .select("*")
    .eq("user_id", user.id)
    .order("workout_date", { ascending: true });

  if (error) { toast.error(i18n.t("settings.error") + " : " + error.message); return; }
  if (!data?.length) { toast.error(i18n.t("settings.noWorkoutsToExport")); return; }

  const header = "date,exercise_name,load_type,load_g,reps";
  const lines = data.map(
    (r: any) => `${r.workout_date},${r.exercise_name},${r.load_type},${r.load_g ?? ""},${r.reps ?? ""}`
  );
  const csv = [header, ...lines].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `noto-workouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(i18n.t("settings.workoutsExported"));
}

/* ── CSV Export ── */
async function exportDailyMetricsCSV() {
  const rows = await getDailyMetricsRange("2000-01-01", format(new Date(), "yyyy-MM-dd"));
  if (!rows.length) { toast.error(i18n.t("settings.noDataToExport")); return; }
  const header = "date,weight_g,steps,kcal,note";
  const lines = rows.map(
    (r) => `${r.date},${r.weight_g ?? ""},${r.steps ?? ""},${r.kcal ?? ""},"${(r.note ?? "").replace(/"/g, '""')}"`
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `noto-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(i18n.t("settings.exportDownloaded"));
}

/* ── CSV Import ── */
async function importDailyMetricsCSV(file: File) {
  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) { toast.error(i18n.t("settings.csvEmpty")); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error(i18n.t("settings.notAuthenticated")); return; }
  const rows = lines.slice(1).map((line) => {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { parts.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    parts.push(current.trim());
    const [date, weight_g, steps, kcal, note] = parts;
    return {
      user_id: user.id, date,
      weight_g: weight_g ? Number(weight_g) : null,
      steps: steps ? Number(steps) : null,
      kcal: kcal ? Number(kcal) : null,
      note: note || null,
    };
  });
  const { error } = await supabase.from("daily_metrics").upsert(rows, { onConflict: "user_id,date" });
  if (error) { toast.error(i18n.t("settings.importError") + " : " + error.message); return; }
  toast.success(i18n.t("settings.importSuccess", { count: rows.length }));
}

/* ── Drawer wrapper ── */
function SettingsDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button" aria-label="Fermer" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
          />
          <motion.div
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.08}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose(); }}
            initial={{ y: 700 }} animate={{ y: 0 }} exit={{ y: 700 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed left-0 right-0 bottom-0 z-[70]"
          >
            <div className="mx-auto max-w-xl">
              <div className="rounded-t-[2.5rem] border border-border glass shadow-[0_-30px_80px_rgba(0,0,0,0.75)]">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
                  <div className="w-12 h-1.5 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                  <h2 className="text-sm font-black uppercase italic tracking-widest text-muted-foreground">{title}</h2>
                  <button type="button" onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 pb-6 max-h-[75vh] overflow-auto">
                  {children}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Section Component ── */
function SettingsSection({
  icon: Icon,
  title,
  trailing,
  children,
}: {
  icon: React.ElementType;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5 rounded-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-primary" />
        <h2 className="text-noto-label text-foreground flex-1">{title}</h2>
        {trailing}
      </div>
      {children}
    </GlassCard>
  );
}

/* ── Setting row button ── */
function SettingRow({
  icon: Icon,
  label,
  sublabel,
  onClick,
  iconColor = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  onClick: () => void;
  iconColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
    >
      <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center ${iconColor}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black uppercase tracking-wider text-foreground">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground font-bold">{sublabel}</p>}
      </div>
      <ChevronRight size={16} className="text-muted-foreground/40" />
    </button>
  );
}

/* ══════════════════════════════
   MAIN
   ══════════════════════════════ */
export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isCoach, loading: rolesLoading } = useRoles();
  const [loggingOut, setLoggingOut] = useState(false);

  /* Coach request state */
  const [coachRequest, setCoachRequest] = useState<CoachRequest | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  /* Drawers */
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  /* Theme */
  const [dark, setDark] = useState(() => !document.documentElement.classList.contains("light"));
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  /* Goals state */
  const [targetWeight, setTargetWeight] = useState("");
  const [targetSteps, setTargetSteps] = useState("");
  const [targetKcal, setTargetKcal] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  /* Coach name */
  const [coachName, setCoachName] = useState<string | null>(null);

  /* Password state */
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    getUserGoals()
      .then((g) => {
        if (g) {
          setTargetWeight(g.target_weight_g ? (g.target_weight_g / 1000).toString() : "");
          setTargetSteps(g.target_steps?.toString() ?? "");
          setTargetKcal(g.target_kcal?.toString() ?? "");
        }
        setGoalsLoaded(true);
      })
      .catch(() => setGoalsLoaded(true));

    // Fetch coach name
    getMyCoachId().then(async (coachId) => {
      if (!coachId) return;
      const profile = await getProfile(coachId);
      setCoachName(displayName(profile));
    });

    // Fetch coach request status
    if (!isCoach) {
      getMyCoachRequest().then(setCoachRequest);
    }
  }, [isCoach]);

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      await saveUserGoals({
        target_weight_g: targetWeight ? Math.round(parseFloat(targetWeight) * 1000) : null,
        target_steps: targetSteps ? parseInt(targetSteps) : null,
        target_kcal: targetKcal ? parseInt(targetKcal) : null,
      });
      toast.success(t("settings.goalsSaved"));
      setGoalsOpen(false);
    } catch (e: any) {
      toast.error(t("settings.error") + " : " + e.message);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("settings.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordMismatch"));
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("settings.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } catch (e: any) {
      toast.error(t("settings.error") + " : " + e.message);
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) await importDailyMetricsCSV(file);
    };
    input.click();
  };

  const handleCoachRequest = async () => {
    setSubmittingRequest(true);
    try {
      const req = await submitCoachRequest();
      setCoachRequest(req);
      // Notify all admins — we send to a special "admin" notification channel
      // For now, we create a notification that admins can see
      // The admin's user_id needs to be known; we use a generic approach
      // by inserting a notification row with a special admin coach_id
      await createNotification({
        coach_id: user!.id, // stored as reference, admin will query all coach_request notifications
        type: "coach_request",
        athlete_email: user!.email ?? null,
        athlete_id: user!.id,
        request_id: req.id,
      });
      toast.success(t("settings.coachRequestSent"));
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error(t("settings.coachRequestAlreadySent"));
      } else {
        toast.error(e.message);
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  /* Goals summary */
  const goalsSummary = [
    targetWeight && `${targetWeight} kg`,
    targetSteps && `${parseInt(targetSteps).toLocaleString()} ${t("settings.steps")}`,
    targetKcal && `${parseInt(targetKcal).toLocaleString()} ${t("settings.kcal")}`,
  ].filter(Boolean).join(" · ") || t("settings.goalsNotSet");

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
          {t("settings.title")}
        </h1>

        {/* ── PROFIL ── */}
        <SettingsSection icon={User} title={t("settings.profile")} trailing={<img src={logo} alt="NOTO" className="w-8 h-8 object-contain opacity-50 rounded-lg" />}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("settings.email")}</span>
              <span className="text-sm font-bold text-foreground truncate ml-4">{user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("settings.memberSince")}</span>
              <span className="text-sm font-bold text-foreground">
                {user?.created_at ? format(new Date(user.created_at), "dd/MM/yyyy") : "—"}
              </span>
            </div>
            {coachName && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("settings.myCoach")}</span>
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Shield size={12} className="text-primary" />
                  {coachName}
                </span>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* ── ACTION ROWS ── */}
        <div className="space-y-3">
          <SettingRow
            icon={Target}
            label={t("settings.goals")}
            sublabel={goalsLoaded ? goalsSummary : t("settings.loading")}
            onClick={() => setGoalsOpen(true)}
          />
          <SettingRow
            icon={Lock}
            label={t("settings.password")}
            sublabel={t("settings.changePassword")}
            onClick={() => setPasswordOpen(true)}
            iconColor="text-metric-weight"
          />
          <SettingRow
            icon={Database}
            label={t("settings.data")}
            sublabel={t("settings.dataSubtitle")}
            onClick={() => setDataOpen(true)}
            iconColor="text-metric-kcal"
          />

          {/* Theme toggle — inline, no drawer */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-primary">
              {dark ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("settings.theme")}</p>
              <p className="text-[10px] text-muted-foreground font-bold">{dark ? t("settings.darkMode") : t("settings.lightMode")}</p>
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${dark ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <motion.div
                className="w-5 h-5 rounded-full bg-primary-foreground shadow"
                animate={{ x: dark ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </button>
        </div>

        {/* ── LANGUAGE ── */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              const langs = ["fr", "en", "es"] as const;
              const idx = langs.indexOf(i18n.language as any);
              const next = langs[(idx + 1) % langs.length];
              i18n.changeLanguage(next);
              localStorage.setItem("lang", next);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-primary">
              <Globe size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("settings.language")}</p>
              <p className="text-[10px] text-muted-foreground font-bold">
                {i18n.language === "fr" ? t("settings.langFr") : i18n.language === "en" ? t("settings.langEn") : t("settings.langEs")}
              </p>
            </div>
            <div className="flex gap-1">
              {(["fr", "en", "es"] as const).map((l) => (
                <span key={l} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${i18n.language === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {l}
                </span>
              ))}
            </div>
          </button>
        </div>

        {/* ── DEVENIR COACH ── */}
        {!isCoach && !rolesLoading && (
          <div className="space-y-3">
            {coachRequest?.status === "pending" ? (
              <div className="w-full flex items-center gap-3 p-4 rounded-2xl glass text-left">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Crown size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("settings.coachRequestPending")}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">{t("settings.coachRequestPendingDesc")}</p>
                </div>
                <span className="text-[10px] font-bold uppercase text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  {t("coach.pending")}
                </span>
              </div>
            ) : coachRequest?.status === "rejected" ? (
              <div className="w-full flex items-center gap-3 p-4 rounded-2xl glass text-left">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                  <Crown size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("settings.coachRequestRejected")}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">{t("settings.coachRequestRejectedDesc")}</p>
                </div>
                <button
                  onClick={() => setCoachRequest(null)}
                  className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20"
                >
                  {t("settings.dismissRejection")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/pricing")}
                className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Crown size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("settings.becomeCoach")}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">{t("settings.becomeCoachDesc")}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground/40" />
              </button>
            )}
          </div>
        )}

        {/* ── DÉCONNEXION ── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl bg-destructive/10 text-destructive text-sm font-black uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <LogOut size={18} />
          {loggingOut ? t("settings.loggingOut") : t("settings.logout")}
        </button>
      </motion.div>

      {/* ═══ DRAWER OBJECTIFS ═══ */}
      <SettingsDrawer open={goalsOpen} onClose={() => setGoalsOpen(false)} title={t("settings.goals")}>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Weight size={12} className="text-metric-weight" /> {t("settings.targetWeight")}
            </label>
            <input
              type="number" step="0.1" placeholder="Ex: 75.0"
              value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Footprints size={12} className="text-metric-steps" /> {t("settings.targetSteps")}
            </label>
            <input
              type="number" step="100" placeholder="Ex: 10000"
              value={targetSteps} onChange={(e) => setTargetSteps(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Flame size={12} className="text-metric-kcal" /> {t("settings.targetKcal")}
            </label>
            <input
              type="number" step="50" placeholder="Ex: 2200"
              value={targetKcal} onChange={(e) => setTargetKcal(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleSaveGoals}
            disabled={savingGoals || !goalsLoaded}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Check size={16} />
            {savingGoals ? t("settings.saving") : t("settings.register")}
          </button>
        </div>
      </SettingsDrawer>

      {/* ═══ DRAWER MOT DE PASSE ═══ */}
      <SettingsDrawer open={passwordOpen} onClose={() => setPasswordOpen(false)} title={t("settings.password")}>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Lock size={12} /> {t("settings.newPassword")}
            </label>
            <input
              type="password" placeholder={t("settings.minChars")}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Check size={12} /> {t("settings.confirm")}
            </label>
            <input
              type="password" placeholder={t("settings.confirmPlaceholder")}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={changingPw || !newPassword}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Check size={16} />
            {changingPw ? t("settings.changingPassword") : t("settings.changePassword")}
          </button>
        </div>
      </SettingsDrawer>

      {/* ═══ DRAWER DONNÉES ═══ */}
      <SettingsDrawer open={dataOpen} onClose={() => setDataOpen(false)} title={t("settings.data")}>
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              {t("settings.dailyMetrics")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { exportDailyMetricsCSV(); setDataOpen(false); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
              >
                <Download size={16} />
                {t("settings.export")}
              </button>
              <button
                onClick={() => { handleImport(); setDataOpen(false); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-muted-foreground text-xs font-black uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <Upload size={16} />
                {t("settings.import")}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              {t("settings.csvFormat")}
            </p>
          </div>

          <div className="h-px bg-border" />

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              {t("settings.workouts")}
            </p>
            <button
              onClick={() => { exportWorkoutsCSV(); setDataOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
            >
              <Download size={16} />
              {t("settings.exportWorkouts")}
            </button>
            <p className="text-[9px] text-muted-foreground mt-1">
              {t("settings.csvWorkoutFormat")}
            </p>
          </div>
        </div>
      </SettingsDrawer>
    </div>
  );
}
