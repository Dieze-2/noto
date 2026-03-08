import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, Plus, Trash2, Save, ClipboardList, GripVertical,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import GlassCard from "@/components/GlassCard";
import { useRoles } from "@/auth/RoleProvider";
import {
  getCoachPrograms, getMyPrograms, createProgram,
  updateProgram, deleteProgram, Program, ProgramBlock,
} from "@/db/programs";
import { getCoachAthletes, CoachAthlete } from "@/db/coachAthletes";

/* ── Program editor (coach) ── */
function ProgramEditor({ program, onSave, onDelete }: {
  program: Program;
  onSave: (p: Program) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(program.title);
  const [blocks, setBlocks] = useState<ProgramBlock[]>(program.content ?? []);
  const [saving, setSaving] = useState(false);

  const addBlock = () => {
    setBlocks([...blocks, { id: crypto.randomUUID(), type: "text", content: "" }]);
  };

  const updateBlock = (id: string, content: string) => {
    setBlocks(blocks.map((b) => b.id === id ? { ...b, content } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProgram(program.id, { title, content: blocks });
      onSave({ ...program, title, content: blocks });
      toast.success(t("program.saved"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full glass rounded-2xl px-4 py-3 text-lg font-black text-foreground outline-none focus:ring-1 focus:ring-primary"
        placeholder={t("program.titlePlaceholder")}
      />

      {blocks.map((block) => (
        <div key={block.id} className="flex gap-2 items-start">
          <div className="pt-3 text-muted-foreground/30">
            <GripVertical size={14} />
          </div>
          <textarea
            value={block.content}
            onChange={(e) => updateBlock(block.id, e.target.value)}
            rows={3}
            className="flex-1 glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/40"
            placeholder={t("program.blockPlaceholder")}
          />
          <button onClick={() => removeBlock(block.id)} className="pt-3 text-destructive/60 hover:text-destructive">
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={addBlock}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground text-xs font-black uppercase tracking-wider hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus size={16} /> {t("program.addBlock")}
      </button>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? t("program.saving") : t("program.save")}
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-black uppercase tracking-wider hover:bg-destructive/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* ── Program viewer (athlete) ── */
function ProgramViewer({ program }: { program: Program }) {
  const blocks = program.content ?? [];
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black text-foreground">{program.title}</h2>
      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        blocks.map((block) => (
          <GlassCard key={block.id} className="p-4 rounded-2xl">
            <p className="text-sm text-foreground whitespace-pre-wrap">{block.content}</p>
          </GlassCard>
        ))
      )}
    </div>
  );
}

/* ── Main page ── */
export default function ProgramPage() {
  const { t } = useTranslation();
  const { isCoach } = useRoles();
  const navigate = useNavigate();
  const { programId } = useParams<{ programId: string }>();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [selected, setSelected] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);

  /* new program state */
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAthleteId, setNewAthleteId] = useState("");

  const refresh = async () => {
    setLoading(true);
    if (isCoach) {
      const [p, a] = await Promise.all([getCoachPrograms(), getCoachAthletes()]);
      setPrograms(p);
      setAthletes(a.filter((x) => x.status === "accepted"));
    } else {
      const p = await getMyPrograms();
      setPrograms(p);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [isCoach]);

  useEffect(() => {
    if (programId && programs.length > 0) {
      const found = programs.find((p) => p.id === programId);
      if (found) setSelected(found);
    }
  }, [programId, programs]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newAthleteId) return;
    setCreating(true);
    try {
      const p = await createProgram(newAthleteId, newTitle.trim());
      setNewTitle("");
      setNewAthleteId("");
      await refresh();
      setSelected(p);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProgram(id);
      setSelected(null);
      toast.success(t("program.deleted"));
      refresh();
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

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {selected ? (
          <>
            <button
              onClick={() => { setSelected(null); navigate("/program"); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} /> {t("program.backToList")}
            </button>

            {isCoach ? (
              <ProgramEditor
                program={selected}
                onSave={(p) => setSelected(p)}
                onDelete={() => handleDelete(selected.id)}
              />
            ) : (
              <ProgramViewer program={selected} />
            )}
          </>
        ) : (
          <>
            <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
              {t("program.title")}
            </h1>

            {/* Coach: create program */}
            {isCoach && (
              <GlassCard className="p-5 rounded-3xl space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t("program.newProgram")}
                </p>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t("program.titlePlaceholder")}
                  className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                />
                {athletes.length > 0 && (
                  <select
                    value={newAthleteId}
                    onChange={(e) => setNewAthleteId(e.target.value)}
                    className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary bg-transparent"
                  >
                    <option value="">{t("program.selectAthlete")}</option>
                    {athletes.map((a) => (
                      <option key={a.id} value={a.athlete_id!}>
                        {a.invite_email ?? a.athlete_id}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim() || !newAthleteId}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
                >
                  <Plus size={16} /> {creating ? t("program.creating") : t("program.create")}
                </button>
              </GlassCard>
            )}

            {/* Program list */}
            {programs.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("program.empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {programs.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelected(p); navigate(`/program/${p.id}`); }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
                  >
                    <ClipboardList size={16} className="text-primary" />
                    <span className="text-sm font-bold text-foreground flex-1 truncate">{p.title}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
