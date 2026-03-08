import { useEffect, useState, useCallback } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import StatBubble from "@/components/StatBubble";
import GlassCard from "@/components/GlassCard";
import { getDailyMetricsByDate, saveDailyMetrics } from "@/db/dailyMetrics";
import { useAuth } from "@/auth/AuthProvider";
import { Loader2, Weight, Footprints, Flame } from "lucide-react";

const SWIPE_THRESHOLD = 50;

export default function AppHomePage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [direction, setDirection] = useState(0); // -1 left, 1 right
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const displayDate = format(currentDate, "EEEE d MMMM", { locale: fr });
  const todayLabel = isToday(currentDate) ? "Today" : format(currentDate, "dd/MM");

  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load metrics for current date
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setWeight("");
    setSteps("");
    setKcal("");
    setNote("");
    getDailyMetricsByDate(dateStr).then((m) => {
      if (m) {
        setWeight(m.weight_g != null ? (m.weight_g / 1000).toString() : "");
        setSteps(m.steps != null ? m.steps.toString() : "");
        setKcal(m.kcal != null ? m.kcal.toString() : "");
        setNote(m.note ?? "");
      }
      setLoading(false);
    });
  }, [user, dateStr]);

  const save = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    const weightKg = parseFloat(weight);
    const weightG = !isNaN(weightKg) ? Math.round(weightKg * 1000) : null;
    const stepsNum = parseInt(steps);
    const kcalNum = parseInt(kcal);

    await saveDailyMetrics({
      date: dateStr,
      weight_g: weightG,
      steps: !isNaN(stepsNum) ? stepsNum : null,
      kcal: !isNaN(kcalNum) ? kcalNum : null,
      note: note.trim() || null,
    });
    setSaving(false);
  }, [user, dateStr, weight, steps, kcal, note, saving]);

  const goNext = () => {
    setDirection(1);
    setCurrentDate((d) => addDays(d, 1));
  };
  const goPrev = () => {
    setDirection(-1);
    setCurrentDate((d) => subDays(d, 1));
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) goNext();
    else if (info.offset.x > SWIPE_THRESHOLD) goPrev();
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-6 overflow-hidden">
      {/* Header — date first, then label */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-sm capitalize text-muted-foreground">{displayDate}</p>
        <h1 className="text-noto-title text-3xl text-primary">{todayLabel}</h1>
      </motion.div>

      {/* Swipeable content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={dateStr}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeInOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={handleDragEnd}
        >
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatBubble
                  icon={<Weight className="h-5 w-5 text-metric-weight" />}
                  unit="kg"
                  value={weight}
                  onChange={setWeight}
                  onBlur={save}
                />
                <StatBubble
                  icon={<Footprints className="h-5 w-5 text-metric-steps" />}
                  value={steps}
                  onChange={setSteps}
                  onBlur={save}
                />
                <StatBubble
                  icon={<Flame className="h-5 w-5 text-metric-kcal" />}
                  value={kcal}
                  onChange={setKcal}
                  onBlur={save}
                />
              </div>

              {/* Note */}
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
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {saving && (
        <p className="mt-3 text-center text-xs text-muted-foreground animate-pulse">
          Enregistrement…
        </p>
      )}
    </div>
  );
}
