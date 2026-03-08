import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Check, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  CoachAthlete,
} from "@/db/coachAthletes";

export default function InvitationBanner() {
  const { t } = useTranslation();
  const [invitations, setInvitations] = useState<CoachAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await getMyInvitations();
      setInvitations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAccept = async (id: string) => {
    setActing(id);
    try {
      await acceptInvitation(id);
      toast.success(t("invitation.accepted"));
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      await rejectInvitation(id);
      toast.success(t("invitation.rejected"));
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActing(null);
    }
  };

  if (loading || invitations.length === 0) return null;

  return (
    <div className="px-4 pt-3 space-y-2">
      <AnimatePresence mode="popLayout">
        {invitations.map((inv) => (
          <motion.div
            key={inv.id}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -200 }}
            className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase tracking-wider text-foreground truncate">
                {t("invitation.coachInvite")}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold truncate">
                {t("invitation.from")} {inv.coach_id.slice(0, 8)}…
              </p>
            </div>
            {acting === inv.id ? (
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAccept(inv.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => handleReject(inv.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
