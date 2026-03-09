import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ClipboardList, ChevronDown, ChevronUp, CheckCircle2, Circle, Dumbbell } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { getMyPrograms, getProgramSessions, ProgramSessionWithExercises, ProgramExercise } from "@/db/programs";

interface CoachSessionCardProps {
  /** Names of exercises already logged today */
  loggedExerciseNames: string[];
  /** Callback to pre-fill and open the add-exercise drawer */
  onLogExercise: (exerciseName: string, sets: string, reps: string, rest: string, workType: string) => void;
}

export default function CoachSessionCard({ loggedExerciseNames, onLogExercise }: CoachSessionCardProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ProgramSessionWithExercises[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const programs = await getMyPrograms();
      if (!alive || programs.length === 0) { setLoading(false); return; }

      // Load sessions for all programs assigned to this user (athlete or self-coaching)
      const allSessions: ProgramSessionWithExercises[] = [];
      for (const p of programs) {
        const s = await getProgramSessions(p.id);
        allSessions.push(...s);
      }
      if (!alive) return;
      setSessions(allSessions);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
    return () => { alive = false; };
  }, []);

  const loggedNamesLower = useMemo(
    () => new Set(loggedExerciseNames.map((n) => n.toLowerCase())),
    [loggedExerciseNames]
  );

  if (loading || sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center flex items-center justify-center gap-2">
        <ClipboardList size={14} className="text-primary" />
        {t("coachSession.title")}
      </h3>

      {sessions.map((session) => {
        const isExpanded = expandedSession === session.id;
        const doneCount = session.exercises.filter((ex) =>
          loggedNamesLower.has(ex.exercise_name.toLowerCase())
        ).length;
        const totalCount = session.exercises.length;
        const allDone = totalCount > 0 && doneCount === totalCount;

        return (
          <GlassCard key={session.id} className="rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedSession(isExpanded ? null : session.id)}
              className="w-full flex items-center gap-3 p-4"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${allDone ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {allDone ? <CheckCircle2 size={16} /> : <ClipboardList size={16} />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-black text-foreground uppercase italic truncate">{session.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {doneCount}/{totalCount} {t("coachSession.exercisesDone")}
                </p>
              </div>
              {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-1.5">
                    {session.exercises.map((ex) => {
                      const isDone = loggedNamesLower.has(ex.exercise_name.toLowerCase());
                      return (
                        <ExerciseRow
                          key={ex.id}
                          exercise={ex}
                          isDone={isDone}
                          onLog={() => onLogExercise(ex.exercise_name, ex.sets, ex.reps, ex.rest, ex.work_type)}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        );
      })}
    </div>
  );
}

function ExerciseRow({ exercise, isDone, onLog }: { exercise: ProgramExercise; isDone: boolean; onLog: () => void }) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDone ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50"}`}>
      <button
        onClick={onLog}
        disabled={isDone}
        className="shrink-0"
      >
        {isDone ? (
          <CheckCircle2 size={20} className="text-primary" />
        ) : (
          <Circle size={20} className="text-muted-foreground/50" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black uppercase italic truncate ${isDone ? "text-primary line-through" : "text-foreground"}`}>
          {exercise.exercise_name}
        </p>
        <p className="text-[10px] text-muted-foreground font-bold">
          {exercise.sets && `${exercise.sets}×`}{exercise.reps}
          {exercise.rest && ` · ${t("coachSession.rest")} ${exercise.rest}`}
          {exercise.work_type && exercise.work_type !== "Normal" && ` · ${exercise.work_type}`}
        </p>
        {exercise.note && (
          <p className="text-[9px] text-muted-foreground/70 italic mt-0.5 truncate">{exercise.note}</p>
        )}
      </div>
      {!isDone && (
        <button
          onClick={onLog}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider"
        >
          {t("coachSession.log")}
        </button>
      )}
    </div>
  );
}
