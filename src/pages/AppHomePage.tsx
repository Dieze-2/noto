import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence, useTransform, useMotionValue } from "framer-motion";
import { format, addDays, parseISO, isValid } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/i18n/dateLocale";
import {
  Footprints, Flame, Weight, Plus, ChevronLeft, ChevronRight,
  Dumbbell, Trash2, Sparkles, X,
} from "lucide-react";
import StatBubble from "@/components/StatBubble";
import GlassCard from "@/components/GlassCard";
import { getDailyMetricsByDate, saveDailyMetrics } from "@/db/dailyMetrics";
import {
  getOrCreateWorkout, getWorkoutExercises, addWorkoutExercise,
  deleteWorkoutExercise, getExerciseSets, addExerciseSet,
  deleteExerciseSet, updateWorkoutExercise, updateExerciseSet,
  WorkoutExerciseRow, WorkoutExerciseSetRow,
} from "@/db/workouts";
import { listCatalogExercises, CatalogExercise } from "@/db/catalog";
import { getEventsOverlappingRange, EventRow } from "@/db/events";
import CoachSessionCard from "@/components/CoachSessionCard";

const MAX_DOTS = 4;
const METRICS_DEBOUNCE_MS = 600;

/* ── Helpers ── */
function getISODateFromParams(p: string | null): string {
  if (p && isValid(parseISO(p))) return p;
  return format(new Date(), "yyyy-MM-dd");
}
function isHex6(x: string) { return /^#[0-9A-Fa-f]{6}$/.test(x); }
function toIntOrNull(s: string): number | null {
  const t = s.trim(); if (!t) return null;
  const n = parseInt(t, 10); return Number.isFinite(n) ? n : null;
}
function toGramsOrNull(kg: string): number | null {
  const t = kg.trim(); if (!t) return null;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}
function loadDisplay(lt: string, lg: number | null) {
  if (lt === "PDC") return "PDC";
  if (lt === "PDC_PLUS") return `PDC + ${(lg ?? 0) / 1000}`;
  return `${(lg ?? 0) / 1000}`;
}

/* ── SetRow ── */
function SetRow({ setRow, onDelete, onEdit }: {
  setRow: WorkoutExerciseSetRow;
  onDelete: (id: string) => void;
  onEdit: (s: WorkoutExerciseSetRow) => void;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-90, 0], [1, 0]);
  return (
    <motion.div layout className="relative">
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 bg-destructive rounded-2xl" />
      <motion.div
        drag="x" dragConstraints={{ left: -90, right: 0 }} style={{ x }}
        onDragEnd={(_, info) => { if (info.offset.x < -60) onDelete(setRow.id); }}
        className="relative"
      >
        <div
          className="flex items-center justify-between glass rounded-2xl px-4 py-3 cursor-pointer"
          onClick={() => onEdit(setRow)}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">SET</p>
            <p className="text-[11px] font-black uppercase italic text-foreground/80">
              {loadDisplay(setRow.load_type, setRow.load_g)} {setRow.load_type !== "TEXT" && "kg"} • {setRow.reps} reps
            </p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(setRow.id); }} className="p-2 text-muted-foreground/30 hover:text-destructive">
            <Trash2 size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── MasterRow ── */
function MasterRow({ ex, sets, onDeleteMaster, onDeleteSet, onOpenAddSet, onEditMaster, onEditSet }: {
  ex: WorkoutExerciseRow; sets: WorkoutExerciseSetRow[];
  onDeleteMaster: (id: string) => void; onDeleteSet: (id: string) => void;
  onOpenAddSet: (ex: WorkoutExerciseRow) => void;
  onEditMaster: (ex: WorkoutExerciseRow) => void;
  onEditSet: (s: WorkoutExerciseSetRow) => void;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-100, 0], [1, 0]);
  return (
    <motion.div layout className="relative">
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 bg-destructive rounded-[1.5rem]" />
      <motion.div
        drag="x" dragConstraints={{ left: -100, right: 0 }} style={{ x }}
        onDragEnd={(_, info) => { if (info.offset.x < -70) onDeleteMaster(ex.id); }}
        className="relative"
      >
        <GlassCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 cursor-pointer" onClick={() => onEditMaster(ex)}>
              <Dumbbell className="text-primary shrink-0" size={20} />
              <div className="min-w-0">
                <p className="font-black text-foreground uppercase italic leading-none truncate">{ex.exercise_name}</p>
                <p className="text-[11px] font-bold text-muted-foreground mt-1 uppercase">
                  {loadDisplay(ex.load_type, ex.load_g)} {ex.load_type !== "TEXT" && "kg"} • <span className="text-primary">{ex.reps ?? 0} reps</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={(e) => { e.stopPropagation(); onOpenAddSet(ex); }}
                className="w-12 h-12 rounded-full glass text-muted-foreground font-black uppercase text-[10px] hover:border-primary/40 border border-border">
                +SET
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDeleteMaster(ex.id); }}
                className="p-2 text-muted-foreground/30 hover:text-destructive transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          {sets.length > 0 && (
            <div className="mt-3 space-y-2">
              {sets.map((s) => <SetRow key={s.id} setRow={s} onDelete={onDeleteSet} onEdit={onEditSet} />)}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

