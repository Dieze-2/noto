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
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0); // last day of current month
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

/** Cancel the coach subscription immediately (used internally after cancel_at date) */
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

  // Add coach role
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: userId, role: "coach" });
  if (roleError && !roleError.message.includes("duplicate")) throw roleError;

  // Create or update subscription with trial
  const { error } = await supabase
    .from("coach_subscriptions")
    .upsert({
      coach_id: userId,
      plan: "classic",
      trial_end: trialEnd.toISOString(),
    }, { onConflict: "coach_id" });
  if (error) throw error;
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
