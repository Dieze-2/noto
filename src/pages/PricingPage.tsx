import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Building2, ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import GlassCard from "@/components/GlassCard";
import { submitCoachRequest, getMyCoachRequest } from "@/db/coachRequests";
import { createNotification } from "@/db/notifications";
import { supabase } from "@/lib/supabaseClient";
import { getProfile, displayName } from "@/db/profiles";
import { useRoles } from "@/auth/RoleProvider";

const plans = [
  {
    key: "classic" as const,
    icon: Crown,
    color: "text-primary",
    bgColor: "bg-primary/10",
    price: "25",
    featured: false,
  },
  {
    key: "pro" as const,
    icon: Zap,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    price: "25",
    extraPrice: "1,50",
    featured: true,
  },
  {
    key: "club" as const,
    icon: Building2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    price: "25",
    extraPrice: "1",
    featured: false,
  },
];

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isCoach } = useRoles();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const handleSubscribe = async (planKey: string) => {
    setSubmitting(planKey);
    try {
      // Check if already has a pending request
      const existing = await getMyCoachRequest();
      if (existing?.status === "pending") {
        toast.error(t("settings.coachRequestAlreadySent"));
        setSubmitting(null);
        return;
      }

      // Submit coach request
      const req = await submitCoachRequest();

      // Notify admins
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await getProfile(user.id);
        const name = profile ? displayName(profile) : user.email ?? "";
        // Find admin users to notify
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        if (adminRoles) {
          for (const ar of adminRoles) {
            await createNotification({
              coach_id: ar.user_id,
              type: "coach_request",
              athlete_email: name,
              athlete_id: user.id,
              request_id: req.id,
            });
          }
        }
      }

      toast.success(t("settings.coachRequestSent"));
      navigate("/settings");
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.code === "23505") {
        toast.error(t("settings.coachRequestAlreadySent"));
      } else {
        toast.error(e.message);
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-32 lg:pb-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          {t("pricing.back")}
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-noto-title text-3xl text-primary">{t("pricing.title")}</h1>
          <p className="text-sm text-muted-foreground font-bold max-w-md mx-auto">
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const features = t(`pricing.${plan.key}.features`, { returnObjects: true }) as string[];
            const isSubmitting = submitting === plan.key;
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard
                  className={`p-6 rounded-3xl relative overflow-hidden ${
                    plan.featured ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                      {t("pricing.popular")}
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${plan.bgColor} flex items-center justify-center ${plan.color}`}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-foreground">
                        {t(`pricing.${plan.key}.name`)}
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-bold">
                        {t(`pricing.${plan.key}.tagline`)}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-foreground">{plan.price}€</span>
                      <span className="text-sm text-muted-foreground font-bold">/mois</span>
                    </div>
                    {plan.extraPrice && (
                      <p className="text-xs text-muted-foreground font-bold mt-1">
                        {t(`pricing.${plan.key}.extra`, { price: plan.extraPrice })}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6">
                    {Array.isArray(features) && features.map((feat, j) => (
                      <li key={j} className="flex items-start gap-2">
                        <Check size={14} className="text-primary mt-0.5 shrink-0" />
                        <span className="text-xs text-muted-foreground font-bold">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCoach ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-muted text-muted-foreground opacity-60"
                    >
                      {t("pricing.alreadyCoach")}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.key)}
                      disabled={!!submitting}
                      className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 ${
                        plan.featured
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                      {t("pricing.subscribe")}
                    </button>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-muted-foreground font-bold">
          {t("pricing.note")}
        </p>
      </motion.div>
    </div>
  );
}
