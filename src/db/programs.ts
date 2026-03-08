import { supabase } from "@/lib/supabaseClient";

export interface ProgramBlock {
  id: string;
  type: "text" | "exercise";
  content: string;
}

export interface Program {
  id: string;
  coach_id: string;
  athlete_id: string;
  title: string;
  content: ProgramBlock[];
  created_at: string;
  updated_at: string;
}

/** Coach: get all programs I created */
export async function getCoachPrograms(): Promise<Program[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("coach_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) { console.error("getCoachPrograms:", error); return []; }
  return data ?? [];
}

/** Athlete: get programs assigned to me */
export async function getMyPrograms(): Promise<Program[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("athlete_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) { console.error("getMyPrograms:", error); return []; }
  return data ?? [];
}

/** Coach: create a program */
export async function createProgram(athleteId: string, title: string, content: ProgramBlock[] = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("programs")
    .insert({ coach_id: user.id, athlete_id: athleteId, title, content })
    .select()
    .single();
  if (error) throw error;
  return data as Program;
}

/** Coach: update a program */
export async function updateProgram(programId: string, updates: { title?: string; content?: ProgramBlock[] }) {
  const { error } = await supabase
    .from("programs")
    .update(updates)
    .eq("id", programId);
  if (error) throw error;
}

/** Coach: delete a program */
export async function deleteProgram(programId: string) {
  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId);
  if (error) throw error;
}
