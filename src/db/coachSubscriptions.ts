import { supabase } from "@/lib/supabaseClient";

export type CoachPlan = "classic" | "pro" | "club";

export interface CoachSubscription {
  id: string;
  coach_id: string;
  plan: CoachPlan;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

/** Stripe product/price mapping */
export const STRIPE_PLANS = {
  classic: {
    product_id: "prod_U6yqqbURHzg97L",
    price_id: "price_1T8kt61n7Oqx2mJLHUgS2FMa",
  },
  pro: {
    product_id: "prod_U6z7kGgni4DyDT",
    price_id: "price_1T8lR71n7Oqx2mJLmQTD5rve",
  },
  club: {
    product_id: "prod_U6z7wSSDyqdiL6",
    price_id: "price_1T8lPI1n7Oqx2mJLXgmMli3V",
  },
} as const;

/** Plan limits and pricing */
export const PLAN_CONFIG: Record<CoachPlan, { maxAthletes: number; label: string; priceLabel: string }> = {
  classic: { maxAthletes: 20, label: "Classic", priceLabel: "24,90€/mois" },
  pro:     { maxAthletes: 50, label: "Pro",     priceLabel: "24,90€ + 1,50€/athlète suppl." },
  club:    { maxAthletes: Infinity, label: "Club", priceLabel: "69,90€ + 1€/athlète suppl." },
};

/** Request cancellation (sets pending_cancellation flag) */
export async function requestCancellation(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("coach_subscriptions")
    .update({ pending_cancellation: true })
    .eq("coach_id", user.id);
  if (error) throw error;
}

/** Admin: approve cancellation — role stays until end of current month, then removed */
export async function approveCancellation(coachId: string): Promise<void> {
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const { error } = await supabase
    .from("coach_subscriptions")
    .update({
      pending_cancellation: false,
      cancel_at: endOfMonth.toISOString(),
    })
    .eq("coach_id", coachId);
  if (error) throw error;
}

/** Cancel the coach subscription immediately */
export async function cancelCoachSubscription(coachId: string): Promise<void> {
  const { error } = await supabase
    .from("coach_subscriptions")
    .delete()
    .eq("coach_id", coachId);
  if (error) throw error;

  const { error: roleError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", coachId)
    .eq("role", "coach");
  if (roleError) console.error("removeCoachRole:", roleError);
}

/** Get pending cancellation requests (admin) */
export async function getPendingCancellations(): Promise<{ coach_id: string; plan: CoachPlan }[]> {
  const { data, error } = await supabase
    .from("coach_subscriptions")
    .select("coach_id, plan")
    .eq("pending_cancellation", true);
  if (error) { console.error("getPendingCancellations:", error); return []; }
  return data ?? [];
}

/** Admin: grant a 30-day coach trial to a user */
export async function grantCoachTrial(userId: string): Promise<void> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "coach" });
  if (roleError && !roleError.message.includes("duplicate")) throw roleError;

  const { error } = await supabase
    .from("coach_subscriptions")
    .upsert({
      coach_id: userId,
      plan: "classic",
      trial_end: trialEnd.toISOString(),
    }, { onConflict: "coach_id" });
  if (error) throw error;
}

/** Check if the current user is eligible for a free trial */
export async function isTrialEligible(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count: requestCount } = await supabase
    .from("coach_requests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["approved", "pending"]);
  if ((requestCount ?? 0) > 0) return false;

  const { count: subCount } = await supabase
    .from("coach_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("coach_id", user.id);
  if ((subCount ?? 0) > 0) return false;

  const { count: roleCount } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "coach");
  return (roleCount ?? 0) === 0;
}

/** Get the current coach's subscription */
export async function getCoachSubscription(): Promise<CoachSubscription | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_subscriptions")
    .select("*")
    .eq("coach_id", user.id)
    .maybeSingle();

  if (error) { console.error("getCoachSubscription:", error); return null; }
  return data as CoachSubscription | null;
}

/** Get how many active athletes the coach currently has */
export async function getCoachAthleteCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("coach_athletes")
    .select("*", { count: "exact", head: true })
    .eq("coach_id", user.id)
    .in("status", ["accepted", "pending"]);

  if (error) { console.error("getCoachAthleteCount:", error); return 0; }
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
  const maxAllowed = plan ? PLAN_CONFIG[plan].maxAthletes : PLAN_CONFIG.classic.maxAthletes;

  return { allowed: count < maxAllowed, currentCount: count, maxAllowed, plan };
}

/** Start Stripe Checkout for a plan */
export async function startCheckout(plan: CoachPlan): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { plan },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url;
}

/** Check subscription status from Stripe */
export async function checkStripeSubscription(): Promise<{
  subscribed: boolean;
  plan?: string;
  product_id?: string;
  subscription_end?: string;
  quantity?: number;
} | null> {
  const { data, error } = await supabase.functions.invoke("check-subscription");
  if (error) { console.error("checkStripeSubscription:", error); return null; }
  return data;
}

/** Sync athlete count to Stripe subscription quantity */
export async function syncAthleteQuantity(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("update-subscription-quantity");
  if (error) console.error("syncAthleteQuantity:", error);
  if (data?.error) console.error("syncAthleteQuantity:", data.error);
}

/** Open Stripe Customer Portal */
export async function openCustomerPortal(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("customer-portal");
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url;
}
