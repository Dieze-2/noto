import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, XCircle, UserCheck, Play, Users, Clock, BarChart3, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import GlassCard from "@/components/GlassCard";
import { useRoles } from "@/auth/RoleProvider";
import { grantCoachTrial, getPendingCancellations, approveCancellation, CoachPlan, PLAN_CONFIG } from "@/db/coachSubscriptions";
import { createNotification } from "@/db/notifications";
import { getProfile, displayName } from "@/db/profiles";
import { getAdminStats, AdminStats, CoachRow } from "@/db/adminStats";
import { supabase } from "@/lib/supabaseClient";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";

interface EnrichedCancellation {
  coach_id: string;
  plan: CoachPlan;
  profileName: string;
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [cancellations, setCancellations] = useState<EnrichedCancellation[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const [trialEmail, setTrialEmail] = useState("");
  const [grantingTrial, setGrantingTrial] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [pendingCancels, adminStats] = await Promise.all([
      getPendingCancellations(),
      getAdminStats(),
    ]);

    const enrichedCancels = await Promise.all(
      pendingCancels.map(async (c) => {
        const profile = await getProfile(c.coach_id);
        return { ...c, profileName: profile ? displayName(profile) : c.coach_id.slice(0, 8) };
      })
    );

    setCancellations(enrichedCancels);
    setStats(adminStats);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const handleApproveCancellation = async (coachId: string) => {
    setActionId(coachId);
    try {
      await approveCancellation(coachId);
      const profile = await getProfile(coachId);
      const name = profile ? displayName(profile) : "";
      await createNotification({
        coach_id: coachId,
        type: "cancellation_approved",
        athlete_email: name,
        athlete_id: coachId,
      });
      toast.success(t("admin.cancellationApproved"));
      setCancellations((prev) => prev.filter((c) => c.coach_id !== coachId));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleGrantTrial = async () => {
    if (!trialEmail.trim()) return;
    setGrantingTrial(true);
    try {
      const { data: userId } = await supabase
        .rpc("get_user_id_by_email", { email_input: trialEmail.trim().toLowerCase() });

      if (!userId) {
        toast.error(t("admin.userNotFound"));
        setGrantingTrial(false);
        return;
      }

      await grantCoachTrial(userId);
      toast.success(t("admin.trialGranted"));
      setTrialEmail("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGrantingTrial(false);
    }
  };

  const getCoachStatus = (c: CoachRow): { label: string; className: string } => {
    const now = new Date();
    if (c.pending_cancellation) {
      return { label: t("admin.pendingCancel"), className: "bg-destructive/10 text-destructive" };
    }
    if (c.cancel_at) {
      return {
        label: t("admin.cancelScheduled", { date: format(new Date(c.cancel_at), "dd/MM", { locale: fr }) }),
        className: "bg-destructive/10 text-destructive",
      };
    }
    if (c.trial_end) {
      const trialDate = new Date(c.trial_end);
      if (trialDate > now) {
        const daysLeft = Math.ceil((trialDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7) {
          return { label: `${t("admin.trialExpiresSoon")} (${daysLeft}j)`, className: "bg-orange-500/10 text-orange-600" };
        }
        return { label: `${t("admin.trialActive")} (${daysLeft}j)`, className: "bg-blue-500/10 text-blue-600" };
      }
    }
    return { label: t("admin.subscribed"), className: "bg-emerald-500/10 text-emerald-600" };
  };

  if (rolesLoading) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20 text-center space-y-4">
        <Shield size={48} className="mx-auto text-muted-foreground/40" />
        <p className="text-sm font-bold text-muted-foreground">{t("admin.notAdmin")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
            <Shield size={22} />
          </div>
          <h1 className="text-noto-title text-2xl text-primary">{t("admin.title")}</h1>
          <p className="text-xs text-muted-foreground font-bold">{t("admin.subtitle")}</p>
        </div>

        {/* Stats Overview */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : stats && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                  {t("admin.statsOverview")}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <GlassCard className="p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-primary">{stats.totalCoaches}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("admin.totalCoaches")}</div>
                </GlassCard>
                <GlassCard className="p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-blue-500">{stats.activeTrials}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("admin.activeTrials")}</div>
                </GlassCard>
                <GlassCard className="p-4 rounded-2xl text-center col-span-2">
                  <div className="flex items-center justify-center gap-4">
                    {(["classic", "pro", "club"] as CoachPlan[]).map((plan) => (
                      <div key={plan} className="text-center">
                        <div className="text-lg font-black text-foreground">{stats.planBreakdown[plan]}</div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">{PLAN_CONFIG[plan].label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{t("admin.planBreakdown")}</div>
                </GlassCard>
              </div>
            </div>

            {/* Expiring Trials */}
            {stats.expiringTrials.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                    {t("admin.expiringTrials")}
                  </h2>
                  <span className="text-[10px] font-bold bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">
                    {stats.expiringTrials.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stats.expiringTrials.map((c) => (
                    <GlassCard key={c.coach_id} className="p-3 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 font-black text-xs">
                          {c.profileName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-foreground truncate">{c.profileName}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">
                            {t("admin.trialEndsOn", { date: format(new Date(c.trial_end!), "dd MMM yyyy", { locale: fr }) })}
                          </p>
                        </div>
                        <Clock size={14} className="text-orange-500" />
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            )}

            {/* Coaches Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                  {t("admin.coachList")}
                </h2>
              </div>
              {stats.coaches.length === 0 ? (
                <GlassCard className="p-8 rounded-2xl text-center">
                  <p className="text-sm font-bold text-muted-foreground">{t("admin.noCoaches")}</p>
                </GlassCard>
              ) : (
                <GlassCard className="rounded-2xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider">{t("admin.coachName")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider">{t("admin.plan")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">{t("admin.athletes")}</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider">{t("admin.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.coaches.map((c) => {
                        const status = getCoachStatus(c);
                        return (
                          <TableRow key={c.coach_id}>
                            <TableCell className="font-bold text-sm">{c.profileName}</TableCell>
                            <TableCell>
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-primary/5 text-primary">
                                {PLAN_CONFIG[c.plan].label}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-black text-sm">{c.athleteCount}</TableCell>
                            <TableCell>
                              <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${status.className}`}>
                                {status.label}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </GlassCard>
              )}
            </div>
          </>
        )}

        {/* Cancellation Requests */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-destructive" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
              {t("admin.cancellationRequests")}
            </h2>
            {cancellations.length > 0 && (
              <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                {cancellations.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : cancellations.length === 0 ? (
            <GlassCard className="p-8 rounded-2xl text-center">
              <p className="text-sm font-bold text-muted-foreground">{t("admin.noCancellations", "Aucune demande de résiliation en attente")}</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {cancellations.map((c, i) => (
                <motion.div key={c.coach_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <GlassCard className="p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive font-black text-sm">
                        {c.profileName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{c.profileName}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">
                          {t("admin.planLabel", { plan: c.plan.toUpperCase() })} · {t("admin.cancellationDesc")}
                        </p>
                      </div>
                      <button onClick={() => handleApproveCancellation(c.coach_id)} disabled={!!actionId}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50">
                        {actionId === c.coach_id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                        {t("admin.approveCancellation")}
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Grant Trial */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
              {t("admin.grantTrial")}
            </h2>
          </div>
          <GlassCard className="p-4 rounded-2xl">
            <p className="text-[10px] text-muted-foreground font-bold mb-3">{t("admin.grantTrialDesc")}</p>
            <div className="flex gap-2">
              <input type="email" value={trialEmail} onChange={(e) => setTrialEmail(e.target.value)}
                placeholder={t("admin.trialEmailPlaceholder")}
                className="flex-1 glass rounded-xl px-4 py-2.5 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40" />
              <button onClick={handleGrantTrial} disabled={grantingTrial || !trialEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50">
                {grantingTrial ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {t("admin.startTrial")}
              </button>
            </div>
          </GlassCard>
        </div>
      </motion.div>
    </div>
  );
}
