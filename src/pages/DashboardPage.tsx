import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { subMonths, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Weight, Dumbbell, TrendingUp, TrendingDown } from "lucide-react";
import uPlot from "uplot";

import GlassCard from "@/components/GlassCard";
import UPlotChart from "@/components/UPlotChart";
import ExercisePickerSheet from "@/components/ExercisePickerSheet";
import ChartFullscreen, { ChartExpandButton } from "@/components/ChartFullscreen";
import { getDailyMetricsRange, getFirstWeightDate, DailyMetrics } from "@/db/dailyMetrics";
import {
  listTrackedExercises,
  getFirstExerciseDate,
  getExerciseMasterHistory,
} from "@/db/workouts";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ── */
type RangeKey = "3M" | "6M" | "ALL";

const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "3M", label: "3 mois" },
  { key: "6M", label: "6 mois" },
  { key: "ALL", label: "Tout" },
];

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

function hsl(token: string) {
  // Extract HSL values from CSS custom properties for uPlot
  return `hsl(${token})`;
}

/* ── Chart option builders ── */
function buildWeightOpts(height: number): uPlot.Options {
  return {
    width: 300,
    height,
    cursor: { show: true, drag: { x: false, y: false } },
    scales: {
      x: { time: true },
      y: { auto: true },
    },
    axes: [
      {
        stroke: "hsla(220,6%,55%,0.5)",
        grid: { stroke: "hsla(220,6%,22%,0.4)", width: 1 },
        ticks: { stroke: "transparent" },
        font: "11px Inter",
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => format(new Date(v * 1000), "d MMM", { locale: fr })),
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
        label: "Poids (kg)",
        stroke: "hsl(270,60%,65%)",
        width: 2,
        fill: "hsla(270,60%,65%,0.08)",
        points: { size: 4, fill: "hsl(270,60%,65%)" },
      },
    ],
  };
}

