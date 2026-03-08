import { supabase } from "@/lib/supabaseClient";

export type CoachPlan = "classic" | "pro" | "club";

export interface CoachSubscription {
  id: string;
  coach_id: string;
  plan: CoachPlan;
  created_at: string;
  updated_at: string;
}

/** Plan limits and pricing */
export const PLAN_CONFIG: Record<CoachPlan, { maxAthletes: number; label: string; priceLabel: string }> = {
  classic: { maxAthletes: 20, label: "Classic", priceLabel: "25€/mois" },
  pro:     { maxAthletes: 50, label: "Pro",     priceLabel: "25€ + 1,50€/athlète suppl." },
  club:    { maxAthletes: Infinity, label: "Club", priceLabel: "25€ + 1,50€×30 + 1€/athlète suppl." },
};

/** Get the current coach's subscription (or null = no subscription / free trial) */
export async function getCoachSubscription(): Promise<CoachSubscription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_subscriptions")
    .select("*")
    .eq("coach_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getCoachSubscription:", error);
    return null;
  }
  return data as CoachSubscription | null;
}

/** Get how many active athletes (accepted + pending) the coach currently has */
export async function getCoachAthleteCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("coach_athletes")
    .select("*", { count: "exact", head: true })
    .eq("coach_id", user.id)
    .in("status", ["accepted", "pending"]);

  if (error) {
    console.error("getCoachAthleteCount:", error);
    return 0;
  }
  return count ?? 0;
}

/** Check if the coach can invite one more athlete */
export async function canInviteAthlete(): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  plan: CoachPlan | null;
}> {
  const [sub, count] = await Promise.all([
    getCoachSubscription(),
    getCoachAthleteCount(),
  ]);

  const plan = sub?.plan ?? null;
  // If no subscription, default to classic limits (free tier / trial)
  const maxAllowed = plan ? PLAN_CONFIG[plan].maxAthletes : PLAN_CONFIG.classic.maxAthletes;

  return {
    allowed: count < maxAllowed,
    currentCount: count,
    maxAllowed,
    plan,
  };
}
