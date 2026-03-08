import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Mail, ChevronRight, Eye,
  ClipboardList, Loader2, Send, X, Plus, ArrowLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import GlassCard from "@/components/GlassCard";
import { useRoles } from "@/auth/RoleProvider";
import {
  getCoachAthletes, inviteAthlete, CoachAthlete,
} from "@/db/coachAthletes";
import {
  getCoachPrograms, createProgram, deleteProgram, Program,
} from "@/db/programs";
import ProgramEditor from "@/components/ProgramEditor";
import { getProfiles, formatName, Profile } from "@/db/profiles";

export default function CoachDashboardPage() {
  const { t } = useTranslation();
  const { isCoach, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [athleteProfiles, setAthleteProfiles] = useState<Record<string, Profile>>({});
  const [loadingData, setLoadingData] = useState(true);

  /* invite drawer */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);

  /* program editor */
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  /* new program */
  const [newTitle, setNewTitle] = useState("");
  const [newAthleteId, setNewAthleteId] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoadingData(true);
    const [a, p] = await Promise.all([getCoachAthletes(), getCoachPrograms()]);
    setAthletes(a);
    setPrograms(p);
    // Fetch athlete profiles
    const ids = a.filter((x) => x.athlete_id).map((x) => x.athlete_id!);
    if (ids.length) {
      const profiles = await getProfiles(ids);
      const map: Record<string, Profile> = {};
      profiles.forEach((pr) => { map[pr.id] = pr; });
      setAthleteProfiles(map);
    }
    setLoadingData(false);
  };

  useEffect(() => { if (isCoach) refresh(); }, [isCoach]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await inviteAthlete(inviteEmail.trim());
      toast.success(t("coach.inviteSent"));
      setInviteEmail("");
      setInviteOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newAthleteId) return;
    setCreating(true);
    try {
      const p = await createProgram(newAthleteId, newTitle.trim());
      setNewTitle("");
      setNewAthleteId("");
      await refresh();
      setEditingProgram(p);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProgram(id);
      setEditingProgram(null);
      toast.success(t("program.deleted"));
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isCoach) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center space-y-4">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-noto-title text-2xl text-foreground">{t("coach.notCoach")}</h1>
        <p className="text-sm text-muted-foreground">{t("coach.notCoachDesc")}</p>
      </div>
    );
  }

  const accepted = athletes.filter((a) => a.status === "accepted");
  const pending = athletes.filter((a) => a.status === "pending");

  /* ── If editing a program ── */
  if (editingProgram) {
    return (
      <div className="mx-auto max-w-md px-4 pt-6 pb-32">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setEditingProgram(null); refresh(); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} /> {t("program.backToList")}
            </button>
            <button
              onClick={() => handleDelete(editingProgram.id)}
              className="text-xs font-black uppercase tracking-wider text-destructive/60 hover:text-destructive"
            >
              {t("program.deleteProgram")}
            </button>
          </div>
          <ProgramEditor program={editingProgram} onBack={() => { setEditingProgram(null); refresh(); }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <h1 className="text-noto-title text-3xl text-primary text-center mb-6">
          {t("coach.title")}
        </h1>

        {/* ── Invite button ── */}
        <button
          onClick={() => setInviteOpen(true)}
          className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <UserPlus size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("coach.inviteAthlete")}</p>
            <p className="text-[10px] text-muted-foreground font-bold">{t("coach.inviteDesc")}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground/40" />
        </button>

        {/* ── Athletes ── */}
        <GlassCard className="p-5 rounded-3xl">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-primary" />
            <h2 className="text-noto-label text-foreground flex-1">
              {t("coach.myAthletes")} ({accepted.length})
            </h2>
          </div>

          {loadingData ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accepted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noAthletes")}</p>
          ) : (
            <div className="space-y-2">
              {accepted.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/coach/athlete/${a.athlete_id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Eye size={14} />
                  </div>
                  <span className="text-sm font-bold text-foreground flex-1 truncate">
                    {a.athlete_id && athleteProfiles[a.athlete_id] ? formatName(athleteProfiles[a.athlete_id]) : a.invite_email ?? a.athlete_id}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground/40" />
                </button>
              ))}
            </div>
          )}

          {pending.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                {t("coach.pendingInvites")} ({pending.length})
              </p>
              {pending.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-2">
                  <Mail size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground flex-1 truncate">{a.invite_email}</span>
                  <span className="text-[10px] font-bold uppercase text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                    {t("coach.pending")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* ── Programs ── */}
        <GlassCard className="p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            <h2 className="text-noto-label text-foreground flex-1">{t("coach.programs")}</h2>
          </div>

          {/* Create form */}
          <div className="space-y-2 p-3 rounded-2xl bg-muted/30 border border-border/50">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t("program.newProgram")}
            </p>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("program.titlePlaceholder")}
              className="w-full glass rounded-xl px-3 py-2 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
            />
            {accepted.length > 0 && (
              <select
                value={newAthleteId}
                onChange={(e) => setNewAthleteId(e.target.value)}
                className="w-full glass rounded-xl px-3 py-2 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary bg-transparent"
              >
                <option value="">{t("program.selectAthlete")}</option>
                {accepted.map((a) => (
                  <option key={a.id} value={a.athlete_id!}>
                    {a.athlete_id && athleteProfiles[a.athlete_id] ? formatName(athleteProfiles[a.athlete_id]) : a.invite_email ?? a.athlete_id}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim() || !newAthleteId}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
            >
              <Plus size={14} /> {creating ? t("program.creating") : t("program.create")}
            </button>
          </div>

          {/* Program list */}
          {programs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("coach.noPrograms")}</p>
          ) : (
            <div className="space-y-2">
              {programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setEditingProgram(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm font-bold text-foreground flex-1 truncate">{p.title}</span>
                  <ChevronRight size={14} className="text-muted-foreground/40" />
                </button>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ Invite drawer ═══ */}
      <AnimatePresence>
        {inviteOpen && (
          <>
            <motion.button
              type="button" aria-label="Close" onClick={() => setInviteOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed left-0 right-0 bottom-0 z-[70]"
            >
              <div className="mx-auto max-w-xl">
                <div className="rounded-t-[2.5rem] border border-border glass shadow-[0_-30px_80px_rgba(0,0,0,0.75)]">
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between relative">
                    <div className="w-12 h-1.5 rounded-full bg-muted mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
                    <h2 className="text-sm font-black uppercase italic tracking-widest text-muted-foreground">
                      {t("coach.inviteAthlete")}
                    </h2>
                    <button type="button" onClick={() => setInviteOpen(false)} className="p-2 text-muted-foreground hover:text-foreground">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-5 pb-6 space-y-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        <Mail size={12} /> {t("coach.athleteEmail")}
                      </label>
                      <input
                        type="email" placeholder="athlete@email.com"
                        value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full glass rounded-2xl px-4 py-3 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <button
                      onClick={handleInvite}
                      disabled={sending || !inviteEmail.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Send size={16} />
                      {sending ? t("coach.sending") : t("coach.sendInvite")}
                    </button>
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
