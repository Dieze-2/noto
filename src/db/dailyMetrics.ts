import { supabase } from "@/lib/supabaseClient";

export interface DailyMetrics {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
  note: string | null;
}

export async function getDailyMetricsByDate(date: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data as DailyMetrics | null;
}

export async function getDailyMetricsRange(from: string, to: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DailyMetrics[];
}

export async function getFirstWeightDate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("daily_metrics")
    .select("date")
    .eq("user_id", user.id)
    .not("weight_g", "is", null)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.date ?? null;
}

export async function saveDailyMetrics(payload: {
  date: string;
  weight_g: number | null;
  steps: number | null;
  kcal: number | null;
  note: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const allEmpty =
    payload.weight_g == null &&
    payload.steps == null &&
    payload.kcal == null &&
    (!payload.note || payload.note.trim() === "");

  if (allEmpty) {
    // Delete ghost row
    await supabase
      .from("daily_metrics")
      .delete()
      .eq("user_id", user.id)
      .eq("date", payload.date);
    return null;
  }

  const { data, error } = await supabase
    .from("daily_metrics")
    .upsert(
      { user_id: user.id, ...payload },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as DailyMetrics;
}
