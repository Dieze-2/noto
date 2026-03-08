import { supabase } from "@/lib/supabaseClient";

export interface CoachAthleteNote {
  id: string;
  coach_id: string;
  athlete_id: string;
  content: string;
  updated_at: string;
}

/** Get the coach's private note for a specific athlete */
export async function getCoachNote(athleteId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "";

  const { data, error } = await supabase
    .from("coach_athlete_notes")
    .select("content")
    .eq("coach_id", user.id)
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (error) {
    console.error("getCoachNote:", error);
    return "";
  }
  return data?.content ?? "";
}

/** Upsert the coach's private note for a specific athlete */
export async function saveCoachNote(athleteId: string, content: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("coach_athlete_notes")
    .upsert(
      {
        coach_id: user.id,
        athlete_id: athleteId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "coach_id,athlete_id" }
    );

  if (error) console.error("saveCoachNote:", error);
}
