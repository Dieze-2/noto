import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Dumbbell, ChevronDown } from "lucide-react";

interface ExercisePickerSheetProps {
  exercises: string[];
  selected: string;
  onSelect: (exercise: string) => void;
}

export default function ExercisePickerSheet({
  exercises,
  selected,
  onSelect,
}: ExercisePickerSheetProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = exercises.filter((ex) =>
    ex.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted border border-border text-sm font-bold text-foreground hover:border-primary/30 transition-colors w-full"
      >
        <Dumbbell size={14} className="text-primary shrink-0" />
        <span className="truncate flex-1 text-left">{selected || "Choisir…"}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.button
              type="button"
              aria-label="Fermer"
              onClick={() => { setOpen(false); setSearch(""); }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.08}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 600) {
                  setOpen(false);
                  setSearch("");
                }
              }}
              initial={{ y: 500 }}
              animate={{ y: 0 }}
              exit={{ y: 500 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed left-0 right-0 bottom-0 z-[70]"
            >
              <div className="mx-auto max-w-xl">
                <div className="rounded-t-[2rem] border border-border bg-card/95 backdrop-blur-2xl shadow-[0_-20px_60px_rgba(0,0,0,0.5)]">
                  {/* Header */}
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
                    <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                      Exercice
                    </h2>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); setSearch(""); }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Search */}
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
                      <Search size={14} className="text-muted-foreground shrink-0" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher…"
                        className="bg-transparent w-full text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* List */}
                  <div className="px-5 pb-6 max-h-[50vh] overflow-auto space-y-1">
                    {filtered.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        Aucun exercice trouvé
                      </p>
                    ) : (
                      filtered.map((ex) => {
                        const isActive = ex === selected;
                        return (
                          <button
                            key={ex}
                            type="button"
                            onClick={() => {
                              onSelect(ex);
                              setOpen(false);
                              setSearch("");
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                              isActive
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : "text-foreground hover:bg-muted border border-transparent"
                            }`}
                          >
                            {ex}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
