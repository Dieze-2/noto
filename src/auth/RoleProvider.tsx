import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { getUserRoles, AppRole } from "@/db/roles";
import { useAuth } from "@/auth/AuthProvider";
import { checkStripeSubscription, STRIPE_PLANS, CoachPlan } from "@/db/coachSubscriptions";
import { supabase } from "@/lib/supabaseClient";

interface StripeSubscriptionInfo {
  subscribed: boolean;
  plan?: CoachPlan;
  subscription_end?: string;
}

interface RoleContextType {
  roles: AppRole[];
  isCoach: boolean;
  isAdmin: boolean;
  loading: boolean;
  subscription: StripeSubscriptionInfo | null;
  refresh: () => void;
}

const RoleContext = createContext<RoleContextType>({
  roles: [],
  isCoach: false,
  isAdmin: false,
  loading: true,
  subscription: null,
  refresh: () => {},
});

export function useRoles() {
  return useContext(RoleContext);
}

/** Map Stripe product_id to our plan key */
function productToPlan(productId: string): CoachPlan | undefined {
  for (const [plan, cfg] of Object.entries(STRIPE_PLANS)) {
    if (cfg.product_id === productId) return plan as CoachPlan;
  }
  return undefined;
}

export default function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<StripeSubscriptionInfo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = async () => {
    if (!user) {
      setRoles([]);
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch roles and Stripe subscription in parallel
      const [dbRoles, stripeResult] = await Promise.all([
        getUserRoles(),
        checkStripeSubscription(),
      ]);

      let finalRoles = [...dbRoles];

      if (stripeResult?.subscribed) {
        const plan = stripeResult.product_id
          ? productToPlan(stripeResult.product_id)
          : undefined;

        setSubscription({
          subscribed: true,
          plan,
          subscription_end: stripeResult.subscription_end,
        });

        // If Stripe says subscribed but user doesn't have coach role, add it
        if (!finalRoles.includes("coach")) {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: user.id, role: "coach" });
          if (!error || error.message?.includes("duplicate")) {
            finalRoles.push("coach");
          }
        }

        // Ensure coach_subscriptions row exists
        if (plan) {
          await supabase
            .from("coach_subscriptions")
            .upsert(
              { coach_id: user.id, plan },
              { onConflict: "coach_id" }
            );
        }
      } else {
        setSubscription({ subscribed: false });

        // If Stripe says not subscribed but user has coach role,
        // only remove if NOT admin and no active trial
        if (finalRoles.includes("coach") && !finalRoles.includes("admin")) {
          const { data: sub } = await supabase
            .from("coach_subscriptions")
            .select("trial_end")
            .eq("coach_id", user.id)
            .maybeSingle();

          const isActiveTrial = sub?.trial_end && new Date(sub.trial_end) > new Date();
          if (!isActiveTrial) {
            await supabase
              .from("user_roles")
              .delete()
              .eq("user_id", user.id)
              .eq("role", "coach");
            await supabase
              .from("coach_subscriptions")
              .delete()
              .eq("coach_id", user.id);
            finalRoles = finalRoles.filter((r) => r !== "coach");
          }
        }
      }

      setRoles(finalRoles);
    } catch (err) {
      console.error("RoleProvider fetchAll error:", err);
      // Fallback: at least load DB roles
      const dbRoles = await getUserRoles();
      setRoles(dbRoles);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    // Auto-refresh every 60s
    if (user) {
      intervalRef.current = setInterval(fetchAll, 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id]);

  return (
    <RoleContext.Provider
      value={{
        roles,
        isCoach: roles.includes("coach"),
        isAdmin: roles.includes("admin"),
        loading,
        subscription,
        refresh: fetchAll,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}