/* ── Drawer shell ── */
function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button type="button" aria-label="Fermer" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm" />
          <motion.div
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.08}
            onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) onClose(); }}
            initial={{ y: 700 }} animate={{ y: 0 }} exit={{ y: 700 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed left-0 right-0 bottom-0 z-[70]"
          >
            <div className="mx-auto max-w-xl">
              <div className="rounded-t-[2.5rem] border border-border glass shadow-[0_-30px_80px_rgba(0,0,0,0.75)]">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
                  <div className="w-12 h-1.5 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                  <h2 className="text-sm font-black uppercase italic tracking-widest text-muted-foreground">{title}</h2>
                  <button type="button" onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <div className="px-5 pb-6 max-h-[75vh] overflow-auto space-y-4">
                  {children}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Load type toggle ── */
function LoadTypeToggle({ value, onChange }: { value: "KG" | "PDC_PLUS"; onChange: (v: "KG" | "PDC_PLUS") => void }) {
  return (
    <div className="flex glass rounded-xl p-1 h-11">
      {(["KG", "PDC_PLUS"] as const).map((type) => (
        <button key={type} type="button"
          className={`flex-1 rounded-lg font-black text-[9px] uppercase transition-colors ${value === type ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => onChange(type)}>
          {type === "PDC_PLUS" ? "PDC+" : "KG"}
        </button>
      ))}
    </div>
  );
}

/* ── DrawerInputs ── */
function DrawerInputRow({ weight, reps, onWeightChange, onRepsChange }: {
  weight: string; reps: string; onWeightChange: (v: string) => void; onRepsChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <input type="number" placeholder="kg" className="glass rounded-xl px-4 py-3 text-center font-black outline-none text-foreground"
        value={weight} onChange={(e) => onWeightChange(e.target.value)} />
      <input type="number" placeholder="reps*" className="glass rounded-xl px-4 py-3 text-center font-black outline-none text-foreground"
        value={reps} onChange={(e) => onRepsChange(e.target.value)} />
    </div>
  );
}

function DrawerSubmit({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors ${disabled ? "glass text-muted-foreground border border-border" : "bg-primary text-primary-foreground"}`}>
      {label}
    </button>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════ */
export default function AppHomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateISO = useMemo(() => getISODateFromParams(searchParams.get("date")), [searchParams]);
  const currentDate = useMemo(() => parseISO(dateISO), [dateISO]);

  /* ── Metrics state + debounce ── */
  const [metrics, setMetrics] = useState({ steps: "", kcal: "", weight: "" });
  const debounceTimerRef = useRef<number | null>(null);
  const pendingRef = useRef(metrics);
  const inFlightRef = useRef<Promise<any> | null>(null);
  const dateRef = useRef(dateISO);
  useEffect(() => { dateRef.current = dateISO; }, [dateISO]);

  function cancelDebounce() {
    if (debounceTimerRef.current) { window.clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
  }
  function buildPayload(date: string, m: typeof metrics) {
    return { date, steps: toIntOrNull(m.steps), kcal: toIntOrNull(m.kcal), weight_g: toGramsOrNull(m.weight), note: null as string | null };
  }
  async function flushMetricsForDate(date: string) {
    cancelDebounce();
    const payload = buildPayload(date, pendingRef.current);
    if (inFlightRef.current) { try { await inFlightRef.current; } catch {} }
    inFlightRef.current = saveDailyMetrics(payload);
    await inFlightRef.current;
  }
  function scheduleFlush(next: typeof metrics) {
    pendingRef.current = next; cancelDebounce();
    const captured = dateISO;
    debounceTimerRef.current = window.setTimeout(() => {
      if (dateRef.current !== captured) return;
      flushMetricsForDate(captured).catch(() => {});
    }, METRICS_DEBOUNCE_MS);
  }
  useEffect(() => () => cancelDebounce(), []);
  const updateMetric = (key: "steps" | "kcal" | "weight", val: string) => {
    const next = { ...pendingRef.current, [key]: val };
    setMetrics(next); scheduleFlush(next);
  };

  const changeDate = async (delta: number) => {
    await flushMetricsForDate(dateISO).catch(() => {});
    const d = addDays(currentDate, delta);
    setSearchParams({ date: format(d, "yyyy-MM-dd") });
  };

  /* ── Workout state ── */
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [masters, setMasters] = useState<WorkoutExerciseRow[]>([]);
  const [setsByMaster, setSetsByMaster] = useState<Record<string, WorkoutExerciseSetRow[]>>({});
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [dayEvents, setDayEvents] = useState<EventRow[]>([]);

  /* ── Drawer states ── */
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterForm, setMasterForm] = useState({ exercise_name: "", load_type: "KG" as "KG" | "PDC_PLUS", weight: "", reps: "" });
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [setOpen, setSetOpen] = useState(false);
  const [setTarget, setSetTarget] = useState<WorkoutExerciseRow | null>(null);
  const [newSet, setNewSet] = useState({ reps: "", weight: "", load_type: "KG" as "KG" | "PDC_PLUS" });

  const [editMasterOpen, setEditMasterOpen] = useState(false);
  const [editMasterTarget, setEditMasterTarget] = useState<WorkoutExerciseRow | null>(null);
  const [editMasterForm, setEditMasterForm] = useState({ reps: "", weight: "", load_type: "KG" as "KG" | "PDC_PLUS" });

  const [editSetOpen, setEditSetOpen] = useState(false);
  const [editSetTarget, setEditSetTarget] = useState<WorkoutExerciseSetRow | null>(null);
  const [editSetForm, setEditSetForm] = useState({ reps: "", weight: "", load_type: "KG" as "KG" | "PDC_PLUS" });

  /* ── Drawer helpers ── */
  function openAddSetDrawer(ex: WorkoutExerciseRow) {
    setSetTarget(ex); setNewSet({ reps: "", weight: "", load_type: ex.load_type === "PDC_PLUS" ? "PDC_PLUS" : "KG" }); setSetOpen(true);
  }
  function openEditMaster(ex: WorkoutExerciseRow) {
    setEditMasterTarget(ex);
    setEditMasterForm({ reps: String(ex.reps ?? 0), weight: ex.load_g != null ? String(ex.load_g / 1000) : "", load_type: ex.load_type === "PDC_PLUS" ? "PDC_PLUS" : "KG" });
    setEditMasterOpen(true);
  }
  function openEditSet(s: WorkoutExerciseSetRow) {
    setEditSetTarget(s);
    setEditSetForm({ reps: String(s.reps ?? 0), weight: s.load_g != null ? String(s.load_g / 1000) : "", load_type: s.load_type === "PDC_PLUS" ? "PDC_PLUS" : "KG" });
    setEditSetOpen(true);
  }

  /* ── Load data ── */
  useEffect(() => {
    const param = searchParams.get("date");
    if (!param || !isValid(parseISO(param))) setSearchParams({ date: dateISO }, { replace: true });
  }, []);

  useEffect(() => {
    let alive = true;
    listCatalogExercises().then((c) => alive && setCatalog(c)).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    cancelDebounce();
    async function load() {
      const [m, workout, evs] = await Promise.all([
        getDailyMetricsByDate(dateISO),
        getOrCreateWorkout(dateISO),
        getEventsOverlappingRange(dateISO, dateISO),
      ]);
      if (!alive) return;
      const next = {
        steps: m?.steps != null ? String(m.steps) : "",
        kcal: m?.kcal != null ? String(m.kcal) : "",
        weight: m?.weight_g != null ? String(m.weight_g / 1000) : "",
      };
      setMetrics(next); pendingRef.current = next;
      setDayEvents(evs ?? []);
      setWorkoutId(workout.id);
      const ex = await getWorkoutExercises(workout.id);
      if (!alive) return;
      setMasters(ex);
      const entries = await Promise.all(ex.map(async (master) => {
        const sets = await getExerciseSets(master.id);
        return [master.id, sets] as const;
      }));
      if (!alive) return;
      setSetsByMaster(Object.fromEntries(entries));
    }
    load().catch(() => {});
    return () => { alive = false; };
  }, [dateISO]);

  /* ── CRUD actions ── */
  const deleteMaster = async (id: string) => {
    await deleteWorkoutExercise(id);
    setMasters((p) => p.filter((e) => e.id !== id));
    setSetsByMaster((p) => { const c = { ...p }; delete c[id]; return c; });
  };
  const deleteSet = async (setId: string) => {
    await deleteExerciseSet(setId);
    setSetsByMaster((p) => {
      const c: Record<string, WorkoutExerciseSetRow[]> = {};
      for (const k of Object.keys(p)) c[k] = p[k].filter((s) => s.id !== setId);
      return c;
    });
  };
  const onAddMaster = async () => {
    if (!workoutId) return;
    const name = masterForm.exercise_name.trim(); if (!name) return;
    const reps = toIntOrNull(masterForm.reps); if (reps == null) return;
    await addWorkoutExercise({ workout_id: workoutId, exercise_name: name, reps, load_g: toGramsOrNull(masterForm.weight), load_type: masterForm.load_type, sort_order: masters.length });
    const ex = await getWorkoutExercises(workoutId); setMasters(ex);
    const nextMap = { ...setsByMaster };
    for (const m of ex) if (!nextMap[m.id]) nextMap[m.id] = await getExerciseSets(m.id);
    setSetsByMaster(nextMap); setMasterOpen(false);
  };
  const onAddSet = async () => {
    if (!setTarget) return;
    const reps = toIntOrNull(newSet.reps); if (reps == null) return;
    const existing = setsByMaster[setTarget.id] ?? [];
    await addExerciseSet({ workout_exercise_id: setTarget.id, reps, load_type: newSet.load_type, load_g: toGramsOrNull(newSet.weight), sort_order: existing.length });
    const sets = await getExerciseSets(setTarget.id);
    setSetsByMaster((p) => ({ ...p, [setTarget.id]: sets }));
    setSetOpen(false); setSetTarget(null);
  };
  const saveEditMaster = async () => {
    if (!editMasterTarget) return;
    const reps = toIntOrNull(editMasterForm.reps); if (reps == null) return;
    await updateWorkoutExercise(editMasterTarget.id, { reps, load_type: editMasterForm.load_type, load_g: toGramsOrNull(editMasterForm.weight) });
    if (workoutId) { const ex = await getWorkoutExercises(workoutId); setMasters(ex); }
    setEditMasterOpen(false); setEditMasterTarget(null);
  };
  const saveEditSet = async () => {
    if (!editSetTarget) return;
    const reps = toIntOrNull(editSetForm.reps); if (reps == null) return;
    await updateExerciseSet(editSetTarget.id, { reps, load_type: editSetForm.load_type, load_g: toGramsOrNull(editSetForm.weight) });
    const parentId = editSetTarget.workout_exercise_id;
    const sets = await getExerciseSets(parentId);
    setSetsByMaster((p) => ({ ...p, [parentId]: sets }));
    setEditSetOpen(false); setEditSetTarget(null);
  };

  /* ── Validation ── */
  const masterCanValidate = masterForm.exercise_name.trim().length > 0 && toIntOrNull(masterForm.reps) !== null;
  const setCanValidate = toIntOrNull(newSet.reps) !== null;
  const editMasterCanSave = toIntOrNull(editMasterForm.reps) !== null;
  const editSetCanSave = toIntOrNull(editSetForm.reps) !== null;

  const primary = dayEvents[0] ?? null;
  const primaryColor = primary?.color && isHex6(primary.color) ? primary.color : undefined;

  /* ═══ RENDER ═══ */
  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-32 lg:pb-8">
      <header className="flex flex-col items-center mb-8">

        {/* ── Date navigation ── */}
        <motion.div
          drag="x" dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 50) changeDate(-1);
            if (info.offset.x < -50) changeDate(1);
          }}
          className="flex items-center justify-between w-full cursor-grab active:cursor-grabbing glass py-4 rounded-3xl"
        >
          <button onClick={() => changeDate(-1)} className="p-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft size={28} />
          </button>
          <div className="text-center">
            <h1 className="text-noto-title text-3xl text-primary">
              {format(currentDate, "EEEE d", { locale: getDateLocale() })}
            </h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              {format(currentDate, "MMMM yyyy", { locale: getDateLocale() })}
            </p>
            {/* Event dots */}
            {dayEvents.length > 0 && (
              <button type="button" onClick={() => navigate("/week?note=1")} className="mt-2" aria-label="Ouvrir le planning">
                <div className="flex flex-col items-center gap-1">
                  {dayEvents.slice(0, MAX_DOTS).map((ev) => {
                    const c = isHex6(ev.color ?? "") ? ev.color! : "#FFFFFF";
                    return (
                      <div key={ev.id} className="flex items-center justify-center gap-2">
                        {primaryColor && <Sparkles size={12} style={{ color: primaryColor }} />}
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                        <span className="text-[10px] font-black uppercase italic tracking-widest" style={{ color: c }}>
                          {ev.title}
                        </span>
                      </div>
                    );
                  })}
                  {dayEvents.length > MAX_DOTS && (
                    <div className="text-[10px] font-black uppercase italic tracking-widest text-muted-foreground">
                      +{dayEvents.length - MAX_DOTS}
                    </div>
                  )}
                </div>
              </button>
            )}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 text-muted-foreground hover:text-foreground">
            <ChevronRight size={28} />
          </button>
        </motion.div>
      </header>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        <StatBubble icon={Footprints} label={t("today.steps")} value={metrics.steps}
          onChange={(v) => updateMetric("steps", v)}
          onBlur={() => flushMetricsForDate(dateISO).catch(() => {})}
          accent inputMode="numeric" />
        <StatBubble icon={Flame} label={t("today.kcal")} value={metrics.kcal}
          onChange={(v) => updateMetric("kcal", v)}
          onBlur={() => flushMetricsForDate(dateISO).catch(() => {})}
          colorClass="text-metric-kcal" inputMode="numeric" />
        <StatBubble icon={Weight} label={t("today.kg")} value={metrics.weight}
          onChange={(v) => updateMetric("weight", v)}
          onBlur={() => flushMetricsForDate(dateISO).catch(() => {})}
          colorClass="text-metric-weight" inputMode="decimal" />
      </div>

      {/* ── Coach-assigned sessions ── */}
      <div className="mb-10">
        <CoachSessionCard
          loggedExerciseNames={masters.map((m) => m.exercise_name)}
          onLogExercise={(name, sets, reps, rest, workType) => {
            // Parse reps from the program format (e.g. "10" or "8-12")
            const repsNum = reps.match(/\d+/)?.[0] ?? "";
            setMasterForm({
              exercise_name: name,
              load_type: "KG",
              weight: "",
              reps: repsNum,
            });
            setShowSuggestions(false);
            setMasterOpen(true);
          }}
        />
      </div>

      {/* ── Workout section ── */}
      <div className="space-y-6">
        <h2 className="text-noto-title text-2xl text-foreground text-center">{t("today.myWorkout")}</h2>
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {masters.map((ex) => (
              <MasterRow key={ex.id} ex={ex} sets={setsByMaster[ex.id] ?? []}
                onDeleteMaster={deleteMaster} onDeleteSet={deleteSet}
                onOpenAddSet={openAddSetDrawer} onEditMaster={openEditMaster} onEditSet={openEditSet} />
            ))}
          </AnimatePresence>
          <button onClick={() => { setMasterForm({ exercise_name: "", load_type: "KG", weight: "", reps: "" }); setShowSuggestions(false); setMasterOpen(true); }}
            className="w-full py-6 border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest mt-2">{t("today.newMovement")}</span>
          </button>
        </div>
      </div>

      {/* ═══ DRAWERS ═══ */}

      {/* Add Master */}
      <Drawer open={masterOpen} onClose={() => setMasterOpen(false)} title={t("today.addExercise")}>
        <div className="glass rounded-[2rem] p-6 space-y-4">
          <input placeholder={t("today.exercise")}
            className="w-full glass rounded-xl px-4 py-3 font-bold uppercase italic outline-none text-foreground focus:ring-1 focus:ring-primary"
            value={masterForm.exercise_name}
            onChange={(e) => { setMasterForm({ ...masterForm, exercise_name: e.target.value }); setShowSuggestions(true); }} />
          {showSuggestions && masterForm.exercise_name.trim().length > 0 && (
            <div className="max-h-48 overflow-auto space-y-2">
              {catalog.filter((c) => c.name.toLowerCase().includes(masterForm.exercise_name.toLowerCase())).slice(0, 8).map((c) => (
                <button key={c.id} type="button"
                  onClick={() => { setMasterForm({ ...masterForm, exercise_name: c.name }); setShowSuggestions(false); }}
                  className="w-full text-left glass rounded-xl px-4 py-3 font-black uppercase italic text-xs text-muted-foreground hover:border-primary/40 border border-border">
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <LoadTypeToggle value={masterForm.load_type} onChange={(v) => setMasterForm({ ...masterForm, load_type: v })} />
          <DrawerInputRow weight={masterForm.weight} reps={masterForm.reps}
            onWeightChange={(v) => setMasterForm({ ...masterForm, weight: v })}
            onRepsChange={(v) => setMasterForm({ ...masterForm, reps: v })} />
          <DrawerSubmit disabled={!masterCanValidate} onClick={onAddMaster} label={t("today.validate")} />
        </div>
      </Drawer>

      {/* Add Set */}
      <Drawer open={setOpen} onClose={() => { setSetOpen(false); setSetTarget(null); }} title={t("today.addSet")}>
        <div className="glass rounded-[2rem] p-6 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{setTarget?.exercise_name ?? ""}</p>
          <LoadTypeToggle value={newSet.load_type} onChange={(v) => setNewSet({ ...newSet, load_type: v })} />
          <DrawerInputRow weight={newSet.weight} reps={newSet.reps}
            onWeightChange={(v) => setNewSet({ ...newSet, weight: v })}
            onRepsChange={(v) => setNewSet({ ...newSet, reps: v })} />
          <DrawerSubmit disabled={!setCanValidate} onClick={onAddSet} label={t("today.validate")} />
        </div>
      </Drawer>

      {/* Edit Master */}
      <Drawer open={editMasterOpen} onClose={() => { setEditMasterOpen(false); setEditMasterTarget(null); }} title={t("today.editMaster")}>
        <div className="glass rounded-[2rem] p-6 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{editMasterTarget?.exercise_name ?? ""}</p>
          <LoadTypeToggle value={editMasterForm.load_type} onChange={(v) => setEditMasterForm({ ...editMasterForm, load_type: v })} />
          <DrawerInputRow weight={editMasterForm.weight} reps={editMasterForm.reps}
            onWeightChange={(v) => setEditMasterForm({ ...editMasterForm, weight: v })}
            onRepsChange={(v) => setEditMasterForm({ ...editMasterForm, reps: v })} />
          <DrawerSubmit disabled={!editMasterCanSave} onClick={saveEditMaster} label={t("today.save")} />
        </div>
      </Drawer>

      {/* Edit Set */}
      <Drawer open={editSetOpen} onClose={() => { setEditSetOpen(false); setEditSetTarget(null); }} title={t("today.editSet")}>
        <div className="glass rounded-[2rem] p-6 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SET</p>
          <LoadTypeToggle value={editSetForm.load_type} onChange={(v) => setEditSetForm({ ...editSetForm, load_type: v })} />
          <DrawerInputRow weight={editSetForm.weight} reps={editSetForm.reps}
            onWeightChange={(v) => setEditSetForm({ ...editSetForm, weight: v })}
            onRepsChange={(v) => setEditSetForm({ ...editSetForm, reps: v })} />
          <DrawerSubmit disabled={!editSetCanSave} onClick={saveEditSet} label={t("today.save")} />
        </div>
      </Drawer>
    </div>
  );
}
