import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Weight, Footprints, Flame,
  TrendingUp, TrendingDown, Minus, Dumbbell,
  ClipboardList, Plus, ChevronRight, ChevronDown, ChevronUp,
  Calendar, Trash2, CheckCircle2, AlertTriangle, Trophy, Moon,
  FileDown, StickyNote, Save,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, isBefore, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import GlassCard from "@/components/GlassCard";
import CoachNotificationBell from "@/components/CoachNotificationBell";
import { supabase } from "@/lib/supabaseClient";
import { getProfile, displayName, Profile } from "@/db/profiles";
import {
  getCoachPrograms, Program, ProgramSessionWithExercises,
  createProgram, deleteProgram, createSession, deleteSession,
  getProgramSessions,
} from "@/db/programs";
import ProgramEditor from "@/components/ProgramEditor";
import CoachExerciseDashboard from "@/components/CoachExerciseDashboard";
import { toast } from "sonner";
import { generateAthletePDF } from "@/lib/generateAthletePDF";
import { getCoachNote, saveCoachNote } from "@/db/coachNotes";

interface DailyMetric {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
}

interface WorkoutDay {
  date: string;
  exercises: { name: string; load_type: string; load_g: number | null; reps: number }[];
}

interface WorkoutDetailSet {
  reps: number;
  load_type: string;
  load_g: number | null;
}

interface WorkoutDetailExercise {
  name: string;
  load_type: string;
  load_g: number | null;
  reps: number;
  sets: WorkoutDetailSet[];
}

interface WorkoutDetail {
  date: string;
  exercises: WorkoutDetailExercise[];
}

interface DailyMetric {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
}

interface WorkoutDay {
  date: string;
  exercises: { name: string; load_type: string; load_g: number | null; reps: number }[];
}

type Tab = "overview" | "training" | "sessions";
type MetricsView = "day" | "week" | "month";

interface WeeklyRow {
  label: string;
  startDate: string;
  days: DailyMetric[];
  avgWeight: number | null;
  avgSteps: number | null;
  avgKcal: number | null;
  sessionsCount: number;
  weightVariation: number | null;
}

interface MonthlyRow {
  label: string;
  days: DailyMetric[];
  avgWeight: number | null;
  avgSteps: number | null;
  avgKcal: number | null;
  sessionsCount: number;
  weightVariation: number | null;
}

function computeWeeklyRows(metrics: DailyMetric[], workouts: WorkoutDay[]): WeeklyRow[] {
  if (metrics.length === 0) return [];
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = parseISO(sorted[0].date);
  const lastDate = parseISO(sorted[sorted.length - 1].date);
  const workoutDates = new Set(workouts.map(w => w.date));
  const rows: WeeklyRow[] = [];
  let weekStart = startOfWeek(firstDate, { weekStartsOn: 1 });

  while (isBefore(weekStart, endOfWeek(lastDate, { weekStartsOn: 1 }))) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const from = format(weekStart, "yyyy-MM-dd");
    const to = format(weekEnd, "yyyy-MM-dd");
    const days = sorted.filter(m => m.date >= from && m.date <= to);
    if (days.length > 0) {
      const weights = days.filter(d => d.weight_g != null).map(d => d.weight_g! / 1000);
      const steps = days.filter(d => d.steps != null).map(d => d.steps!);
      const kcals = days.filter(d => d.kcal != null).map(d => d.kcal!);
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      let sessCount = 0;
      let d = new Date(weekStart);
      while (d <= weekEnd) {
        if (workoutDates.has(format(d, "yyyy-MM-dd"))) sessCount++;
        d.setDate(d.getDate() + 1);
      }
      rows.push({ label: `${format(weekStart, "dd/MM")} – ${format(weekEnd, "dd/MM")}`, startDate: from, days, avgWeight: avg(weights), avgSteps: avg(steps), avgKcal: avg(kcals), sessionsCount: sessCount, weightVariation: null });
    }
    weekStart = addWeeks(weekStart, 1);
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].avgWeight != null && rows[i - 1].avgWeight != null) {
      rows[i].weightVariation = ((rows[i].avgWeight! - rows[i - 1].avgWeight!) / rows[i - 1].avgWeight!) * 100;
    }
  }
  return rows.reverse();
}

