import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Target, LogOut, Download, Upload, Check, Weight, Footprints, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { getDailyMetricsRange } from "@/db/dailyMetrics";
import { getUserGoals, saveUserGoals } from "@/db/goals";

/* ── CSV Export ── */
async function exportDailyMetricsCSV() {
  const rows = await getDailyMetricsRange("2000-01-01", format(new Date(), "yyyy-MM-dd"));
  if (!rows.length) {
    toast.error("Aucune donnée à exporter");
    return;
  }

  const header = "date,weight_g,steps,kcal,note";
  const lines = rows.map(
    (r) =>
      `${r.date},${r.weight_g ?? ""},${r.steps ?? ""},${r.kcal ?? ""},"${(r.note ?? "").replace(/"/g, '""')}"`
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
  if (lines.length < 2) {
    toast.error("Fichier CSV vide ou invalide");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    toast.error("Non authentifié");
    return;
  }

  const rows = lines.slice(1).map((line) => {
    // Simple CSV parse (handles quoted fields)
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
      user_id: user.id,
      date,
      weight_g: weight_g ? Number(weight_g) : null,
      steps: steps ? Number(steps) : null,
      kcal: kcal ? Number(kcal) : null,
      note: note || null,
    };
  });

  const { error } = await supabase
    .from("daily_metrics")
    .upsert(rows, { onConflict: "user_id,date" });

  if (error) {
    toast.error("Erreur d'import : " + error.message);
    return;
  }

  toast.success(`${rows.length} lignes importées !`);
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

/* ── Main ── */
export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  /* Goals state */
  const [targetWeight, setTargetWeight] = useState("");
  const [targetSteps, setTargetSteps] = useState("");
  const [targetKcal, setTargetKcal] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsLoaded, setGoalsLoaded] = useState(false);

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
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setSavingGoals(false);
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <span className="text-sm font-bold text-foreground truncate ml-4">
                {user?.email ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Membre depuis
              </span>
              <span className="text-sm font-bold text-foreground">
                {user?.created_at
                  ? format(new Date(user.created_at), "dd/MM/yyyy")
                  : "—"}
              </span>
            </div>
          </div>
        </SettingsSection>

        {/* ── OBJECTIFS ── */}
        <SettingsSection icon={Target} title="Objectifs">
          <div className="space-y-4">
            {/* Poids cible */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                <Weight size={12} className="text-metric-weight" />
                Poids cible (kg)
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 75.0"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Pas quotidiens */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                <Footprints size={12} className="text-metric-steps" />
                Pas quotidiens
              </label>
              <input
                type="number"
                step="100"
                placeholder="Ex: 10000"
                value={targetSteps}
                onChange={(e) => setTargetSteps(e.target.value)}
                className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Calories */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                <Flame size={12} className="text-metric-kcal" />
                Calories quotidiennes
              </label>
              <input
                type="number"
                step="50"
                placeholder="Ex: 2200"
                value={targetKcal}
                onChange={(e) => setTargetKcal(e.target.value)}
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
        </SettingsSection>

        {/* ── IMPORT / EXPORT ── */}
        <SettingsSection icon={Download} title="Données">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={exportDailyMetricsCSV}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button
              onClick={handleImport}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-muted-foreground text-xs font-black uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <Upload size={16} />
              Importer
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Format CSV : date, weight_g, steps, kcal, note
          </p>
        </SettingsSection>

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
    </div>
  );
}
