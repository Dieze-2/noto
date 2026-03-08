import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Save, GripVertical, ChevronDown, ChevronUp,
  Loader2, Dumbbell, Search, X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import GlassCard from "@/components/GlassCard";
import {
  Program, ProgramSessionWithExercises, ProgramExercise,
  getProgramSessions, createSession, updateSession, deleteSession,
  reorderSessions, addExercise, updateExercise, deleteExercise,
  updateProgramTitle,
} from "@/db/programs";
import { listCatalogExercises, CatalogExercise } from "@/db/catalog";

const WORK_TYPES = [
  "Pyramide inversée",
  "X Reps",
  "Sensations",
  "Dropset",
  "Séries classiques",
  "Superset",
  "Rest-pause",
];

/* ── Sortable session wrapper ── */
function SortableSession({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50" : ""}
    >
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="pt-4 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none">
          <GripVertical size={16} />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

/* ── Exercise picker bottom sheet ── */
function CatalogPicker({ catalog, onSelect, onClose }: {
  catalog: CatalogExercise[];
  onSelect: (ex: CatalogExercise) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const filtered = catalog.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <motion.button
        type="button" aria-label="Close" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="fixed left-0 right-0 bottom-0 z-[70]"
      >
        <div className="mx-auto max-w-xl">
          <div className="rounded-t-[2rem] border border-border glass shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
              <div className="w-12 h-1.5 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                {t("exercisePicker.title")}
              </h2>
              <button type="button" onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                <Search size={14} className="text-muted-foreground shrink-0" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("exercisePicker.search")}
                  className="bg-transparent w-full text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 pb-6 max-h-[50vh] overflow-auto space-y-1">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">{t("exercisePicker.noResult")}</p>
              ) : (
                filtered.map((ex) => (
                  <button
                    key={ex.id} type="button"
                    onClick={() => onSelect(ex)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-foreground hover:bg-muted border border-transparent transition-colors"
                  >
                    {ex.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Exercise row ── */
function ExerciseRow({ exercise, onUpdate, onDelete }: {
  exercise: ProgramExercise;
  onUpdate: (id: string, updates: Partial<ProgramExercise>) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [showNote, setShowNote] = useState(!!exercise.note);
  const [workTypeCustom, setWorkTypeCustom] = useState(
    !WORK_TYPES.includes(exercise.work_type) && exercise.work_type !== "" ? exercise.work_type : ""
  );
  const isCustomWorkType = !WORK_TYPES.includes(exercise.work_type) && exercise.work_type !== "";

  const inputClass = "w-full glass rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40";

  return (
    <div className="space-y-2 p-3 rounded-2xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2">
        <Dumbbell size={12} className="text-primary shrink-0" />
        <span className="text-sm font-black text-foreground flex-1 truncate">{exercise.exercise_name}</span>
        <button onClick={() => onDelete(exercise.id)} className="text-destructive/50 hover:text-destructive">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
            {t("program.sets")}
          </label>
          <input
            value={exercise.sets}
            onChange={(e) => onUpdate(exercise.id, { sets: e.target.value })}
            placeholder="4"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
            {t("program.reps")}
          </label>
          <input
            value={exercise.reps}
            onChange={(e) => onUpdate(exercise.id, { reps: e.target.value })}
            placeholder="8 à 12"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
            {t("program.rest")}
          </label>
          <input
            value={exercise.rest}
            onChange={(e) => onUpdate(exercise.id, { rest: e.target.value })}
            placeholder="3 à 5 min"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 block">
            {t("program.workType")}
          </label>
          <select
            value={isCustomWorkType ? "__custom__" : exercise.work_type}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setWorkTypeCustom("");
                onUpdate(exercise.id, { work_type: "" });
              } else {
                setWorkTypeCustom("");
                onUpdate(exercise.id, { work_type: e.target.value });
              }
            }}
            className={inputClass + " bg-transparent"}
          >
            <option value="">—</option>
            {WORK_TYPES.map((wt) => <option key={wt} value={wt}>{wt}</option>)}
            <option value="__custom__">{t("program.customType")}</option>
          </select>
          {(isCustomWorkType || (!WORK_TYPES.includes(exercise.work_type) && exercise.work_type === "")) && (
            <input
              value={workTypeCustom}
              onChange={(e) => {
                setWorkTypeCustom(e.target.value);
                onUpdate(exercise.id, { work_type: e.target.value });
              }}
              placeholder={t("program.customTypePlaceholder")}
              className={inputClass + " mt-1"}
            />
          )}
        </div>
      </div>

      {/* Note toggle */}
      <button
        type="button"
        onClick={() => setShowNote(!showNote)}
        className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1"
      >
        {showNote ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {t("program.note")}
      </button>
      {showNote && (
        <textarea
          value={exercise.note}
          onChange={(e) => onUpdate(exercise.id, { note: e.target.value })}
          rows={2}
          placeholder={t("program.notePlaceholder")}
          className={inputClass + " resize-none"}
        />
      )}
    </div>
  );
}

/* ── Main editor ── */
export default function ProgramEditor({ program, onBack, hideTitle = false }: {
  program: Program;
  onBack: () => void;
  hideTitle?: boolean;
}) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ProgramSessionWithExercises[]>([]);
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(program.title);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const refresh = useCallback(async () => {
    const data = await getProgramSessions(program.id);
    setSessions(data);
  }, [program.id]);

  useEffect(() => {
    Promise.all([refresh(), listCatalogExercises().then(setCatalog)]).finally(() => setLoading(false));
  }, [refresh]);

  /* ── Session actions ── */
  const handleAddSession = async () => {
    try {
      const newSession = await createSession(program.id, `${t("program.session")} ${sessions.length + 1}`, sessions.length);
      setSessions([...sessions, { ...newSession, exercises: [] }]);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdateSessionName = async (sessionId: string, name: string) => {
    setSessions(sessions.map((s) => s.id === sessionId ? { ...s, name } : s));
    try { await updateSession(sessionId, { name }); } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSessions(sessions.filter((s) => s.id !== sessionId));
    try { await deleteSession(sessionId); } catch (e: any) { toast.error(e.message); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sessions.findIndex((s) => s.id === active.id);
    const newIndex = sessions.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sessions, oldIndex, newIndex);
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }));
    setSessions(withOrder);
    try { await reorderSessions(withOrder.map((s) => ({ id: s.id, sort_order: s.sort_order }))); }
    catch (e: any) { toast.error(e.message); }
  };

  /* ── Exercise actions ── */
  const handleAddExercise = async (sessionId: string, catalogEx: CatalogExercise) => {
    setPickerSessionId(null);
    const session = sessions.find((s) => s.id === sessionId);
    const sortOrder = session?.exercises.length ?? 0;
    try {
      const newEx = await addExercise(sessionId, {
        session_id: sessionId,
        exercise_name: catalogEx.name,
        exercise_catalog_id: catalogEx.id,
        sets: "", reps: "", rest: "", work_type: "", note: "",
        sort_order: sortOrder,
      });
      setSessions(sessions.map((s) =>
        s.id === sessionId ? { ...s, exercises: [...s.exercises, newEx] } : s
      ));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdateExercise = async (exerciseId: string, updates: Partial<ProgramExercise>) => {
    setSessions(sessions.map((s) => ({
      ...s,
      exercises: s.exercises.map((ex) => ex.id === exerciseId ? { ...ex, ...updates } : ex),
    })));
    try { await updateExercise(exerciseId, updates); } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    setSessions(sessions.map((s) => ({
      ...s,
      exercises: s.exercises.filter((ex) => ex.id !== exerciseId),
    })));
    try { await deleteExercise(exerciseId); } catch (e: any) { toast.error(e.message); }
  };

  /* ── Save title ── */
  const handleSaveTitle = async () => {
    setSaving(true);
    try {
      await updateProgramTitle(program.id, title);
      toast.success(t("program.saved"));
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title (hidden when used from coach athlete view) */}
      {!hideTitle && (
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            className="flex-1 glass rounded-2xl px-4 py-3 text-lg font-black text-foreground outline-none focus:ring-1 focus:ring-primary"
            placeholder={t("program.titlePlaceholder")}
          />
          <button
            onClick={handleSaveTitle}
            disabled={saving}
            className="px-4 py-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save size={16} />
          </button>
        </div>
      )}

      {/* Sessions (sortable) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {sessions.map((session) => (
            <SortableSession key={session.id} id={session.id}>
              <GlassCard className="p-4 rounded-2xl space-y-3">
                {/* Session header */}
                <div className="flex items-center gap-2">
                  <input
                    value={session.name}
                    onChange={(e) => handleUpdateSessionName(session.id, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-black uppercase tracking-wider text-foreground outline-none placeholder:text-muted-foreground/40"
                    placeholder={t("program.sessionName")}
                  />
                  <button onClick={() => handleDeleteSession(session.id)} className="text-destructive/50 hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Exercises */}
                {session.exercises.map((ex) => (
                  <ExerciseRow
                    key={ex.id}
                    exercise={ex}
                    onUpdate={handleUpdateExercise}
                    onDelete={handleDeleteExercise}
                  />
                ))}

                {/* Add exercise */}
                <button
                  onClick={() => setPickerSessionId(session.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-[10px] font-black uppercase tracking-wider hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Plus size={14} /> {t("program.addExercise")}
                </button>
              </GlassCard>
            </SortableSession>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add session */}
      <button
        onClick={handleAddSession}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-xs font-black uppercase tracking-wider hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus size={16} /> {t("program.addSession")}
      </button>

      {/* Catalog picker */}
      <AnimatePresence>
        {pickerSessionId && (
          <CatalogPicker
            catalog={catalog}
            onSelect={(ex) => handleAddExercise(pickerSessionId, ex)}
            onClose={() => setPickerSessionId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
