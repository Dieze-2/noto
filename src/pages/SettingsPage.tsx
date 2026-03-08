import { useState } from "react";
import { motion } from "framer-motion";
import { User, Target, LogOut, Download, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { getDailyMetricsRange } from "@/db/dailyMetrics";

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
          <p className="text-xs text-muted-foreground leading-relaxed">
            Les objectifs personnalisés arrivent bientôt ! Tu pourras définir ton poids cible, tes pas quotidiens et tes calories.
          </p>
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
