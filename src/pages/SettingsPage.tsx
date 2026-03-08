import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Target, LogOut, Download, Upload, Check, Weight,
  Footprints, Flame, X, Lock, ChevronRight, Database, Sun, Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import logo from "@/assets/logo.png";
import { getDailyMetricsRange } from "@/db/dailyMetrics";
import { getUserGoals, saveUserGoals } from "@/db/goals";

/* ── Workouts Export ── */
async function exportWorkoutsCSV() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error("Non authentifié"); return; }

  // Fetch workouts with exercises and sets via the flat view
  const { data, error } = await supabase
    .from("v_workout_exercises_flat")
    .select("*")
    .eq("user_id", user.id)
    .order("workout_date", { ascending: true });

  if (error) { toast.error("Erreur : " + error.message); return; }
  if (!data?.length) { toast.error("Aucune séance à exporter"); return; }

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
  toast.success("Export séances téléchargé !");
}

/* ── CSV Export ── */
async function exportDailyMetricsCSV() {
  const rows = await getDailyMetricsRange("2000-01-01", format(new Date(), "yyyy-MM-dd"));
  if (!rows.length) { toast.error("Aucune donnée à exporter"); return; }
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
  toast.success("Export téléchargé !");
}

/* ── CSV Import ── */
async function importDailyMetricsCSV(file: File) {
  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) { toast.error("Fichier CSV vide ou invalide"); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error("Non authentifié"); return; }
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
  if (error) { toast.error("Erreur d'import : " + error.message); return; }
  toast.success(`${rows.length} lignes importées !`);
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
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5 rounded-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-primary" />
        <h2 className="text-noto-label text-foreground">{title}</h2>
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
  const [loggingOut, setLoggingOut] = useState(false);

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
  }, []);

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      await saveUserGoals({
        target_weight_g: targetWeight ? Math.round(parseFloat(targetWeight) * 1000) : null,
        target_steps: targetSteps ? parseInt(targetSteps) : null,
        target_kcal: targetKcal ? parseInt(targetKcal) : null,
      });
      toast.success("Objectifs sauvegardés !");
      setGoalsOpen(false);
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setSavingGoals(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Mot de passe modifié !");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
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

  /* Goals summary */
  const goalsSummary = [
    targetWeight && `${targetWeight} kg`,
    targetSteps && `${parseInt(targetSteps).toLocaleString()} pas`,
    targetKcal && `${parseInt(targetKcal).toLocaleString()} kcal`,
  ].filter(Boolean).join(" · ") || "Non définis";

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
          Paramètres
        </h1>

        {/* ── PROFIL ── */}
        <SettingsSection icon={User} title="Profil">
          <div className="relative space-y-3">
            <img src={logo} alt="NOTO" className="absolute top-0 right-0 w-10 h-10 object-contain opacity-60" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</span>
              <span className="text-sm font-bold text-foreground truncate ml-4">{user?.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Membre depuis</span>
              <span className="text-sm font-bold text-foreground">
                {user?.created_at ? format(new Date(user.created_at), "dd/MM/yyyy") : "—"}
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* ── ACTION ROWS ── */}
        <div className="space-y-3">
          <SettingRow
            icon={Target}
            label="Objectifs"
            sublabel={goalsLoaded ? goalsSummary : "Chargement…"}
            onClick={() => setGoalsOpen(true)}
          />
          <SettingRow
            icon={Lock}
            label="Mot de passe"
            sublabel="Changer le mot de passe"
            onClick={() => setPasswordOpen(true)}
            iconColor="text-metric-weight"
          />
          <SettingRow
            icon={Database}
            label="Données"
            sublabel="Importer ou exporter en CSV"
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
              <p className="text-sm font-black uppercase tracking-wider text-foreground">Thème</p>
              <p className="text-[10px] text-muted-foreground font-bold">{dark ? "Mode sombre" : "Mode clair"}</p>
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

        {/* ── DÉCONNEXION ── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl bg-destructive/10 text-destructive text-sm font-black uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          <LogOut size={18} />
          {loggingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </motion.div>

      {/* ═══ DRAWER OBJECTIFS ═══ */}
      <SettingsDrawer open={goalsOpen} onClose={() => setGoalsOpen(false)} title="Objectifs">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Weight size={12} className="text-metric-weight" /> Poids cible (kg)
            </label>
            <input
              type="number" step="0.1" placeholder="Ex: 75.0"
              value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Footprints size={12} className="text-metric-steps" /> Pas quotidiens
            </label>
            <input
              type="number" step="100" placeholder="Ex: 10000"
              value={targetSteps} onChange={(e) => setTargetSteps(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Flame size={12} className="text-metric-kcal" /> Calories quotidiennes
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
            {savingGoals ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </SettingsDrawer>

      {/* ═══ DRAWER MOT DE PASSE ═══ */}
      <SettingsDrawer open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Mot de passe">
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Lock size={12} /> Nouveau mot de passe
            </label>
            <input
              type="password" placeholder="6 caractères minimum"
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              <Check size={12} /> Confirmer
            </label>
            <input
              type="password" placeholder="Confirmer le mot de passe"
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
            {changingPw ? "Modification…" : "Changer le mot de passe"}
          </button>
        </div>
      </SettingsDrawer>

      {/* ═══ DRAWER DONNÉES ═══ */}
      <SettingsDrawer open={dataOpen} onClose={() => setDataOpen(false)} title="Données">
        <div className="space-y-5">
          {/* Métriques */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              Métriques quotidiennes
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { exportDailyMetricsCSV(); setDataOpen(false); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
              >
                <Download size={16} />
                Exporter
              </button>
              <button
                onClick={() => { handleImport(); setDataOpen(false); }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-muted-foreground text-xs font-black uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <Upload size={16} />
                Importer
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              CSV : date, weight_g, steps, kcal, note
            </p>
          </div>

          <div className="h-px bg-border" />

          {/* Séances */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
              Séances d'entraînement
            </p>
            <button
              onClick={() => { exportWorkoutsCSV(); setDataOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
            >
              <Download size={16} />
              Exporter les séances
            </button>
            <p className="text-[9px] text-muted-foreground mt-1">
              CSV : date, exercise_name, load_type, load_g, reps
            </p>
          </div>
        </div>
      </SettingsDrawer>
    </div>
  );
}