function buildExerciseOpts(height: number, showTotal: boolean): uPlot.Options {
  const series: uPlot.Series[] = [
    {},
    {
      label: "Charge (kg)",
      stroke: "hsl(156,100%,50%)",
      width: 2,
      fill: "hsla(156,100%,50%,0.08)",
      points: { size: 4, fill: "hsl(156,100%,50%)" },
    },
  ];

  if (showTotal) {
    series.push({
      label: "Total (kg)",
      stroke: "hsl(36,100%,55%)",
      width: 2,
      dash: [6, 4],
      points: { size: 3, fill: "hsl(36,100%,55%)" },
    });
  }

  return {
    width: 300,
    height,
    cursor: { show: true, drag: { x: false, y: false } },
    scales: {
      x: { time: true },
      y: { auto: true },
    },
    axes: [
      {
        stroke: "hsla(220,6%,55%,0.5)",
        grid: { stroke: "hsla(220,6%,22%,0.4)", width: 1 },
        ticks: { stroke: "transparent" },
        font: "11px Inter",
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => format(new Date(v * 1000), "d MMM", { locale: fr })),
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
    series,
  };
}

/* ── Main Component ── */
export default function DashboardPage() {
  /* Weight state */
  const [weightRange, setWeightRange] = useState<RangeKey>("3M");
  const [weightData, setWeightData] = useState<DailyMetrics[]>([]);
  const [firstWeight, setFirstWeight] = useState<string | null>(null);
  const [loadingWeight, setLoadingWeight] = useState(true);

  /* Exercise state */
  const [exercises, setExercises] = useState<string[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [exRange, setExRange] = useState<RangeKey>("3M");
  const [exData, setExData] = useState<any[]>([]);
  const [firstExDate, setFirstExDate] = useState<string | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [loadingEx, setLoadingEx] = useState(true);

  /* All weight data for Total calculation (independent of weight chart range) */
  const [allWeightData, setAllWeightData] = useState<DailyMetrics[]>([]);

  /* Fullscreen state */
  const [fullscreenChart, setFullscreenChart] = useState<"weight" | "exercise" | null>(null);

  /* Load exercise list */
  useEffect(() => {
    listTrackedExercises().then((list) => {
      setExercises(list);
      if (list.length > 0 && !selectedExercise) setSelectedExercise(list[0]);
      setLoadingEx(false);
    });
  }, []);

  /* Load first weight date */
  useEffect(() => {
    getFirstWeightDate().then(setFirstWeight);
    // Load ALL weight data for Total calculation
    getDailyMetricsRange("2000-01-01", format(new Date(), "yyyy-MM-dd")).then((d) => {
      setAllWeightData(d.filter((r) => r.weight_g != null));
    });
  }, []);

  /* Load weight data */
  useEffect(() => {
    setLoadingWeight(true);
    const from = getRangeFrom(weightRange, firstWeight);
    const to = format(new Date(), "yyyy-MM-dd");
    getDailyMetricsRange(from, to).then((d) => {
      setWeightData(d.filter((r) => r.weight_g != null));
      setLoadingWeight(false);
    });
  }, [weightRange, firstWeight]);

  /* Load first exercise date */
  useEffect(() => {
    if (!selectedExercise) return;
    getFirstExerciseDate(selectedExercise).then(setFirstExDate);
  }, [selectedExercise]);

  /* Load exercise data */
  useEffect(() => {
    if (!selectedExercise) return;
    setLoadingEx(true);
    const from = getRangeFrom(exRange, firstExDate);
    const to = format(new Date(), "yyyy-MM-dd");
    getExerciseMasterHistory(selectedExercise, from, to).then((d) => {
      setExData(d);
      setLoadingEx(false);
    });
  }, [selectedExercise, exRange, firstExDate]);

  /* Build weight chart data */
  const weightChartData = useMemo<uPlot.AlignedData>(() => {
    if (!weightData.length) return [[], []];
    const xs = weightData.map((d) => toUnix(d.date));
    const ys = weightData.map((d) => (d.weight_g ?? 0) / 1000);
    return [xs, ys];
  }, [weightData]);

  /* Build exercise chart data */
  const exChartData = useMemo<uPlot.AlignedData>(() => {
    if (!exData.length) return [[], []];

    const xs = exData.map((d: any) => toUnix(d.workout_date));
    const loads = exData.map((d: any) => (d.load_g ?? 0) / 1000);

    if (showTotal) {
      // Find last known weight for each date
      const totalLoads = exData.map((d: any) => {
        const load = (d.load_g ?? 0) / 1000;
        // Find closest weight measurement BEFORE or on this date (search backwards)
        const sortedWeights = allWeightData.filter((w) => w.date <= d.workout_date && w.weight_g != null);
        const closestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1] : null;
        const lastWeight = closestWeight ? (closestWeight.weight_g ?? 0) / 1000 : 0;
        return d.load_type === "PDC" || d.load_type === "PDC_PLUS" ? load + lastWeight : load;
      });
      return [xs, loads, totalLoads];
    }

    return [xs, loads];
  }, [exData, showTotal, allWeightData]);

  /* Chart options (memoized to avoid re-creates) */
  const weightOpts = useMemo(() => buildWeightOpts(220), []);
  const exOpts = useMemo(() => buildExerciseOpts(220, showTotal), [showTotal]);

  /* Stats */
  const weightStats = useMemo(() => {
    if (weightData.length < 2) return null;
    const first = (weightData[0].weight_g ?? 0) / 1000;
    const last = (weightData[weightData.length - 1].weight_g ?? 0) / 1000;
    const diff = last - first;
    const pct = first > 0 ? (diff / first) * 100 : 0;
    return { first, last, diff, pct };
  }, [weightData]);

  /* Exercise stats */
  const exStats = useMemo(() => {
    if (exData.length < 1) return null;
    const loads = exData.map((d: any) => (d.load_g ?? 0) / 1000);
    const reps = exData.map((d: any) => d.reps ?? 0);
    const maxLoad = Math.max(...loads);
    const maxReps = Math.max(...reps);
    const isPDC = maxLoad === 0;

    // Compute total loads (charge + bodyweight for PDC/PDC_PLUS)
    const totalLoads = exData.map((d: any) => {
      const load = (d.load_g ?? 0) / 1000;
      const sortedWeights = allWeightData.filter((w) => w.date <= d.workout_date && w.weight_g != null);
      const closestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1] : null;
      const bw = closestWeight ? (closestWeight.weight_g ?? 0) / 1000 : 0;
      return d.load_type === "PDC" || d.load_type === "PDC_PLUS" ? load + bw : load;
    });

    const maxTotal = Math.max(...totalLoads);
    const firstTotal = totalLoads[0];
    const lastTotal = totalLoads[totalLoads.length - 1];
    const progression = firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal) * 100 : null;

    // Reps progression fallback for pure PDC with no weight data
    const firstReps = reps[0];
    const lastReps = reps[reps.length - 1];
    const repsProg = firstReps > 0 ? ((lastReps - firstReps) / firstReps) * 100 : null;

    return { maxLoad, maxTotal, maxReps, lastLoad: loads[loads.length - 1], progression, repsProg, sessions: exData.length, isPDC };
  }, [exData, allWeightData]);

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-noto-title text-3xl text-primary mb-6">Dashboard</h1>

        {/* ── WEIGHT CHART ── */}
        <GlassCard className="p-5 rounded-3xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Weight size={18} className="text-[hsl(var(--metric-weight))]" />
              <h2 className="text-noto-label text-foreground">Poids</h2>
              <ChartExpandButton onClick={() => setFullscreenChart("weight")} />
            </div>
            <div className="flex gap-1">
              {RANGE_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setWeightRange(key)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    weightRange === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          {weightStats && (
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-black text-foreground">
                {weightStats.last.toFixed(1)}
                <span className="text-sm text-muted-foreground ml-1">kg</span>
              </span>
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  weightStats.diff > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {weightStats.diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {weightStats.diff > 0 ? "+" : ""}
                {weightStats.pct.toFixed(1)}%
              </span>
            </div>
          )}

          {loadingWeight ? (
            <Skeleton className="h-[220px] w-full rounded-2xl" />
          ) : weightData.length < 2 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Pas assez de données
            </div>
          ) : (
            <UPlotChart options={weightOpts} data={weightChartData} />
          )}
        </GlassCard>

        {/* ── EXERCISE CHART ── */}
        <GlassCard className="p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell size={18} className="text-primary" />
              <h2 className="text-noto-label text-foreground">Exercice</h2>
              <ChartExpandButton onClick={() => setFullscreenChart("exercise")} />
            </div>
            <div className="flex gap-1">
              {RANGE_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setExRange(key)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    exRange === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Exercise selector — bottom sheet */}
          {exercises.length > 0 && (
            <div className="mb-3">
              <ExercisePickerSheet
                exercises={exercises}
                selected={selectedExercise}
                onSelect={setSelectedExercise}
              />
            </div>
          )}

          {/* Toggle total (charge + poids du corps) */}
          {selectedExercise && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setShowTotal(false)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  !showTotal
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Charge
              </button>
              <button
                onClick={() => setShowTotal(true)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  showTotal
                    ? "bg-[hsl(var(--metric-kcal))] text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                Total
              </button>
            </div>
          )}

          {loadingEx && exercises.length === 0 ? (
            <Skeleton className="h-[220px] w-full rounded-2xl" />
          ) : exercises.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Aucun exercice enregistré
            </div>
          ) : exData.length < 2 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Pas assez de données pour « {selectedExercise} »
            </div>
          ) : (
            <UPlotChart options={exOpts} data={exChartData} />
          )}

          {/* Exercise stats summary */}
          {exStats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {exStats.isPDC ? "Reps max" : "Total max"}
                </p>
                <p className="text-lg font-black text-foreground">
                  {exStats.isPDC ? exStats.maxReps : exStats.maxTotal.toFixed(1)}
                  <span className="text-xs text-muted-foreground ml-0.5">{exStats.isPDC ? "reps" : "kg"}</span>
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Progression</p>
                {(() => {
                  const prog = exStats.progression ?? exStats.repsProg;
                  if (prog === null) return <p className="text-lg font-black text-muted-foreground">—</p>;
                  return (
                    <p className={`text-lg font-black ${prog >= 0 ? "text-primary" : "text-destructive"}`}>
                      {prog > 0 ? "+" : ""}{prog.toFixed(0)}<span className="text-xs">%</span>
                    </p>
                  );
                })()}
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Séances</p>
                <p className="text-lg font-black text-foreground">{exStats.sessions}</p>
              </div>
            </div>
          )}
        </GlassCard>
        {/* Fullscreen overlays */}
        <ChartFullscreen
          open={fullscreenChart === "weight"}
          onClose={() => setFullscreenChart(null)}
          title="Poids"
          options={weightOpts}
          data={weightChartData}
        />
        <ChartFullscreen
          open={fullscreenChart === "exercise"}
          onClose={() => setFullscreenChart(null)}
          title={selectedExercise || "Exercice"}
          options={exOpts}
          data={exChartData}
        />
      </motion.div>
    </div>
  );
}
