import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Weight, Footprints, Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabaseClient";

interface DailyMetric {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
}

export default function CoachAthleteViewPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [athleteEmail, setAthleteEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!athleteId) return;

    // Get athlete email from coach_athletes
    supabase
      .from("coach_athletes")
      .select("invite_email")
      .eq("athlete_id", athleteId)
      .eq("status", "accepted")
      .single()
      .then(({ data }) => {
        if (data) setAthleteEmail(data.invite_email);
      });

    // Get last 30 days of metrics
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("daily_metrics")
      .select("date, weight_g, steps, kcal")
      .eq("user_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setMetrics(data);
        setLoading(false);
      });
  }, [athleteId]);

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="p-2 rounded-xl glass hover:bg-muted/50">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-noto-title text-xl text-primary">{athleteEmail ?? t("coach.athlete")}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              {t("coach.last30Days")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t("coach.noData")}</p>
        ) : (
          <div className="space-y-2">
            {metrics.map((m) => (
              <GlassCard key={m.date} className="p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  {format(new Date(m.date), "dd/MM/yyyy")}
                </p>
                <div className="flex items-center gap-4">
                  {m.weight_g != null && (
                    <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <Weight size={12} className="text-metric-weight" />
                      {(m.weight_g / 1000).toFixed(1)} kg
                    </div>
                  )}
                  {m.steps != null && (
                    <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <Footprints size={12} className="text-metric-steps" />
                      {m.steps.toLocaleString()}
                    </div>
                  )}
                  {m.kcal != null && (
                    <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <Flame size={12} className="text-metric-kcal" />
                      {m.kcal.toLocaleString()}
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