function computeMonthlyRows(metrics: DailyMetric[], workouts: WorkoutDay[]): MonthlyRow[] {
  if (metrics.length === 0) return [];
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = parseISO(sorted[0].date);
  const lastDate = parseISO(sorted[sorted.length - 1].date);
  const workoutDates = new Set(workouts.map(w => w.date));
  const rows: MonthlyRow[] = [];
  let monthStart = startOfMonth(firstDate);

  while (isBefore(monthStart, endOfMonth(lastDate))) {
    const monthEnd = endOfMonth(monthStart);
    const from = format(monthStart, "yyyy-MM-dd");
    const to = format(monthEnd, "yyyy-MM-dd");
    const days = sorted.filter(m => m.date >= from && m.date <= to);
    if (days.length > 0) {
      const weights = days.filter(d => d.weight_g != null).map(d => d.weight_g! / 1000);
      const steps = days.filter(d => d.steps != null).map(d => d.steps!);
      const kcals = days.filter(d => d.kcal != null).map(d => d.kcal!);
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      let sessCount = 0;
      let d = new Date(monthStart);
      while (d <= monthEnd) {
        if (workoutDates.has(format(d, "yyyy-MM-dd"))) sessCount++;
        d.setDate(d.getDate() + 1);
      }
      rows.push({ label: format(monthStart, "MMMM yyyy", { locale: fr }), days, avgWeight: avg(weights), avgSteps: avg(steps), avgKcal: avg(kcals), sessionsCount: sessCount, weightVariation: null });
    }
    monthStart = addMonths(monthStart, 1);
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].avgWeight != null && rows[i - 1].avgWeight != null) {
      rows[i].weightVariation = ((rows[i].avgWeight! - rows[i - 1].avgWeight!) / rows[i - 1].avgWeight!) * 100;
    }
  }
  return rows.reverse();
}

