import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, StickyNote, BookOpen } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { listCatalogExercises, CatalogExercise } from "@/db/catalog";
import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogPage() {
  const [allExercises, setAllExercises] = useState<CatalogExercise[]>([]);
  const [filtered, setFiltered] = useState<CatalogExercise[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCatalogExercises()
      .then((data) => {
        setAllExercises(data);
        setFiltered(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(allExercises.filter((ex) => ex.name.toLowerCase().includes(q)));
  }, [search, allExercises]);

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-6">
          <BookOpen size={22} className="text-primary" />
          <h1 className="text-noto-title text-3xl text-primary">Catalogue</h1>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-3 mb-6 border border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            placeholder="Rechercher un exercice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent w-full text-sm text-foreground outline-none placeholder:text-muted-foreground font-bold"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-16">
            {search ? "Aucun exercice trouvé" : "Catalogue vide"}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((ex) => {
                const isExpanded = expandedId === ex.id;
                return (
                  <motion.div
                    key={ex.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <GlassCard className="overflow-hidden">
                      <div className="p-5 flex items-center justify-between">
                        <h3 className="font-black text-lg uppercase text-foreground tracking-tight">
                          {ex.name}
                        </h3>
                        <div className="flex gap-2">
                          {ex.note && (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                isExpanded
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:text-foreground"
                              }`}
                              aria-label="Voir la note"
                            >
                              <StickyNote size={14} />
                            </button>
                          )}
                          {ex.youtube_url && (
                            <a
                              href={ex.youtube_url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
                              aria-label="Voir la vidéo"
                            >
                              <Play size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && ex.note && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 text-xs text-muted-foreground leading-relaxed">
                              {ex.note}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
