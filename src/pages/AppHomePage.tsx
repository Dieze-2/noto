import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion } from "framer-motion";
import StatBubble from "@/components/StatBubble";
import GlassCard from "@/components/GlassCard";
import { getDailyMetricsByDate, saveDailyMetrics } from "@/db/dailyMetrics";
import { useAuth } from "@/auth/AuthProvider";
import { Loader2 } from "lucide-react";

export default function AppHomePage() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const displayDate = format(new Date(), "EEEE d MMMM", { locale: fr });

  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load today's metrics
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getDailyMetricsByDate(today).then((m) => {
      if (m) {
        setWeight(m.weight_g != null ? (m.weight_g / 1000).toString() : "");
        setSteps(m.steps != null ? m.steps.toString() : "");
        setKcal(m.kcal != null ? m.kcal.toString() : "");
        setNote(m.note ?? "");
      }
      setLoading(false);
    });
  }, [user, today]);

  // Auto-save on blur
  const save = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    const weightKg = parseFloat(weight);
    const weightG = !isNaN(weightKg) ? Math.round(weightKg * 1000) : null;
    const stepsNum = parseInt(steps);
    const kcalNum = parseInt(kcal);

    await saveDailyMetrics({
      date: today,
      weight_g: weightG,
      steps: !isNaN(stepsNum) ? stepsNum : null,
      kcal: !isNaN(kcalNum) ? kcalNum : null,
      note: note.trim() || null,
    });
    setSaving(false);
  }, [user, today, weight, steps, kcal, note, saving]);

  if (loading) {
    return (
      <div className="flex h-[60dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-noto-title text-3xl text-primary">Today</h1>
        <p className="text-sm capitalize text-muted-foreground">{displayDate}</p>
      </motion.div>

      {/* Metrics grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3 mb-4"
      >
        <StatBubble
          label="Poids"
          unit="kg"
          value={weight}
          onChange={setWeight}
          onBlur={save}
        />
        <StatBubble
          label="Steps"
          value={steps}
          onChange={setSteps}
          onBlur={save}
        />
        <StatBubble
          label="Kcal"
          value={kcal}
          onChange={setKcal}
          onBlur={save}
        />
      </motion.div>

      {/* Note */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassCard>
          <label className="text-noto-label text-muted-foreground mb-2 block">Note</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={save}
            rows={3}
            placeholder="Comment s'est passée ta journée ?"
            className="w-full bg-transparent text-foreground outline-none resize-none placeholder:text-muted-foreground/40"
          />
        </GlassCard>
      </motion.div>

      {/* Save indicator */}
      {saving && (
        <p className="mt-3 text-center text-xs text-muted-foreground animate-pulse">
          Enregistrement…
        </p>
      )}
    </div>
  );
}