export default function CoachAthleteViewPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [metricsView, setMetricsView] = useState<MetricsView>("week");
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [expandedWorkoutDate, setExpandedWorkoutDate] = useState<string | null>(null);
  const [workoutDetails, setWorkoutDetails] = useState<Record<string, WorkoutDetail>>({});

  /* ── Program/Sessions state ── */
  const [athleteProgram, setAthleteProgram] = useState<Program | null>(null);
  const [sessions, setSessions] = useState<ProgramSessionWithExercises[]>([]);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [creating, setCreating] = useState(false);

  /* ── Coach notes state ── */
  const [noteContent, setNoteContent] = useState("");
  const [noteSaved, setNoteSaved] = useState(true);
  const [noteSaving, setNoteSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNoteChange = useCallback((value: string) => {
    setNoteContent(value);
    setNoteSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!athleteId) return;
      setNoteSaving(true);
      await saveCoachNote(athleteId, value);
      setNoteSaving(false);
      setNoteSaved(true);
    }, 1500);
  }, [athleteId]);

  /** Get or create the single program for this athlete */
  const getOrCreateProgram = async (): Promise<Program> => {
    if (athleteProgram) return athleteProgram;

    const allPrograms = await getCoachPrograms();
    const existing = allPrograms.find((p) => p.athlete_id === athleteId);
    if (existing) {
      setAthleteProgram(existing);
      return existing;
    }

    // Auto-create hidden program
    const p = await createProgram(athleteId!, `Programme ${athleteId}`);
    setAthleteProgram(p);
    return p;
  };

  const refreshSessions = async () => {
    const allPrograms = await getCoachPrograms();
    const existing = allPrograms.find((p) => p.athlete_id === athleteId);
    if (existing) {
      setAthleteProgram(existing);
      const s = await getProgramSessions(existing.id);
      setSessions(s);
    } else {
      setSessions([]);
    }
  };

  const refresh = async () => {
    if (!athleteId) return;

    const prof = await getProfile(athleteId);
    setProfile(prof);

    await refreshSessions();

    const { data: metricsData } = await supabase
      .from("daily_metrics")
      .select("date, weight_g, steps, kcal")
      .eq("user_id", athleteId)
      .order("date", { ascending: false });
    setMetrics(metricsData ?? []);

    const { data: flatExercises } = await supabase
      .from("v_workout_exercises_flat")
      .select("workout_date, exercise_name, load_type, load_g, reps")
      .eq("user_id", athleteId)
      .order("workout_date", { ascending: false });

    if (flatExercises) {
      const byDate = new Map<string, WorkoutDay>();
      flatExercises.forEach((row: any) => {
        const d = row.workout_date;
        if (!byDate.has(d)) byDate.set(d, { date: d, exercises: [] });
        byDate.get(d)!.exercises.push({
          name: row.exercise_name,
          load_type: row.load_type,
          load_g: row.load_g,
          reps: row.reps,
        });
      });
      setWorkoutHistory(Array.from(byDate.values()));
    }

    // Load coach note
    const note = await getCoachNote(athleteId);
    setNoteContent(note);
    setNoteSaved(true);

    setLoading(false);
  };

  useEffect(() => { refresh(); }, [athleteId]);

  /** Load full workout detail with sets for a specific date */
  const loadWorkoutDetail = async (date: string) => {
    if (workoutDetails[date] || !athleteId) return;
    // Get workout for this athlete and date
    const { data: workout } = await supabase
      .from("workouts")
      .select("id")
      .eq("user_id", athleteId)
      .eq("date", date)
      .maybeSingle();
    if (!workout) return;

    const { data: exercises } = await supabase
      .from("workout_exercises")
      .select("id, exercise_name, load_type, load_g, reps, sort_order")
      .eq("workout_id", workout.id)
      .order("sort_order");

    if (!exercises) return;

    const exerciseIds = exercises.map(e => e.id);
    const { data: sets } = exerciseIds.length > 0
      ? await supabase
          .from("workout_exercise_sets")
          .select("workout_exercise_id, reps, load_type, load_g, sort_order")
          .in("workout_exercise_id", exerciseIds)
          .order("sort_order")
      : { data: [] };

    const setsMap = new Map<string, WorkoutDetailSet[]>();
    (sets ?? []).forEach((s: any) => {
      const list = setsMap.get(s.workout_exercise_id) ?? [];
      list.push({ reps: s.reps, load_type: s.load_type, load_g: s.load_g });
      setsMap.set(s.workout_exercise_id, list);
    });

    const detail: WorkoutDetail = {
      date,
      exercises: exercises.map((ex: any) => ({
        name: ex.exercise_name,
        load_type: ex.load_type,
        load_g: ex.load_g,
        reps: ex.reps,
        sets: setsMap.get(ex.id) ?? [],
      })),
    };

    setWorkoutDetails(prev => ({ ...prev, [date]: detail }));
  };

  const stats = useMemo(() => {
    const last30 = metrics.slice(0, 30);
    const weights = last30.filter((m) => m.weight_g != null).map((m) => m.weight_g! / 1000);
    const stepsList = last30.filter((m) => m.steps != null).map((m) => m.steps!);
    const kcalList = last30.filter((m) => m.kcal != null).map((m) => m.kcal!);
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const latest = (arr: number[]) => arr.length > 0 ? arr[0] : null;
    const thirtyDaysAgo = format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd");
    const recentWorkouts = workoutHistory.filter((w) => w.date >= thirtyDaysAgo);

    // Weight variation since first ever entry (metrics sorted desc: [0]=latest, [last]=oldest)
    const allWeightsData = metrics.filter((m) => m.weight_g != null).map((m) => m.weight_g! / 1000);
    const weightTrendSinceFirst = allWeightsData.length >= 2
      ? allWeightsData[0] - allWeightsData[allWeightsData.length - 1]
      : 0;

    const daysWithWeight = last30.filter((m) => m.weight_g != null).length;
    const daysWithSteps = last30.filter((m) => m.steps != null).length;
    const daysWithKcal = last30.filter((m) => m.kcal != null).length;
    const totalDays = 30; // Fixed: always 30 calendar days

    const fourWeeksAgo = format(new Date(Date.now() - 28 * 86400000), "yyyy-MM-dd");
    const last4WeeksWorkouts = workoutHistory.filter((w) => w.date >= fourWeeksAgo);
    const weeksWithTraining = Math.min(new Set(
      last4WeeksWorkouts.map((w) => {
        const d = parseISO(w.date);
        return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      })
    ).size, 4); // Cap at 4 weeks

    return {
      currentWeight: latest(weights), weightTrend: weightTrendSinceFirst,
      avgSteps: avg(stepsList), avgKcal: avg(kcalList),
      workoutCount: recentWorkouts.length, totalWorkouts: workoutHistory.length,
      completion: { daysWithWeight, daysWithSteps, daysWithKcal, totalDays },
      weeksWithTraining,
    };
  }, [metrics, workoutHistory]);

  /* ── Training frequency: sessions per week (last 8 weeks) ── */
  const frequencyByWeek = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const ws = startOfWeek(new Date(now.getTime() - i * 7 * 86400000), { weekStartsOn: 1 });
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      const from = format(ws, "yyyy-MM-dd");
      const to = format(we, "yyyy-MM-dd");
      const count = workoutHistory.filter((w) => w.date >= from && w.date <= to).length;
      weeks.push({ label: format(ws, "dd/MM"), count });
    }
    const avgFreq = weeks.length > 0 ? weeks.reduce((s, w) => s + w.count, 0) / weeks.length : 0;
    return { weeks, avgFreq };
  }, [workoutHistory]);

  /* ── Muscle group distribution ── */
  const muscleGroups = useMemo(() => {
    const categories: Record<string, string[]> = {
      "Push": ["bench", "press", "dips", "développé", "poussée", "pompe", "push", "pec", "épaule", "tricep", "overhead"],
      "Pull": ["pull", "row", "tirage", "traction", "curl", "bicep", "dorsaux", "dos", "chin"],
      "Legs": ["squat", "leg", "lunge", "fente", "jambe", "cuisse", "mollet", "calf", "deadlift", "soulevé", "hip thrust", "glute", "fessier", "presse", "extension jambe", "ischio"],
      "Core": ["plank", "gainage", "crunch", "abdo", "abdominaux", "core", "oblique", "rotary"],
    };

    const counts: Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0, Autre: 0 };
    const thirtyDaysAgo = format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd");
    const recentWorkouts = workoutHistory.filter((w) => w.date >= thirtyDaysAgo);

    recentWorkouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        const lower = ex.name.toLowerCase();
        let found = false;
        for (const [cat, keywords] of Object.entries(categories)) {
          if (keywords.some((kw) => lower.includes(kw))) {
            counts[cat]++;
            found = true;
            break;
          }
        }
        if (!found) counts["Autre"]++;
      });
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [workoutHistory]);

  /* ── Personal records (best e1RM per exercise) ── */
  const personalRecords = useMemo(() => {
    const allWeights = metrics
      .filter((m) => m.weight_g != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({ date: m.date, weight_g: m.weight_g! }));

    const getBW = (date: string) => {
      const before = allWeights.filter((w) => w.date <= date);
      return before.length > 0 ? before[before.length - 1].weight_g / 1000 : 0;
    };

    const records: { name: string; e1rm: number; date: string }[] = [];
    const exMap = new Map<string, { bestE1RM: number; bestDate: string }>();

    workoutHistory.forEach((w) => {
      w.exercises.forEach((ex) => {
        const load = (ex.load_g ?? 0) / 1000;
        const isPDC = ex.load_type === "PDC" || ex.load_type === "PDC_PLUS";
        const totalLoad = isPDC ? load + getBW(w.date) : load;
        if (totalLoad <= 0) return;
        const e1rm = totalLoad * (1 + ex.reps / 30);

        const prev = exMap.get(ex.name);
        if (!prev || e1rm > prev.bestE1RM) {
          exMap.set(ex.name, { bestE1RM: e1rm, bestDate: w.date });
        }
      });
    });

    exMap.forEach((val, name) => {
      records.push({ name, e1rm: val.bestE1RM, date: val.bestDate });
    });

    return records.sort((a, b) => b.e1rm - a.e1rm).slice(0, 10);
  }, [workoutHistory, metrics]);

  /* ── Coach alerts (client-side) ── */
  const alerts = useMemo(() => {
    const result: { type: "inactive" | "weightLoss" | "pr"; icon: typeof AlertTriangle; color: string; bgColor: string; message: string }[] = [];
    const today = format(new Date(), "yyyy-MM-dd");
    const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd");

    // 1. Inactivity > 7 days
    const lastWorkoutDate = workoutHistory.length > 0 ? workoutHistory[0].date : null;
    if (!lastWorkoutDate || lastWorkoutDate < sevenDaysAgo) {
      const daysSince = lastWorkoutDate
        ? Math.floor((Date.now() - parseISO(lastWorkoutDate).getTime()) / 86400000)
        : null;
      result.push({
        type: "inactive",
        icon: Moon,
        color: "text-[hsl(36,100%,55%)]",
        bgColor: "border-[hsl(36,100%,55%)]/30 bg-[hsl(36,100%,55%)]/10",
        message: daysSince != null
          ? t("coach.alertInactive", { days: daysSince })
          : t("coach.alertNoWorkout"),
      });
    }

    // 2. Rapid weight loss (>1kg in last 7 days)
    const recentMetrics = metrics.filter((m) => m.date >= sevenDaysAgo && m.weight_g != null);
    if (recentMetrics.length >= 2) {
      const sorted = [...recentMetrics].sort((a, b) => a.date.localeCompare(b.date));
      const firstW = sorted[0].weight_g! / 1000;
      const lastW = sorted[sorted.length - 1].weight_g! / 1000;
      const diff = lastW - firstW;
      if (diff < -1) {
        result.push({
          type: "weightLoss",
          icon: AlertTriangle,
          color: "text-[hsl(0,85%,60%)]",
          bgColor: "border-[hsl(0,85%,60%)]/30 bg-[hsl(0,85%,60%)]/10",
          message: t("coach.alertWeightLoss", { kg: Math.abs(diff).toFixed(1) }),
        });
      }
    }

    // 3. PR beaten in last 7 days
    const recentPRs = personalRecords.filter((pr) => pr.date >= sevenDaysAgo);
    if (recentPRs.length > 0) {
      result.push({
        type: "pr",
        icon: Trophy,
        color: "text-[hsl(156,100%,50%)]",
        bgColor: "border-[hsl(156,100%,50%)]/30 bg-[hsl(156,100%,50%)]/10",
        message: t("coach.alertPR", { count: recentPRs.length, exercise: recentPRs[0].name }),
      });
    }

    return result;
  }, [workoutHistory, metrics, personalRecords, t]);

  const weeklyRows = useMemo(() => computeWeeklyRows(metrics, workoutHistory), [metrics, workoutHistory]);
  const monthlyRows = useMemo(() => computeMonthlyRows(metrics, workoutHistory), [metrics, workoutHistory]);

  const athleteName = displayName(profile);

  const handleAddSession = async () => {
    if (!athleteId) return;
    setCreating(true);
    try {
      const program = await getOrCreateProgram();
      const name = `${t("program.session")} ${sessions.length + 1}`;
      await createSession(program.id, name, sessions.length);
      await refreshSessions();
      // Open editor to manage all sessions
      setEditingProgram(program);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      toast.success(t("coach.sessionDeleted"));
      await refreshSessions();
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

  /* ── Program editor view (editing sessions) ── */
  if (editingProgram) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <button
            onClick={() => { setEditingProgram(null); refreshSessions(); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} /> {t("program.backToList")}
          </button>
          <ProgramEditor program={editingProgram} onBack={() => { setEditingProgram(null); refreshSessions(); }} hideTitle />
        </motion.div>
      </div>
    );
  }

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0.3) return <TrendingUp size={14} className="text-primary" />;
    if (value < -0.3) return <TrendingDown size={14} className="text-destructive" />;
    return <Minus size={14} className="text-muted-foreground" />;
  };

  function loadDisplay(lt: string, lg: number | null) {
    if (lt === "PDC") return "PDC";
    if (lt === "PDC_PLUS") return `PDC+${(lg ?? 0) / 1000}`;
    return `${(lg ?? 0) / 1000}`;
  }

  function VariationBadge({ value }: { value: number | null }) {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const positive = value > 0;
    const color = positive ? "text-destructive" : value < 0 ? "text-primary" : "text-muted-foreground";
    return <span className={`text-xs font-black ${color}`}>{positive ? "+" : ""}{value.toFixed(2)}%</span>;
  }

  const visibleMetrics = metricsExpanded ? metrics : metrics.slice(0, 14);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="p-2 rounded-xl glass hover:bg-muted/50">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-noto-title text-xl text-primary">{athleteName}</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
              {t("coach.fullHistory")}
            </p>
          </div>
          <CoachNotificationBell />
          <button
            onClick={() => {
              generateAthletePDF({
                athleteName,
                stats,
                weeklyRows,
                muscleGroups,
                personalRecords,
                sessions: sessions.map((s) => ({
                  name: s.name,
                  exercises: s.exercises.map((ex) => ({
                    exercise_name: ex.exercise_name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest: ex.rest,
                    work_type: ex.work_type,
                    note: ex.note,
                  })),
                })),
                frequencyAvg: frequencyByWeek.avgFreq,
                t,
              });
              toast.success(t("pdf.downloaded"));
            }}
            className="p-2.5 rounded-xl glass hover:bg-muted/50 text-primary"
            title={t("pdf.export")}
          >
            <FileDown size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex glass rounded-xl p-1">
          {(["overview", "training", "sessions"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" ? t("coach.overview") : tab === "training" ? t("coach.training") : t("coach.sessionsTab")}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            {/* ── Coach Alerts ── */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert, i) => {
                  const Icon = alert.icon;
                  return (
                    <motion.div
                      key={alert.type}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border ${alert.bgColor}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alert.color} bg-background/50`}>
                        <Icon size={16} />
                      </div>
                      <p className="text-xs font-bold text-foreground flex-1">{alert.message}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Weight size={16} className="text-metric-weight" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("dashboard.weight")}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{stats.currentWeight != null ? stats.currentWeight.toFixed(1) : "—"}</span>
                  <span className="text-xs text-muted-foreground">kg</span>
                  {stats.currentWeight != null && <TrendIcon value={stats.weightTrend} />}
                </div>
                {stats.weightTrend !== 0 && stats.currentWeight != null && (
                  <p className="text-[10px] text-muted-foreground">
                    {stats.weightTrend > 0 ? "+" : ""}{stats.weightTrend.toFixed(1)} kg
                    <span className="text-muted-foreground/50 ml-1">{t("coach.sinceFirstEntry", "depuis 1ère saisie")}</span>
                  </p>
                )}
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("coach.workouts")}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{stats.workoutCount}</span>
                  <span className="text-xs text-muted-foreground">/ 30j</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{stats.totalWorkouts} {t("coach.totalSessions")}</p>
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Footprints size={16} className="text-metric-steps" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("coach.avgSteps")}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{stats.avgSteps != null ? Math.round(stats.avgSteps).toLocaleString() : "—"}</span>
                </div>
              </GlassCard>

              <GlassCard className="p-4 rounded-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-metric-kcal" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("coach.avgKcal")}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{stats.avgKcal != null ? Math.round(stats.avgKcal).toLocaleString() : "—"}</span>
                </div>
              </GlassCard>
            </div>

            {/* Data completion & consistency */}
            <GlassCard className="p-5 rounded-3xl space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t("coach.completionTitle")}
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground ml-auto">
                  {t("coach.last30days")}
                </span>
              </div>

              {[
                { label: t("dashboard.weight"), count: stats.completion.daysWithWeight, total: stats.completion.totalDays, color: "bg-[hsl(var(--metric-weight))]" },
                { label: t("coach.avgSteps"), count: stats.completion.daysWithSteps, total: stats.completion.totalDays, color: "bg-[hsl(var(--metric-steps))]" },
                { label: t("coach.avgKcal"), count: stats.completion.daysWithKcal, total: stats.completion.totalDays, color: "bg-[hsl(var(--metric-kcal))]" },
              ].map(({ label, count, total, color }) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{label}</span>
                      <span className={`text-xs font-black ${pct >= 70 ? "text-primary" : pct >= 40 ? "text-warning" : "text-destructive"}`}>
                        {count}/{total}j · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{t("coach.trainingConsistency")}</span>
                  <span className={`text-xs font-black ${stats.weeksWithTraining >= 3 ? "text-primary" : stats.weeksWithTraining >= 2 ? "text-warning" : "text-destructive"}`}>
                    {stats.weeksWithTraining}/4 {t("coach.weeksActive")}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 h-3 rounded-full transition-colors ${
                        i < stats.weeksWithTraining ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* ── Training Frequency (last 8 weeks) ── */}
            <GlassCard className="p-5 rounded-3xl space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">
                  {t("coach.trainingFrequency")}
                </h3>
                <span className="text-xs font-black text-foreground">
                  ø {frequencyByWeek.avgFreq.toFixed(1)} / {t("coach.perWeek")}
                </span>
              </div>
              <div className="flex items-end gap-1 h-16">
                {frequencyByWeek.weeks.map((w, i) => {
                  const maxCount = Math.max(...frequencyByWeek.weeks.map((x) => x.count), 1);
                  const h = w.count > 0 ? Math.max((w.count / maxCount) * 100, 12) : 4;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-black text-foreground">{w.count || ""}</span>
                      <div
                        className={`w-full rounded-t-md transition-all ${w.count > 0 ? "bg-primary" : "bg-muted"}`}
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{w.label}</span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* ── Recent Workouts Detail ── */}
            {workoutHistory.length > 0 && (
              <GlassCard className="p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">
                    {t("coach.workoutDetail", "Détail des entraînements")}
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {workoutHistory.length} {t("coach.totalSessions")}
                  </span>
                </div>
                <div className="space-y-1">
                  {workoutHistory.slice(0, 15).map((w) => (
                    <div key={w.date}>
                      <button
                        onClick={() => {
                          const next = expandedWorkoutDate === w.date ? null : w.date;
                          setExpandedWorkoutDate(next);
                          if (next) loadWorkoutDetail(next);
                        }}
                        className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
                      >
                        <Calendar size={14} className="text-primary shrink-0" />
                        <span className="text-xs font-bold text-foreground flex-1 capitalize">
                          {format(parseISO(w.date), "EEEE d MMMM", { locale: fr })}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {w.exercises.length} ex.
                        </span>
                        {expandedWorkoutDate === w.date ? (
                          <ChevronUp size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        )}
                      </button>
                      {expandedWorkoutDate === w.date && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="pl-8 pr-3 pb-2 space-y-1.5"
                        >
                          {(workoutDetails[w.date]?.exercises ?? w.exercises.map(ex => ({ ...ex, sets: [] as WorkoutDetailSet[] }))).map((ex, i) => (
                            <div key={`${ex.name}-${i}`} className="py-1.5 border-b border-border/20 last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex-1 truncate">{ex.name}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  {loadDisplay(ex.load_type, ex.load_g)} {ex.load_type !== "TEXT" && ex.load_type !== "PDC" ? "kg" : ""}
                                </span>
                                <span className="text-[10px] font-bold text-primary">
                                  {ex.reps} reps
                                </span>
                              </div>
                              {ex.sets.length > 0 && (
                                <div className="ml-4 mt-1 space-y-0.5">
                                  {ex.sets.map((s, si) => (
                                    <div key={si} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <span className="font-bold w-8">Set {si + 2}</span>
                                      <span>{loadDisplay(s.load_type, s.load_g)} {s.load_type !== "TEXT" && s.load_type !== "PDC" ? "kg" : ""}</span>
                                      <span className="text-primary font-bold">{s.reps} reps</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {muscleGroups.length > 0 && (
              <GlassCard className="p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <Dumbbell size={16} className="text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">
                    {t("coach.muscleGroups")}
                  </h3>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {t("coach.last30days")}
                  </span>
                </div>
                {muscleGroups.map((mg) => {
                  const colors: Record<string, string> = {
                    Push: "bg-[hsl(220,70%,55%)]",
                    Pull: "bg-[hsl(156,100%,45%)]",
                    Legs: "bg-[hsl(36,100%,55%)]",
                    Core: "bg-[hsl(270,60%,60%)]",
                    Autre: "bg-muted-foreground",
                  };
                  return (
                    <div key={mg.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{mg.name}</span>
                        <span className="text-xs font-black text-muted-foreground">{mg.count} · {mg.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colors[mg.name] ?? "bg-muted-foreground"}`}
                          style={{ width: `${mg.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </GlassCard>
            )}

            {/* ── Personal Records ── */}
            {personalRecords.length > 0 && (
              <GlassCard className="p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">
                    {t("coach.personalRecords")}
                  </h3>
                </div>
                <div className="space-y-1">
                  {personalRecords.map((pr, i) => (
                    <div key={pr.name} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                      <span className="text-[10px] font-black text-muted-foreground w-5 text-right">{i + 1}</span>
                      <span className="text-xs font-bold text-foreground flex-1 truncate">{pr.name}</span>
                      <span className="text-xs font-black text-primary">{pr.e1rm.toFixed(1)} kg</span>
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(pr.date), "dd/MM/yy")}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <div className="flex glass rounded-xl p-1">
              {(["day", "week", "month"] as MetricsView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => { setMetricsView(v); setMetricsExpanded(false); }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                    metricsView === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`coach.view_${v}`)}
                </button>
              ))}
            </div>

            {/* Day view */}
            {metricsView === "day" && (
              <GlassCard className="p-5 rounded-3xl">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
                  {t("coach.metricsHistory")} ({metrics.length})
                </h3>
                {metrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noData")}</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      {visibleMetrics.map((m) => (
                        <div key={m.date} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground w-16">{format(new Date(m.date), "dd/MM")}</span>
                          <div className="flex items-center gap-4 flex-1">
                            {m.weight_g != null && <div className="flex items-center gap-1 text-xs font-bold text-foreground"><Weight size={10} className="text-metric-weight" />{(m.weight_g / 1000).toFixed(1)}</div>}
                            {m.steps != null && <div className="flex items-center gap-1 text-xs font-bold text-foreground"><Footprints size={10} className="text-metric-steps" />{m.steps.toLocaleString()}</div>}
                            {m.kcal != null && <div className="flex items-center gap-1 text-xs font-bold text-foreground"><Flame size={10} className="text-metric-kcal" />{m.kcal.toLocaleString()}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {metrics.length > 14 && (
                      <button onClick={() => setMetricsExpanded(!metricsExpanded)} className="w-full flex items-center justify-center gap-1 mt-3 text-[10px] font-black uppercase tracking-widest text-primary">
                        {metricsExpanded ? <><ChevronUp size={12} /> {t("coach.showLess")}</> : <><ChevronDown size={12} /> {t("coach.showAll")} ({metrics.length})</>}
                      </button>
                    )}
                  </>
                )}
              </GlassCard>
            )}

            {/* Week view */}
            {metricsView === "week" && (
              <GlassCard className="p-4 rounded-3xl">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t("coach.weeklyView")} ({weeklyRows.length})</h3>
                {weeklyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noData")}</p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-2 py-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">{t("coach.period")}</th>
                          <th className="text-center px-1 py-2"><Footprints size={10} className="mx-auto text-metric-steps" /></th>
                          <th className="text-center px-1 py-2"><Flame size={10} className="mx-auto text-metric-kcal" /></th>
                          <th className="text-center px-1 py-2"><Weight size={10} className="mx-auto text-metric-weight" /></th>
                          <th className="text-center px-1 py-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">%</th>
                          <th className="text-center px-1 py-2"><Dumbbell size={10} className="mx-auto text-primary" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(metricsExpanded ? weeklyRows : weeklyRows.slice(0, 8)).map((row, i) => (
                          <tr key={row.startDate} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                            <td className="px-2 py-2 font-bold text-foreground whitespace-nowrap">{row.label}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgSteps != null ? Math.round(row.avgSteps).toLocaleString() : "—"}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgKcal != null ? Math.round(row.avgKcal) : "—"}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgWeight != null ? row.avgWeight.toFixed(1) : "—"}</td>
                            <td className="text-center px-1 py-2"><VariationBadge value={row.weightVariation} /></td>
                            <td className="text-center px-1 py-2 font-black text-primary">{row.sessionsCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {weeklyRows.length > 8 && (
                      <button onClick={() => setMetricsExpanded(!metricsExpanded)} className="w-full flex items-center justify-center gap-1 mt-3 text-[10px] font-black uppercase tracking-widest text-primary">
                        {metricsExpanded ? <><ChevronUp size={12} /> {t("coach.showLess")}</> : <><ChevronDown size={12} /> {t("coach.showAll")} ({weeklyRows.length})</>}
                      </button>
                    )}
                  </div>
                )}
              </GlassCard>
            )}

            {/* Month view */}
            {metricsView === "month" && (
              <GlassCard className="p-4 rounded-3xl">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{t("coach.monthlyView")} ({monthlyRows.length})</h3>
                {monthlyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noData")}</p>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-2 py-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">{t("coach.period")}</th>
                          <th className="text-center px-1 py-2"><Footprints size={10} className="mx-auto text-metric-steps" /></th>
                          <th className="text-center px-1 py-2"><Flame size={10} className="mx-auto text-metric-kcal" /></th>
                          <th className="text-center px-1 py-2"><Weight size={10} className="mx-auto text-metric-weight" /></th>
                          <th className="text-center px-1 py-2 font-black uppercase tracking-wider text-muted-foreground text-[9px]">%</th>
                          <th className="text-center px-1 py-2"><Dumbbell size={10} className="mx-auto text-primary" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyRows.map((row, i) => (
                          <tr key={row.label} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                            <td className="px-2 py-2 font-bold text-foreground capitalize whitespace-nowrap">{row.label}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgSteps != null ? Math.round(row.avgSteps).toLocaleString() : "—"}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgKcal != null ? Math.round(row.avgKcal) : "—"}</td>
                            <td className="text-center px-1 py-2 font-bold text-foreground">{row.avgWeight != null ? row.avgWeight.toFixed(1) : "—"}</td>
                            <td className="text-center px-1 py-2"><VariationBadge value={row.weightVariation} /></td>
                            <td className="text-center px-1 py-2 font-black text-primary">{row.sessionsCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            )}

            {/* ── Coach Private Notes ── */}
            <GlassCard className="p-5 rounded-3xl space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote size={16} className="text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">
                  {t("coach.privateNotes")}
                </h3>
                <span className="text-[9px] font-bold text-muted-foreground">
                  {noteSaving ? t("coach.notesSaving") : noteSaved ? t("coach.notesSaved") : t("coach.notesUnsaved")}
                </span>
              </div>
              <textarea
                value={noteContent}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={t("coach.notesPlaceholder")}
                className="w-full min-h-[120px] bg-muted/30 border border-border/50 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </GlassCard>
          </>
        ) : activeTab === "training" ? (
          <CoachExerciseDashboard athleteId={athleteId!} />
        ) : (
          /* ── Sessions tab ── */
          <div className="space-y-4">
            <button
              onClick={handleAddSession}
              disabled={creating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={16} />
              {creating ? t("program.creating") : t("coach.addSession")}
            </button>

            {sessions.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("coach.noSessions")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={() => athleteProgram && setEditingProgram(athleteProgram)}
                      className="flex-1 flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/50 transition-colors text-left"
                    >
                      <ClipboardList size={16} className="text-primary" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-foreground truncate block">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {s.exercises.length} {t("coach.exercisesCount")}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/40" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="p-2 text-destructive/40 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Edit all sessions button */}
                {athleteProgram && (
                  <button
                    onClick={() => setEditingProgram(athleteProgram)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary/30 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/10 transition-colors mt-2"
                  >
                    {t("coach.editSessions")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
