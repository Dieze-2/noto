import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, subMonths, parseISO } from "date-fns";
import { getDateLocale } from "@/i18n/dateLocale";
import { useTranslation } from "react-i18next";
import {
  Dumbbell, TrendingUp, TrendingDown, Minus,
  ArrowLeft, Search,
} from "lucide-react";
import uPlot from "uplot";

import GlassCard from "@/components/GlassCard";
import UPlotChart from "@/components/UPlotChart";
import ChartFullscreen, { ChartExpandButton } from "@/components/ChartFullscreen";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ── */
type RangeKey = "3M" | "6M" | "ALL";

interface ExerciseEntry {
  workout_date: string;
  exercise_name: string;
  load_type: string;
  load_g: number | null;
  reps: number;
}

interface ExerciseSummary {
  name: string;
  sessions: number;
  maxLoad: number; // kg
  lastLoad: number; // kg
  lastDate: string;
  trend: number; // % progression first→last
  sparkData: number[]; // last N load values for mini sparkline
  isPDC: boolean;
  maxReps: number;
}

interface Props {
  athleteId: string;
}

/* ── Helpers ── */
function toUnix(dateStr: string) {
  return Math.floor(parseISO(dateStr).getTime() / 1000);
}

function getRangeFrom(key: RangeKey, firstDate: string | null): string {
  const now = new Date();
  if (key === "3M") return format(subMonths(now, 3), "yyyy-MM-dd");
  if (key === "6M") return format(subMonths(now, 6), "yyyy-MM-dd");
  return firstDate ?? format(subMonths(now, 12), "yyyy-MM-dd");
}

function buildExOpts(height: number): uPlot.Options {
  return {
    width: 300,
    height,
    cursor: { show: true, drag: { x: false, y: false } },
    scales: { x: { time: true }, y: { auto: true } },
    axes: [
      {
        stroke: "hsla(220,6%,55%,0.5)",
        grid: { stroke: "hsla(220,6%,22%,0.4)", width: 1 },
        ticks: { stroke: "transparent" },
        font: "11px Inter",
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => format(new Date(v * 1000), "d MMM", { locale: getDateLocale() })),
      },
      {
        stroke: "hsla(220,6%,55%,0.5)",
        grid: { stroke: "hsla(220,6%,22%,0.4)", width: 1 },
        ticks: { stroke: "transparent" },
        font: "11px Inter",
        values: (_u: uPlot, vals: number[]) => vals.map((v) => v.toFixed(1)),
        size: 48,
      },
    ],
    series: [
      {},
      {
        label: "Charge (kg)",
        stroke: "hsl(156,100%,50%)",
        width: 2,
        fill: "hsla(156,100%,50%,0.08)",
        points: { size: 4, fill: "hsl(156,100%,50%)" },
      },
    ],
  };
}

