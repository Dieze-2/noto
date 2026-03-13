import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, X, UserCheck, UserX, Crown, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getCoachNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllReadNotifications,
  CoachNotification,
} from "@/db/notifications";
import { formatDistanceToNow } from "date-fns";
import { fr, es, enUS } from "date-fns/locale";
import i18n from "@/i18n";

const dateLocales: Record<string, typeof fr> = { fr, es, en: enUS };

export default function CoachNotificationBell() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<CoachNotification[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const data = await getCoachNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkOne = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearRead = async () => {
    await deleteAllReadNotifications();
    setNotifications((prev) => prev.filter((n) => !n.read));
  };

  const lang = i18n.language?.slice(0, 2) ?? "fr";
  const dateLoc = dateLocales[lang] ?? fr;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-black">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[50]"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-[51] w-80 max-h-96 overflow-auto rounded-2xl border border-border glass shadow-xl"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                  {t("notifications.title")}
                </h3>
                <div className="flex items-center gap-2">
                  {readCount > 0 && (
                    <button
                      onClick={handleClearRead}
                      className="text-[10px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1"
                      title={t("notifications.clearRead", "Supprimer les lues")}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <CheckCheck size={12} />
                      {t("notifications.markAllRead")}
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-muted-foreground font-bold">
                    {t("notifications.empty")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && handleMarkOne(n.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 cursor-pointer ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          n.type === "invitation_accepted"
                            ? "bg-primary/10 text-primary"
                            : n.type === "coach_request"
                            ? "bg-warning/10 text-warning"
                            : n.type === "cancellation_request"
                            ? "bg-destructive/10 text-destructive"
                            : n.type === "cancellation_approved"
                            ? "bg-warning/10 text-warning"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {n.type === "invitation_accepted" ? (
                          <UserCheck size={14} />
                        ) : n.type === "coach_request" ? (
                          <Crown size={14} />
                        ) : n.type === "cancellation_request" || n.type === "cancellation_approved" ? (
                          <X size={14} />
                        ) : (
                          <UserX size={14} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {n.type === "invitation_accepted"
                            ? t("notifications.accepted", { email: n.athlete_email ?? "?" })
                            : n.type === "coach_request"
                            ? t("notifications.coachRequest", { email: n.athlete_email ?? "?" })
                            : n.type === "cancellation_request"
                            ? t("notifications.cancellationRequest", { email: n.athlete_email ?? "?" })
                            : n.type === "cancellation_approved"
                            ? t("notifications.cancellationApproved", { email: n.athlete_email ?? "?" })
                            : t("notifications.rejected", { email: n.athlete_email ?? "?" })}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: dateLoc,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        )}
                        <button
                          onClick={(e) => handleDeleteOne(n.id, e)}
                          className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={t("notifications.delete", "Supprimer")}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
