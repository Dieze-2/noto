import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Crown, Check, X, Loader2, Clock, UserCheck, UserX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import GlassCard from "@/components/GlassCard";
import { useRoles } from "@/auth/RoleProvider";
import {
  CoachRequest,
  getPendingCoachRequests,
  approveCoachRequest,
  rejectCoachRequest,
} from "@/db/coachRequests";
import { getProfile, displayName, Profile } from "@/db/profiles";
import { supabase } from "@/lib/supabaseClient";

interface EnrichedRequest extends CoachRequest {
  profileName: string;
  profileEmail: string;
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    const pending = await getPendingCoachRequests();

    // Enrich with profile info
    const enriched: EnrichedRequest[] = await Promise.all(
      pending.map(async (req) => {
        const profile = await getProfile(req.user_id);
        // Get email from auth (via profiles or fallback)
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", req.user_id)
          .maybeSingle();

        return {
          ...req,
          profileName: profile ? displayName(profile) : req.user_id.slice(0, 8),
          profileEmail: profile?.first_name
            ? `${profile.first_name} ${profile.last_name ?? ""}`.trim()
            : req.user_id.slice(0, 8),
        };
      })
    );

    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [isAdmin]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await approveCoachRequest(id);
      toast.success(t("admin.approved"));
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    try {
      await rejectCoachRequest(id);
      toast.success(t("admin.rejected"));
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
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
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
            <Shield size={22} />
          </div>
          <h1 className="text-noto-title text-2xl text-primary">{t("admin.title")}</h1>
          <p className="text-xs text-muted-foreground font-bold">{t("admin.subtitle")}</p>
        </div>

        {/* Coach Requests Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
              {t("admin.coachRequests")}
            </h2>
            {requests.length > 0 && (
              <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <GlassCard className="p-8 rounded-2xl text-center">
              <Clock size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-muted-foreground">{t("admin.noRequests")}</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {requests.map((req, i) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GlassCard className="p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                        {req.profileName.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground truncate">{req.profileName}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={!!actionId}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionId === req.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <UserCheck size={12} />
                          )}
                          {t("admin.approve")}
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={!!actionId}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          <UserX size={12} />
                          {t("admin.reject")}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