/* ── Mini sparkline with canvas ── */
function Sparkline({ data, color = "hsl(156,100%,50%)", width = 60, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CoachExerciseDashboard({ athleteId }: Props) {
  const { t } = useTranslation();
  const [allData, setAllData] = useState<ExerciseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [detailRange, setDetailRange] = useState<RangeKey>("3M");
  const [fullscreen, setFullscreen] = useState(false);

  const RANGE_LABELS: { key: RangeKey; label: string }[] = [
    { key: "3M", label: t("dashboard.range3M") },
    { key: "6M", label: t("dashboard.range6M") },
    { key: "ALL", label: t("dashboard.rangeAll") },
  ];

  // Load all exercise data for this athlete
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_workout_exercises_flat")
        .select("workout_date, exercise_name, load_type, load_g, reps")
        .eq("user_id", athleteId)
        .order("workout_date", { ascending: true });

      if (!error && data) setAllData(data as ExerciseEntry[]);
      setLoading(false);
    })();
  }, [athleteId]);

  // Group by exercise and compute summaries
  const summaries = useMemo<ExerciseSummary[]>(() => {
    const map = new Map<string, ExerciseEntry[]>();
    allData.forEach((e) => {
      if (!map.has(e.exercise_name)) map.set(e.exercise_name, []);
      map.get(e.exercise_name)!.push(e);
    });

    return Array.from(map.entries())
      .map(([name, entries]) => {
        const loads = entries.map((e) => (e.load_g ?? 0) / 1000);
        const reps = entries.map((e) => e.reps);
        const maxLoad = Math.max(...loads);
        const maxReps = Math.max(...reps);
        const isPDC = loads.every((l) => l === 0);
        const lastLoad = loads[loads.length - 1];
        const firstLoad = loads[0];
        const trend = firstLoad > 0 ? ((lastLoad - firstLoad) / firstLoad) * 100 : 0;
        // Get unique session dates
        const dates = [...new Set(entries.map((e) => e.workout_date))];

        return {
          name,
          sessions: dates.length,
          maxLoad,
          lastLoad,
          lastDate: entries[entries.length - 1].workout_date,
          trend,
          sparkData: loads.slice(-12),
          isPDC,
          maxReps,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);
  }, [allData]);

  // Filter
  const filtered = summaries.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Detail view data
  const detailData = useMemo(() => {
    if (!selectedExercise) return [];
    const entries = allData.filter((e) => e.exercise_name === selectedExercise);
    const firstDate = entries.length > 0 ? entries[0].workout_date : null;
    const from = getRangeFrom(detailRange, firstDate);
    return entries.filter((e) => e.workout_date >= from);
  }, [allData, selectedExercise, detailRange]);

  const detailChartData = useMemo<uPlot.AlignedData>(() => {
    if (detailData.length < 2) return [[], []];
    const xs = detailData.map((d) => toUnix(d.workout_date));
    const ys = detailData.map((d) => (d.load_g ?? 0) / 1000);
    return [xs, ys];
  }, [detailData]);

  const detailOpts = useMemo(() => buildExOpts(220), []);

  const detailStats = useMemo(() => {
    if (detailData.length < 1) return null;
    const loads = detailData.map((d) => (d.load_g ?? 0) / 1000);
    const reps = detailData.map((d) => d.reps);
    const maxLoad = Math.max(...loads);
    const maxReps = Math.max(...reps);
    const isPDC = loads.every((l) => l === 0);
    const first = loads[0];
    const last = loads[loads.length - 1];
    const trend = first > 0 ? ((last - first) / first) * 100 : null;
    const dates = [...new Set(detailData.map((d) => d.workout_date))];
    return { maxLoad, maxReps, isPDC, trend, sessions: dates.length, lastLoad: last, avgReps: Math.round(reps.reduce((a, b) => a + b, 0) / reps.length) };
  }, [detailData]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <Dumbbell className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{t("coach.noTrainingData")}</p>
      </div>
    );
  }

  /* ── Detail view ── */
  if (selectedExercise) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4"
      >
        <button
          onClick={() => setSelectedExercise(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> {t("coach.backToExercises")}
        </button>

        <GlassCard className="p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Dumbbell size={18} className="text-primary shrink-0" />
              <h2 className="text-sm font-black uppercase tracking-wider text-foreground truncate">
                {selectedExercise}
              </h2>
              <ChartExpandButton onClick={() => setFullscreen(true)} />
            </div>
          </div>

          {/* Range selector */}
          <div className="flex gap-1 mb-4">
            {RANGE_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDetailRange(key)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  detailRange === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {detailData.length < 2 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              {t("dashboard.notEnoughData")}
            </div>
          ) : (
            <UPlotChart options={detailOpts} data={detailChartData} />
          )}

          {/* Stats grid */}
          {detailStats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {detailStats.isPDC ? t("dashboard.repsMax") : t("dashboard.record")}
                </p>
                <p className="text-lg font-black text-foreground">
                  {detailStats.isPDC ? detailStats.maxReps : detailStats.maxLoad.toFixed(1)}
                  <span className="text-xs text-muted-foreground ml-0.5">{detailStats.isPDC ? "reps" : "kg"}</span>
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("dashboard.progression")}</p>
                {(() => {
                  const prog = detailStats.trend;
                  if (prog === null) return <p className="text-lg font-black text-muted-foreground">—</p>;
                  return (
                    <p className={`text-lg font-black ${prog >= 0 ? "text-primary" : "text-destructive"}`}>
                      {prog > 0 ? "+" : ""}{prog.toFixed(0)}<span className="text-xs">%</span>
                    </p>
                  );
                })()}
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("dashboard.sessions")}</p>
                <p className="text-lg font-black text-foreground">{detailStats.sessions}</p>
              </div>
            </div>
          )}

          {/* Detailed history table */}
          {detailData.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                {t("coach.detailedHistory")}
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {[...detailData].reverse().map((d, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                    <span className="text-[10px] font-black text-muted-foreground w-14">
                      {format(parseISO(d.workout_date), "dd/MM")}
                    </span>
                    <span className="text-xs font-bold text-foreground flex-1">
                      {d.load_type === "PDC" ? "PDC" : d.load_type === "PDC_PLUS" ? `PDC+${(d.load_g ?? 0) / 1000}` : `${(d.load_g ?? 0) / 1000} kg`}
                    </span>
                    <span className="text-xs font-black text-primary">{d.reps} reps</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <ChartFullscreen
          open={fullscreen}
          onClose={() => setFullscreen(false)}
          title={selectedExercise}
          options={detailOpts}
          data={detailChartData}
        />
      </motion.div>
    );
  }

  /* ── Cards list view ── */
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("coach.searchExercise")}
          className="bg-transparent w-full text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Summary header */}
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {filtered.length} {t("coach.exercisesTracked")}
      </p>

      {/* Exercise cards */}
      <div className="space-y-2">
        {filtered.map((ex) => (
          <motion.button
            key={ex.name}
            onClick={() => { setSelectedExercise(ex.name); setDetailRange("3M"); }}
            whileTap={{ scale: 0.98 }}
            className="w-full text-left"
          >
            <GlassCard className="p-4 rounded-2xl hover:ring-1 hover:ring-primary/20 transition-all">
              <div className="flex items-center gap-3">
                {/* Left: icon + info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={14} className="text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground truncate">{ex.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground font-bold">
                      {ex.isPDC
                        ? `${ex.maxReps} reps max`
                        : `${ex.maxLoad.toFixed(1)} kg max`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ex.sessions} {t("dashboard.sessions").toLowerCase()}
                    </span>
                    {ex.trend !== 0 && !ex.isPDC && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-black ${ex.trend > 0 ? "text-primary" : "text-destructive"}`}>
                        {ex.trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {ex.trend > 0 ? "+" : ""}{ex.trend.toFixed(0)}%
                      </span>
                    )}
                    {ex.trend === 0 && !ex.isPDC && (
                      <Minus size={10} className="text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Right: sparkline */}
                <Sparkline data={ex.sparkData} />
              </div>
            </GlassCard>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
