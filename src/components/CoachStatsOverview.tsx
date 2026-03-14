import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, TrendingUp, TrendingDown, Users, Zap, Calendar,
  Loader2, Trophy, Flame, User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { subDays, format, differenceInCalendarWeeks, parseISO, differenceInYears } from "date-fns";

import GlassCard from "@/components/GlassCard";
import { supabase } from "@/lib/supabaseClient";
import { CoachAthlete } from "@/db/coachAthletes";
import { Profile, displayName } from "@/db/profiles";

interface Props {
  athletes: CoachAthlete[];
  profiles: Record<string, Profile>;
}

/** Compute estimated 1RM (Epley formula) */
function computeE1RM(loadKg: number, reps: number): number {
  if (loadKg <= 0) return 0;
  return loadKg * (1 + reps / 30);
}

export default function CoachStatsOverview({ athletes, profiles }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);

  const acceptedAthletes = athletes.filter(
    (a) => a.status === "accepted" && a.athlete_id
  );

  useEffect(() => {
    if (acceptedAthletes.length === 0) {
      setLoading(false);
      return;
    }

    (async () => {
      const athleteIds = acceptedAthletes.map((a) => a.athlete_id!);
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

      const [{ data: recent }, { data: all }] = await Promise.all([
        supabase
          .from("v_workout_exercises_flat")
          .select("user_id, workout_date, exercise_name, load_type, load_g, reps")
          .in("user_id", athleteIds)
          .gte("workout_date", thirtyDaysAgo)
          .order("workout_date", { ascending: true }),
        supabase
          .from("v_workout_exercises_flat")
          .select("user_id, workout_date, exercise_name, load_type, load_g, reps")
          .in("user_id", athleteIds)
          .order("workout_date", { ascending: true }),
      ]);

      setRecentWorkouts(recent ?? []);
      setAllWorkouts(all ?? []);
      setLoading(false);
    })();
  }, [acceptedAthletes.length]);

  const stats = useMemo(() => {
    const athleteIds = acceptedAthletes.map((a) => a.athlete_id!);
    if (athleteIds.length === 0) return null;

    const fourteenDaysAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
    const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

    // --- Per-athlete recent data ---
    const perAthlete = athleteIds.map((id) => {
      const recent = recentWorkouts.filter((w) => w.user_id === id);
      const recentDates = [...new Set(recent.map((w: any) => w.workout_date))];
      const lastDate = recentDates[recentDates.length - 1] ?? null;
      return {
        id,
        sessionsLast30: recentDates.length,
        isActive: lastDate ? lastDate >= fourteenDaysAgo : false,
        recentDates,
      };
    });

    const activeCount = perAthlete.filter((s) => s.isActive).length;
    const inactiveCount = perAthlete.length - activeCount;
    const totalSessions = perAthlete.reduce((s, a) => s + a.sessionsLast30, 0);
    const avgFrequency = perAthlete.length > 0
      ? perAthlete.reduce((s, a) => s + a.sessionsLast30, 0) / perAthlete.length / (30 / 7)
      : 0;

    // Average age of athletes
    const ages = athleteIds
      .map((id) => profiles[id]?.date_of_birth)
      .filter((dob): dob is string => !!dob)
      .map((dob) => differenceInYears(new Date(), parseISO(dob)));
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

    // --- Consistency: % of athletes who trained this week ---
    const trainedThisWeek = perAthlete.filter((a) =>
      a.recentDates.some((d: string) => d >= sevenDaysAgo)
    ).length;
    const consistencyRate = perAthlete.length > 0
      ? Math.round((trainedThisWeek / perAthlete.length) * 100)
      : 0;

    // --- Global e1RM progressions per exercise ---
    const perAthleteExercises = new Map<string, Map<string, any[]>>();

    allWorkouts.forEach((w) => {
      const aKey = w.user_id;
      if (!perAthleteExercises.has(aKey)) perAthleteExercises.set(aKey, new Map());
      const exes = perAthleteExercises.get(aKey)!;
      if (!exes.has(w.exercise_name)) exes.set(w.exercise_name, []);
      exes.get(w.exercise_name)!.push(w);
    });

    // Compute per-athlete average progression
    const athleteProgressionMap = new Map<string, number[]>();

    // Aggregate progression per exercise across all athletes
    const globalExProgression = new Map<string, number[]>();
    perAthleteExercises.forEach((exes, athleteId) => {
      exes.forEach((entries, exName) => {
        if (entries.length < 2) return;
        const first = entries[0];
        const last = entries[entries.length - 1];
        const firstLoad = (first.load_g ?? 0) / 1000;
        const lastLoad = (last.load_g ?? 0) / 1000;

        let pct: number | null = null;

        if (firstLoad > 0 && lastLoad > 0) {
          const firstE1RM = computeE1RM(firstLoad, first.reps);
          const lastE1RM = computeE1RM(lastLoad, last.reps);
          if (firstE1RM > 0) pct = ((lastE1RM - firstE1RM) / firstE1RM) * 100;
        } else if (lastLoad > 0 && firstLoad <= 0) {
          const firstWithLoad = entries.find((e: any) => (e.load_g ?? 0) > 0);
          const lastWithLoad = [...entries].reverse().find((e: any) => (e.load_g ?? 0) > 0);
          if (firstWithLoad && lastWithLoad && firstWithLoad !== lastWithLoad) {
            const fE1RM = computeE1RM((firstWithLoad.load_g ?? 0) / 1000, firstWithLoad.reps);
            const lE1RM = computeE1RM((lastWithLoad.load_g ?? 0) / 1000, lastWithLoad.reps);
            if (fE1RM > 0) pct = ((lE1RM - fE1RM) / fE1RM) * 100;
          }
        } else {
          if (first.reps > 0) pct = ((last.reps - first.reps) / first.reps) * 100;
        }

        if (pct !== null) {
          if (!globalExProgression.has(exName)) globalExProgression.set(exName, []);
          globalExProgression.get(exName)!.push(pct);

          if (!athleteProgressionMap.has(athleteId)) athleteProgressionMap.set(athleteId, []);
          athleteProgressionMap.get(athleteId)!.push(pct);
        }
      });
    });

    const exerciseProgressions: { name: string; pct: number }[] = [];
    globalExProgression.forEach((values, name) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      exerciseProgressions.push({ name, pct: avg });
    });
    exerciseProgressions.sort((a, b) => b.pct - a.pct);

    // Overall avg progression
    const allProgressions = exerciseProgressions.map((e) => e.pct);
    const avgProgression = allProgressions.length > 0
      ? allProgressions.reduce((a, b) => a + b, 0) / allProgressions.length
      : null;

    // Best & worst ATHLETE
    const athleteAvgProgressions: { id: string; name: string; pct: number }[] = [];
    athleteProgressionMap.forEach((values, id) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const profile = profiles[id];
      athleteAvgProgressions.push({ id, name: displayName(profile, id.slice(0, 8)), pct: avg });
    });
    athleteAvgProgressions.sort((a, b) => b.pct - a.pct);

    const bestAthlete = athleteAvgProgressions.length > 0 ? athleteAvgProgressions[0] : null;
    const worstAthlete = athleteAvgProgressions.length > 0
      ? athleteAvgProgressions[athleteAvgProgressions.length - 1]
      : null;

    return {
      activeCount,
      inactiveCount,
      totalSessions,
      avgFrequency,
      avgProgression,
      consistencyRate,
      bestAthlete,
      worstAthlete,
      topExercises: exerciseProgressions.slice(0, 5),
      avgAge,
    };
  }, [recentWorkouts, allWorkouts, acceptedAthletes.length, profiles]);

  if (acceptedAthletes.length === 0) return null;

  if (loading) {
    return (
      <GlassCard className="p-6 rounded-2xl flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </GlassCard>
    );
  }

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-primary" />
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
          {t("coachStats.title")}
        </h2>
      </div>

      {/* Row 1: Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-4 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users size={14} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-primary">{stats.activeCount}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("coachStats.activeAthletes")}
          </div>
          {stats.inactiveCount > 0 && (
            <div className="text-[9px] text-destructive font-bold mt-0.5">
              {stats.inactiveCount} {t("coachStats.inactive")}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users size={14} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">{stats.avgAge !== null ? `${stats.avgAge} ${t("coachStats.years")}` : "—"}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("coachStats.avgAge")}
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap size={14} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {stats.avgFrequency.toFixed(1)}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("coachStats.avgFrequency")}
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {stats.avgProgression !== null && stats.avgProgression >= 0 ? (
              <TrendingUp size={14} className="text-primary" />
            ) : (
              <TrendingDown size={14} className="text-destructive" />
            )}
          </div>
          {stats.avgProgression !== null ? (
            <div className={`text-2xl font-black ${stats.avgProgression >= 0 ? "text-primary" : "text-destructive"}`}>
              {stats.avgProgression > 0 ? "+" : ""}{stats.avgProgression.toFixed(1)}%
            </div>
          ) : (
            <div className="text-2xl font-black text-muted-foreground">—</div>
          )}
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("coachStats.avgProgression")}
          </div>
        </GlassCard>
      </div>

      {/* Row 2: Consistency + Top progressions side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GlassCard className="p-4 rounded-2xl text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame size={14} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">{stats.consistencyRate}%</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t("coachStats.consistency")}
          </div>
        </GlassCard>

        {stats.topExercises.length > 0 && (
          <GlassCard className="rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <Trophy size={12} className="text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t("coachStats.topProgressions")}
              </p>
            </div>
            <div className="divide-y divide-border">
              {stats.topExercises.map((ex, i) => (
                <div key={ex.name} className="px-4 py-2 flex items-center gap-3">
                  <span className="text-[10px] font-black text-muted-foreground w-5 text-center">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-foreground flex-1 truncate">
                    {ex.name}
                  </span>
                  <span className={`text-xs font-black ${ex.pct >= 0 ? "text-primary" : "text-destructive"}`}>
                    {ex.pct > 0 ? "+" : ""}{ex.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Row 3: Best / Worst athlete */}
      {(stats.bestAthlete || stats.worstAthlete) && (
        <div className="grid grid-cols-2 gap-3">
          {stats.bestAthlete && (
            <GlassCard className="p-4 rounded-2xl">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t("coachStats.bestAthlete")}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <User size={12} className="text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground truncate">{stats.bestAthlete.name}</p>
              </div>
              <p className="text-lg font-black text-primary">
                {stats.bestAthlete.pct > 0 ? "+" : ""}{stats.bestAthlete.pct.toFixed(1)}%
              </p>
              <p className="text-[9px] font-bold text-muted-foreground">{t("coachStats.avgE1rm")}</p>
            </GlassCard>
          )}
          {stats.worstAthlete && stats.worstAthlete.id !== stats.bestAthlete?.id && (
            <GlassCard className="p-4 rounded-2xl">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown size={12} className="text-destructive" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t("coachStats.worstAthlete")}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <User size={12} className="text-destructive" />
                </div>
                <p className="text-xs font-bold text-foreground truncate">{stats.worstAthlete.name}</p>
              </div>
              <p className={`text-lg font-black ${stats.worstAthlete.pct >= 0 ? "text-primary" : "text-destructive"}`}>
                {stats.worstAthlete.pct > 0 ? "+" : ""}{stats.worstAthlete.pct.toFixed(1)}%
              </p>
              <p className="text-[9px] font-bold text-muted-foreground">{t("coachStats.avgE1rm")}</p>
            </GlassCard>
          )}
        </div>
      )}
    </motion.div>
  );
}
