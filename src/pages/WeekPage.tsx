import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { startOfWeek, addDays, format, isToday, subDays, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/i18n/dateLocale";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  Footprints, Flame, Weight, ChevronLeft, ChevronRight,
  Sparkles, X, Pencil, Check, Ban, Trash2,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import GlassCard from "@/components/GlassCard";
import { getDailyMetricsRange, DailyMetrics } from "@/db/dailyMetrics";
import {
  getEventsOverlappingRange, createEvent, updateEvent, deleteEvent,
  EventRow,
} from "@/db/events";
import { getUserGoals, UserGoals } from "@/db/goals";

/* ── Constants ── */
const EVENT_COLORS = [
  "#00FFA3", "#FF6B6B", "#FFA94D", "#FFD43B", "#74C0FC",
  "#4DABF7", "#B197FC", "#63E6BE", "#A9E34B", "#F783AC",
] as const;
const MAX_DOTS = 4;

/* ── Helpers ── */
function isHex6(x: string | null | undefined): x is string {
  return typeof x === "string" && /^#[0-9A-Fa-f]{6}$/.test(x);
}
function normalizeHex(x: string) { return x.toUpperCase(); }
function toISO(d: Date) { return format(d, "yyyy-MM-dd"); }

type EditState = {
  id: string; title: string; start_date: string; end_date: string; color: string;
};

/* ── SwipeDeleteEventRow ── */
function SwipeDeleteEventRow({ ev, isEditing, onDelete, children }: {
  ev: EventRow; isEditing: boolean; onDelete: (id: string) => void; children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, 0], [1, 0]);

  if (isEditing) {
    return (
      <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -80 }} className="relative">
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 bg-destructive rounded-3xl flex items-center justify-end px-6">
        <Trash2 size={18} className="text-destructive-foreground" />
      </motion.div>
      <motion.div drag="x" dragConstraints={{ left: -120, right: 0 }} style={{ x }}
        onDragEnd={(_, info) => { if (info.offset.x < -70) onDelete(ev.id); }}
        className="relative">
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   WEEK PAGE
   ════════════════════════════════════════════ */
export default function WeekPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [anchorDate, setAnchorDate] = useState(new Date());
  const [currentWeekData, setCurrentWeekData] = useState<DailyMetrics[]>([]);
  const [prevWeekData, setPrevWeekData] = useState<DailyMetrics[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [goals, setGoals] = useState<UserGoals | null>(null);

  /* ── Drawer NOTE state ── */
  const [noteOpen, setNoteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(EVENT_COLORS[0]);
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [allEvents, setAllEvents] = useState<EventRow[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);

  /* ── Deep-link ?note=1 ── */
  useEffect(() => {
    if (searchParams.get("note") === "1") setNoteOpen(true);
  }, [searchParams]);

  /* ── Week computation ── */
  const start = useMemo(() => startOfWeek(anchorDate, { weekStartsOn: 1 }), [anchorDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const startStr = useMemo(() => format(days[0], "yyyy-MM-dd"), [days]);
  const endStr = useMemo(() => format(days[6], "yyyy-MM-dd"), [days]);

  /* ── Data loading ── */
  async function refreshWeek() {
    const [cur, prev, evs] = await Promise.all([
      getDailyMetricsRange(startStr, endStr),
      getDailyMetricsRange(format(subDays(start, 7), "yyyy-MM-dd"), format(subDays(start, 1), "yyyy-MM-dd")),
      getEventsOverlappingRange(startStr, endStr),
    ]);
    setCurrentWeekData(cur);
    setPrevWeekData(prev);
    setEvents(evs);
  }

  async function refreshAllEvents() {
    const evs = await getEventsOverlappingRange("2020-01-01", "2030-12-31");
    setAllEvents(evs.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()));
  }

  async function refreshAll() {
    await Promise.all([refreshAllEvents(), refreshWeek()]);
  }

  useEffect(() => { refreshWeek().catch(() => {}); }, [startStr, endStr]);
  useEffect(() => { refreshAllEvents().catch(() => {}); }, []);
  useEffect(() => { getUserGoals().then(setGoals).catch(() => {}); }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setEditing(null); closeNoteDrawer(); }
    }
    if (noteOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noteOpen]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const getAvg = (data: DailyMetrics[], field: "steps" | "kcal" | "weight_g") => {
      const vals = data.map((d) => (d[field] as number) || 0).filter((v) => v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const curW = getAvg(currentWeekData, "weight_g") / 1000;
    const prevW = getAvg(prevWeekData, "weight_g") / 1000;
    return {
      weight: curW,
      steps: Math.round(getAvg(currentWeekData, "steps")),
      kcal: Math.round(getAvg(currentWeekData, "kcal")),
      variation: prevW ? ((curW - prevW) / prevW) * 100 : 0,
    };
  }, [currentWeekData, prevWeekData]);

  /* ── Drawer helpers ── */
  function openNoteDrawer() {
    setRange(undefined);
    setNoteOpen(true);
    const sp = new URLSearchParams(searchParams);
    sp.set("note", "1");
    setSearchParams(sp, { replace: true });
  }
  function closeNoteDrawer() {
    setEditing(null);
    setNoteOpen(false);
    const sp = new URLSearchParams(searchParams);
    sp.delete("note");
    setSearchParams(sp, { replace: true });
  }

  async function handleSwipeDeleteEvent(id: string) {
    setAllEvents((prev) => prev.filter((e) => e.id !== id));
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try { await deleteEvent(id); await refreshAll(); } catch { await refreshAll(); }
  }

  const canCreate = Boolean(title.trim()) && Boolean(range?.from) && Boolean(range?.to);
  const fromISO = range?.from ? toISO(range.from) : "";
  const toISOValue = range?.to ? toISO(range.to) : "";

  /* ═══ RENDER ═══ */
  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-32 lg:pb-8">
      {/* ── Header ── */}
      <header className="flex flex-col items-center mb-8">
        <motion.div
          drag="x" dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 50) setAnchorDate(subDays(anchorDate, 7));
            if (info.offset.x < -50) setAnchorDate(addDays(anchorDate, 7));
          }}
          className="flex items-center justify-between w-full glass py-4 rounded-3xl"
        >
          <button onClick={() => setAnchorDate(subDays(anchorDate, 7))} className="p-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft size={28} />
          </button>
          <div className="text-center">
            <h1 className="text-noto-title text-3xl text-primary">{t("week.title")}</h1>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              {t("week.from")} {format(start, "d MMMM", { locale: getDateLocale() })}
            </p>
          </div>
          <button onClick={() => setAnchorDate(addDays(anchorDate, 7))} className="p-2 text-muted-foreground hover:text-foreground">
            <ChevronRight size={28} />
          </button>
        </motion.div>
      </header>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <GlassCard className="p-6 text-center relative overflow-hidden">
          <Weight size={20} className="text-metric-weight mx-auto mb-2" />
          <p className="text-2xl font-black text-foreground">
            {stats.weight ? stats.weight.toFixed(1) : "--"}kg
          </p>
          <div className={`mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-tight ${
            stats.variation > 0 ? "bg-muted text-destructive" : "bg-muted text-primary"
          }`}>
            {stats.variation > 0 ? "▲" : "▼"} {stats.variation > 0 ? "+" : ""}{stats.variation.toFixed(2)}%
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="space-y-4">
            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Footprints size={16} className="text-metric-steps" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("week.steps")}</span>
                </div>
                <span className="text-sm font-black text-foreground">
                  {stats.steps.toLocaleString()}
                  {goals?.target_steps ? (
                    <span className="text-muted-foreground font-bold text-[10px] ml-1">/ {goals.target_steps.toLocaleString()}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: "hsl(var(--metric-steps))" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goals?.target_steps ? Math.min((stats.steps / goals.target_steps) * 100, 100) : 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Calories */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Flame size={16} className="text-metric-kcal" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("week.calories")}</span>
                </div>
                <span className="text-sm font-black text-foreground">
                  {stats.kcal.toLocaleString()}
                  {goals?.target_kcal ? (
                    <span className="text-muted-foreground font-bold text-[10px] ml-1">/ {goals.target_kcal.toLocaleString()}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: "hsl(var(--metric-kcal))" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goals?.target_kcal ? Math.min((stats.kcal / goals.target_kcal) * 100, 100) : 0}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Day cards ── */}
      <div className="space-y-3">
        {days.map((day) => {
          const dStr = format(day, "yyyy-MM-dd");
          const m = currentWeekData.find((x) => x.date === dStr);
          const dayEvents = events.filter((e) => dStr >= e.start_date && dStr <= e.end_date);
          const isT = isToday(day);

          return (
            <GlassCard
              key={dStr}
              as="button"
              onClick={() => navigate(`/?date=${dStr}`)}
              className={`flex items-center justify-between p-4 border-l-4 transition-all w-full text-left ${
                isT ? "border-primary bg-primary/5" : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${
                  isT ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
                }`}>
                  <span className="text-[9px] uppercase leading-none">{format(day, "EEE", { locale: getDateLocale() })}</span>
                  <span className="text-lg leading-none">{format(day, "d")}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-black uppercase italic text-sm text-foreground flex items-center">
                    {format(day, "EEEE", { locale: getDateLocale() })}
                    {dayEvents.length > 0 && (
                      <Sparkles size={12} className="ml-2"
                        style={{ color: isHex6(dayEvents[0].color) ? dayEvents[0].color! : "#FFA94D" }} />
                    )}
                  </p>
                  <div className="mt-1">
                    {dayEvents.length > 0 && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); openNoteDrawer(); }} className="w-full text-left">
                        <div className="flex flex-col gap-1">
                          {dayEvents.slice(0, MAX_DOTS).map((ev) => {
                            const c = isHex6(ev.color) ? ev.color! : "#FFFFFF";
                            return (
                              <div key={ev.id} className="flex items-center gap-2">
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
                    <div className="flex gap-4 mt-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        <Footprints size={12} className={m?.steps ? "text-metric-steps" : "text-muted-foreground/20"} />
                        <span className="text-muted-foreground">{m?.steps || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        <Flame size={12} className={m?.kcal ? "text-metric-kcal" : "text-muted-foreground/20"} />
                        <span className="text-muted-foreground">{m?.kcal || 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold">
                        <Weight size={12} className={m?.weight_g ? "text-metric-weight" : "text-muted-foreground/20"} />
                        <span className="text-muted-foreground">{m?.weight_g ? (m.weight_g / 1000).toFixed(1) : "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/40" />
            </GlassCard>
          );
        })}
      </div>

      {/* ── NOTE button ── */}
      <div className="mt-8">
        <button type="button" onClick={openNoteDrawer}
          className="w-full py-4 glass rounded-2xl font-black uppercase italic text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          {t("week.note")}
        </button>
      </div>

      {/* ═══ DRAWER NOTE / PLANNING ═══ */}
      <AnimatePresence>
        {noteOpen && (
          <>
            <motion.button type="button" aria-label="Fermer" onClick={closeNoteDrawer}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm" />
            <motion.div
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.08}
              onDragEnd={(_, info) => { if (info.offset.y > 90 || info.velocity.y > 600) closeNoteDrawer(); }}
              initial={{ y: 700 }} animate={{ y: 0 }} exit={{ y: 700 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed left-0 right-0 bottom-0 z-[70]"
            >
              <div className="mx-auto max-w-xl">
                <div className="rounded-t-[2.5rem] border border-border glass shadow-[0_-30px_80px_rgba(0,0,0,0.75)]">
                  {/* Handle */}
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
                    <div className="w-12 h-1.5 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                    <h2 className="text-sm font-black uppercase italic tracking-widest text-muted-foreground">{t("week.planning")}</h2>
                    <button type="button" onClick={closeNoteDrawer} className="p-2 text-muted-foreground hover:text-foreground">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="px-5 pb-6 max-h-[75vh] overflow-auto space-y-6">
                    {/* ── CREATE FORM ── */}
                    <GlassCard className="p-6 rounded-[2.5rem] space-y-4 border-b-4 border-primary">
                      <input
                        placeholder={t("week.eventName")}
                        value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full glass rounded-2xl px-4 py-3 text-xl font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                      />

                      {/* Color picker */}
                      <div>
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-2">{t("week.color")}</p>
                        <div className="flex flex-wrap gap-2">
                          {EVENT_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => setSelectedColor(c)}
                              className={`w-10 h-10 rounded-full border transition-all ${
                                normalizeHex(selectedColor) === normalizeHex(c) ? "border-foreground scale-110" : "border-border"
                              }`}
                              style={{ backgroundColor: c }} aria-label={`Choisir ${c}`} />
                          ))}
                        </div>
                      </div>

                      {/* Date picker */}
                      <div className="glass rounded-3xl p-4">
                        <DayPicker
                          mode="range" selected={range} onSelect={setRange}
                          locale={getDateLocale()} weekStartsOn={1} fixedWeeks showOutsideDays
                          className="text-foreground pointer-events-auto"
                          classNames={{
                            months: "flex flex-col",
                            month: "space-y-3",
                            caption: "flex items-center justify-between px-1",
                            caption_label: "text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground",
                            nav: "flex items-center gap-2",
                            nav_button: "w-9 h-9 rounded-full glass text-muted-foreground hover:text-foreground",
                            table: "w-full border-collapse",
                            head_row: "grid grid-cols-7",
                            head_cell: "text-[9px] font-black uppercase text-muted-foreground/40 text-center py-2",
                            row: "grid grid-cols-7",
                            cell: "text-center p-1",
                            day: "w-10 h-10 rounded-2xl font-black uppercase italic text-[11px] text-foreground/70 hover:bg-muted",
                            day_today: "ring-2 ring-primary/60",
                            day_selected: "bg-primary text-primary-foreground",
                            day_range_start: "bg-primary text-primary-foreground",
                            day_range_end: "bg-primary text-primary-foreground",
                            day_range_middle: "bg-primary/20 text-foreground",
                            day_outside: "text-muted-foreground/20",
                            day_disabled: "text-muted-foreground/20",
                          }}
                        />
                        <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>{t("week.fromDate")}: {fromISO || "--"}</span>
                          <span>{t("week.toDate")}: {toISOValue || "--"}</span>
                        </div>
                      </div>

                      <button type="button" disabled={!canCreate}
                        onClick={async () => {
                          if (!title.trim() || !range?.from || !range?.to) return;
                          if (!EVENT_COLORS.map(normalizeHex).includes(normalizeHex(selectedColor))) return;
                          await createEvent({
                            title: title.trim(),
                            start_date: toISO(range.from),
                            end_date: toISO(range.to),
                            color: normalizeHex(selectedColor),
                          });
                          setTitle(""); setRange(undefined);
                          await refreshAll();
                          closeNoteDrawer();
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors ${
                          canCreate ? "bg-primary text-primary-foreground" : "glass text-muted-foreground border border-border"
                        }`}>
                        {t("week.addToCalendar")}
                      </button>
                    </GlassCard>

                    {/* ── EVENT LIST ── */}
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {allEvents.map((ev) => {
                          const c = isHex6(ev.color) ? normalizeHex(ev.color!) : "#FFFFFF";
                          const isEditingThis = editing?.id === ev.id;

                          return (
                            <SwipeDeleteEventRow key={ev.id} ev={ev} isEditing={isEditingThis} onDelete={handleSwipeDeleteEvent}>
                              <GlassCard className="p-5 rounded-3xl border-l-4" style={{ borderLeftColor: c }}>
                                {!isEditingThis ? (
                                  /* ── View mode ── */
                                  <div className="flex justify-between items-center gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                                        <p className="font-black text-foreground text-lg uppercase italic truncate">{ev.title}</p>
                                      </div>
                                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 italic">
                                        {format(parseISO(ev.start_date), "d MMM", { locale: getDateLocale() })} —{" "}
                                        {format(parseISO(ev.end_date), "d MMM yyyy", { locale: getDateLocale() })}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button type="button"
                                        onClick={() => setEditing({ id: ev.id, title: ev.title, start_date: ev.start_date, end_date: ev.end_date, color: c })}
                                        className="w-10 h-10 rounded-full glass flex items-center justify-center text-muted-foreground"
                                        aria-label="Éditer">
                                        <Pencil size={16} />
                                      </button>
                                      <button type="button"
                                        onClick={async () => { if (!confirm(t("week.deleteConfirm"))) return; await handleSwipeDeleteEvent(ev.id); }}
                                        className="text-destructive font-black text-[10px] uppercase px-2 py-2">
                                        {t("week.delete")}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* ── Edit mode ── */
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <input value={editing!.title}
                                        onChange={(e) => setEditing({ ...editing!, title: e.target.value })}
                                        className="w-full glass rounded-2xl px-4 py-3 font-black uppercase italic text-foreground outline-none focus:ring-1 focus:ring-primary" />
                                      <div className="flex gap-2">
                                        <button type="button"
                                          onClick={async () => {
                                            if (!editing) return;
                                            const patchTitle = editing.title.trim();
                                            if (!patchTitle || editing.end_date < editing.start_date) return;
                                            if (!EVENT_COLORS.map(normalizeHex).includes(normalizeHex(editing.color))) return;
                                            await updateEvent(editing.id, {
                                              title: patchTitle, start_date: editing.start_date,
                                              end_date: editing.end_date, color: normalizeHex(editing.color),
                                            });
                                            setEditing(null); await refreshAll();
                                          }}
                                          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                                          aria-label="Sauver">
                                          <Check size={16} />
                                        </button>
                                        <button type="button" onClick={() => setEditing(null)}
                                          className="w-10 h-10 rounded-full glass text-muted-foreground flex items-center justify-center"
                                          aria-label="Annuler">
                                          <Ban size={16} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Color picker */}
                                    <div>
                                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-2">{t("week.color")}</p>
                                      <div className="flex flex-wrap gap-2">
                                        {EVENT_COLORS.map((col) => (
                                          <button key={col} type="button"
                                            onClick={() => setEditing({ ...editing!, color: col })}
                                            className={`w-10 h-10 rounded-full border transition-all ${
                                              normalizeHex(editing!.color) === normalizeHex(col) ? "border-foreground scale-110" : "border-border"
                                            }`}
                                            style={{ backgroundColor: col }} aria-label={`Choisir ${col}`} />
                                        ))}
                                      </div>
                                    </div>

                                    {/* Date inputs */}
                                    <div className="glass rounded-2xl overflow-hidden divide-x divide-border flex items-center">
                                      <div className="flex-1 p-4">
                                        <label className="text-[8px] font-black text-muted-foreground uppercase block mb-1">Du</label>
                                        <input type="date" value={editing!.start_date} max={editing!.end_date || undefined}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setEditing((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, start_date: v };
                                              if (next.end_date && v > next.end_date) next.end_date = v;
                                              return next;
                                            });
                                          }}
                                          className="bg-transparent w-full text-xs text-foreground outline-none" />
                                      </div>
                                      <div className="flex-1 p-4 text-right">
                                        <label className="text-[8px] font-black text-muted-foreground uppercase block mb-1">Au</label>
                                        <input type="date" value={editing!.end_date} min={editing!.start_date || undefined}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setEditing((prev) => {
                                              if (!prev) return prev;
                                              const next = { ...prev, end_date: v };
                                              if (next.start_date && v < next.start_date) next.start_date = v;
                                              return next;
                                            });
                                          }}
                                          className="bg-transparent w-full text-xs text-foreground outline-none text-right" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </GlassCard>
                            </SwipeDeleteEventRow>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                    <div className="h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
