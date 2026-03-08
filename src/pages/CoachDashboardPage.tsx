import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Mail, ChevronRight, Eye,
  Loader2, Send, X, User, Crown, AlertTriangle, Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

import GlassCard from "@/components/GlassCard";
import CoachNotificationBell from "@/components/CoachNotificationBell";
import CoachStatsOverview from "@/components/CoachStatsOverview";
import { useRoles } from "@/auth/RoleProvider";
import {
  getCoachAthletes, inviteAthlete, removeAthlete, CoachAthlete,
} from "@/db/coachAthletes";
import { getProfiles, displayName, Profile } from "@/db/profiles";
import {
  canInviteAthlete, PLAN_CONFIG, CoachPlan,
  getCoachSubscription,
} from "@/db/coachSubscriptions";

export default function CoachDashboardPage() {
  const { t } = useTranslation();
  const { isCoach, loading: rolesLoading } = useRoles();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loadingData, setLoadingData] = useState(true);

  /* subscription state */
  const [currentPlan, setCurrentPlan] = useState<CoachPlan | null>(null);
  const [athleteCount, setAthleteCount] = useState(0);
  const [maxAllowed, setMaxAllowed] = useState(20);
  const [canInvite, setCanInvite] = useState(true);

  /* invite drawer */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);

  /* remove confirm */
  const [removeTarget, setRemoveTarget] = useState<CoachAthlete | null>(null);
  const [removing, setRemoving] = useState(false);

  const refresh = async () => {
    setLoadingData(true);
    const [a, inviteCheck] = await Promise.all([
      getCoachAthletes(),
      canInviteAthlete(),
    ]);
    setAthletes(a);
    setCanInvite(inviteCheck.allowed);
    setAthleteCount(inviteCheck.currentCount);
    setMaxAllowed(inviteCheck.maxAllowed);
    setCurrentPlan(inviteCheck.plan);

    // Fetch profiles for accepted athletes
    const athleteIds = a
      .filter((x) => x.status === "accepted" && x.athlete_id)
      .map((x) => x.athlete_id!);
    const profileList = await getProfiles(athleteIds);
    const map: Record<string, Profile> = {};
    profileList.forEach((p) => { map[p.id] = p; });
    setProfiles(map);

    setLoadingData(false);
  };

  useEffect(() => { if (isCoach) refresh(); }, [isCoach]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      // Re-check limit before inviting
      const check = await canInviteAthlete();
      if (!check.allowed) {
        toast.error(t("subscription.limitReached"));
        setCanInvite(false);
        setSending(false);
        return;
      }
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

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeAthlete(removeTarget.id);
      toast.success(t("coach.athleteRemoved"));
      setRemoveTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRemoving(false);
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
      <div className="mx-auto max-w-5xl px-4 pt-20 text-center space-y-4">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h1 className="text-noto-title text-2xl text-foreground">{t("coach.notCoach")}</h1>
        <p className="text-sm text-muted-foreground">{t("coach.notCoachDesc")}</p>
      </div>
    );
  }

  const accepted = athletes.filter((a) => a.status === "accepted");
  const pending = athletes.filter((a) => a.status === "pending");
  const planConfig = currentPlan ? PLAN_CONFIG[currentPlan] : PLAN_CONFIG.classic;
  const usagePercent = maxAllowed === Infinity ? 0 : Math.round((athleteCount / maxAllowed) * 100);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <h1 className="text-noto-title text-3xl text-primary text-center">
            {t("coach.title")}
          </h1>
          <CoachNotificationBell />
        </div>

        {/* ── Subscription banner ── */}
        <GlassCard className="p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Crown size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-foreground">
                  {t("subscription.plan")} {planConfig.label}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {planConfig.priceLabel}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                {t("subscription.usage", {
                  count: athleteCount,
                  max: maxAllowed === Infinity ? "∞" : maxAllowed,
                })}
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-colors"
            >
              {t("subscription.changePlan")}
            </button>
          </div>
          {/* Progress bar */}
          {maxAllowed !== Infinity && (
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent >= 90 ? "bg-destructive" : usagePercent >= 70 ? "bg-warning" : "bg-primary"
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
          )}
        </GlassCard>

        {/* ── Upgrade banner (when limit reached) ── */}
        {!canInvite && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-destructive/30 bg-destructive/5"
          >
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-foreground">
                {t("subscription.limitReached")}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold">
                {t("subscription.upgradeHint")}
              </p>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              {t("subscription.upgrade")}
            </button>
          </motion.div>
        )}

        {/* ── Stats Overview ── */}
        <CoachStatsOverview athletes={athletes} profiles={profiles} />

        {/* ── Invite button ── */}
        <button
          onClick={() => {
            if (!canInvite) {
              toast.error(t("subscription.limitReached"));
              return;
            }
            setInviteOpen(true);
          }}
          className={`w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left ${
            !canInvite ? "opacity-50" : ""
          }`}
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

        {/* ── My own profile (coach as athlete) ── */}
        {user && (
          <button
            onClick={() => navigate(`/coach/athlete/${user.id}`)}
            className="w-full flex items-center gap-3 p-4 rounded-2xl glass hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent-foreground">
              <User size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black uppercase tracking-wider text-foreground">{t("coach.myProfile")}</p>
              <p className="text-[10px] text-muted-foreground font-bold">{t("coach.myProfileDesc")}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/40" />
          </button>
        )}

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
              {accepted.map((a) => {
                const profile = a.athlete_id ? profiles[a.athlete_id] : null;
                const name = displayName(profile, a.invite_email ?? a.athlete_id ?? undefined);
                return (
                  <div key={a.id} className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/coach/athlete/${a.athlete_id}`)}
                      className="flex-1 flex items-center gap-3 p-3 rounded-xl glass hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Eye size={14} />
                      </div>
                      <span className="text-sm font-bold text-foreground flex-1 truncate">
                        {name}
                      </span>
                      <ChevronRight size={14} className="text-muted-foreground/40" />
                    </button>
                    <button
                      onClick={() => setRemoveTarget(a)}
                      className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={t("coach.removeAthlete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
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
                  <button
                    onClick={() => setRemoveTarget(a)}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t("coach.cancelInvite")}
                  >
                    <X size={12} />
                  </button>
                </div>
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
                    {/* Remaining slots info */}
                    <div className="text-[10px] font-bold text-muted-foreground text-center">
                      {(() => {
                        const remaining = maxAllowed === Infinity ? "∞" : String(maxAllowed - athleteCount);
                        return (t as any)("subscription.remainingSlots", { count: remaining });
                      })()}
                    </div>
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

      {/* ═══ Remove confirmation dialog ═══ */}
      <AnimatePresence>
        {removeTarget && (
          <>
            <motion.button
              type="button" aria-label="Close" onClick={() => setRemoveTarget(null)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            >
              <div className="w-full max-w-sm rounded-3xl border border-border glass shadow-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                    <AlertTriangle size={18} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    {removeTarget.status === "pending" ? t("coach.cancelInviteTitle") : t("coach.removeAthleteTitle")}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-bold">
                  {removeTarget.status === "pending"
                    ? t("coach.cancelInviteConfirm", { email: removeTarget.invite_email })
                    : t("coach.removeAthleteConfirm", { name: displayName(removeTarget.athlete_id ? profiles[removeTarget.athlete_id] : null, removeTarget.invite_email ?? undefined) })}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemoveTarget(null)}
                    className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-xs font-black uppercase tracking-wider hover:bg-muted/80 transition-colors"
                  >
                    {t("week.cancelLbl")}
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {removing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : t("coach.confirmRemove")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
