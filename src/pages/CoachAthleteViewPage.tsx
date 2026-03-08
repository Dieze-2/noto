import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Weight, Footprints, Flame,
  TrendingUp, TrendingDown, Minus, Dumbbell,
  ClipboardList, Plus, ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, subDays } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabaseClient";
import { getProfile, displayName, Profile } from "@/db/profiles";
import { getCoachPrograms, Program } from "@/db/programs";
import ProgramEditor from "@/components/ProgramEditor";
import { createProgram, deleteProgram } from "@/db/programs";
import { toast } from "sonner";

interface DailyMetric {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
}

interface WorkoutSummary {
  date: string;
  exercise_count: number;
}

type Tab = "overview" | "programs";

export default function CoachAthleteViewPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [workoutDays, setWorkoutDays] = useState<WorkoutSummary[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  /* program editor */
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    if (!athleteId) return;

    const [prof, allPrograms] = await Promise.all([
      getProfile(athleteId),
      getCoachPrograms(),
    ]);

    setProfile(prof);
    setPrograms(allPrograms.filter((p) => p.athlete_id === athleteId));

    // Get last 30 days of metrics
    const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const to = format(new Date(), "yyyy-MM-dd");
    const { data: metricsData } = await supabase
      .from("daily_metrics")
      .select("date, weight_g, steps, kcal")
      .eq("user_id", athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    setMetrics(metricsData ?? []);

    // Get workout frequency (last 30 days)
    const { data: workouts } = await supabase
      .from("workouts")
      .select("date")
      .eq("user_id", athleteId)
      .gte("date", from)
      .lte("date", to);

    if (workouts) {
      // Count exercises per workout day
      const days = workouts.map((w) => ({ date: w.date, exercise_count: 1 }));
      setWorkoutDays(days);
    }

    setLoading(false);
  };

  useEffect(() => { refresh(); }, [athleteId]);

  /* ── Computed stats ── */
  const stats = useMemo(() => {
    const weights = metrics.filter((m) => m.weight_g != null).map((m) => m.weight_g! / 1000);
    const stepsList = metrics.filter((m) => m.steps != null).map((m) => m.steps!);
    const kcalList = metrics.filter((m) => m.kcal != null).map((m) => m.kcal!);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const latest = (arr: number[]) => arr.length > 0 ? arr[0] : null;
    const trend = (arr: number[]) => {
      if (arr.length < 2) return 0;
      return arr[0] - arr[arr.length - 1];
    };

    return {
      currentWeight: latest(weights),
      weightTrend: trend(weights),
      avgSteps: avg(stepsList),
      avgKcal: avg(kcalList),
      workoutCount: workoutDays.length,
      daysTracked: metrics.length,
    };
  }, [metrics, workoutDays]);

  const athleteName = displayName(profile);

  const handleCreate = async () => {
    if (!newTitle.trim() || !athleteId) return;
    setCreating(true);
    try {
      const p = await createProgram(athleteId, newTitle.trim());
      setNewTitle("");
      await refresh();
      setEditingProgram(p);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProgram(id);
      setEditingProgram(null);
      toast.success(t("program.deleted"));
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  /* ── Program editor view ── */
  if (editingProgram) {
    return (
      <div className="mx-auto max-w-md px-4 pt-6 pb-32">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setEditingProgram(null); refresh(); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} /> {t("program.backToList")}
            </button>
            <button
              onClick={() => handleDelete(editingProgram.id)}
              className="text-xs font-black uppercase tracking-wider text-destructive/60 hover:text-destructive"
            >
              {t("program.deleteProgram")}
            </button>
          </div>
          <ProgramEditor program={editingProgram} onBack={() => { setEditingProgram(null); refresh(); }} />
        </motion.div>
      </div>
    );
  }

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0.3) return <TrendingUp size={14} className="text-primary" />;
    if (value < -0.3) return <TrendingDown size={14} className="text-destructive" />;
    return <Minus size={14} className="text-muted-foreground" />;
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="p-2 rounded-xl glass hover:bg-muted/50">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-noto-title text-xl text-primary">{athleteName}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              {t("coach.last30Days")}
            </p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex glass rounded-xl p-1">
          {(["overview", "programs"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" ? t("coach.overview") : t("coach.programs")}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-2 gap-3">
              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Weight size={16} className="text-metric-weight" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("dashboard.weight")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">
                    {stats.currentWeight != null ? stats.currentWeight.toFixed(1) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">kg</span>
                  {stats.currentWeight != null && <TrendIcon value={stats.weightTrend} />}
                </div>
                {stats.weightTrend !== 0 && stats.currentWeight != null && (
                  <p className="text-[10px] text-muted-foreground">
                    {stats.weightTrend > 0 ? "+" : ""}{stats.weightTrend.toFixed(1)} kg
                  </p>
                )}
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("coach.workouts")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{stats.workoutCount}</span>
                  <span className="text-xs text-muted-foreground">{t("dashboard.sessions")}</span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Footprints size={16} className="text-metric-steps" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("coach.avgSteps")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">
                    {stats.avgSteps != null ? Math.round(stats.avgSteps).toLocaleString() : "—"}
                  </span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-metric-kcal" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t("coach.avgKcal")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">
                    {stats.avgKcal != null ? Math.round(stats.avgKcal).toLocaleString() : "—"}
                  </span>
                </div>
              </GlassCard>
            </div>

            {/* ── Recent metrics ── */}
            <GlassCard className="p-5 rounded-3xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                {t("coach.recentMetrics")}
              </h3>
              {metrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noData")}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {metrics.slice(0, 10).map((m) => (
                    <div key={m.date} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground w-20">
                        {format(new Date(m.date), "dd/MM")}
                      </span>
                      <div className="flex items-center gap-4 flex-1">
                        {m.weight_g != null && (
                          <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                            <Weight size={10} className="text-metric-weight" />
                            {(m.weight_g / 1000).toFixed(1)}
                          </div>
                        )}
                        {m.steps != null && (
                          <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                            <Footprints size={10} className="text-metric-steps" />
                            {m.steps.toLocaleString()}
                          </div>
                        )}
                        {m.kcal != null && (
                          <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                            <Flame size={10} className="text-metric-kcal" />
                            {m.kcal.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </>
        ) : (
          /* ── Programs tab ── */
          <div className="space-y-4">
            {/* Create form */}
            <div className="space-y-2 p-3 rounded-2xl bg-muted/30 border border-border/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("program.newProgram")}
              </p>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("program.titlePlaceholder")}
                className="w-full glass rounded-xl px-3 py-2 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={14} /> {creating ? t("program.creating") : t("program.create")}
              </button>
            </div>

            {/* Program list */}
            {programs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noPrograms")}</p>
            ) : (
              <div className="space-y-2">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setEditingProgram(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/50 transition-colors text-left"
                  >
                    <ClipboardList size={16} className="text-primary" />
                    <span className="text-sm font-bold text-foreground flex-1 truncate">{p.title}</span>
                    <ChevronRight size={14} className="text-muted-foreground/40" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
