import { supabase } from "@/lib/supabaseClient";

/* ── Types ── */

export interface Program {
  id: string;
  coach_id: string;
  athlete_id: string;
  title: string;
  content: any; // legacy, kept for compat
  created_at: string;
  updated_at: string;
}

export interface ProgramSession {
  id: string;
  program_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface ProgramExercise {
  id: string;
  session_id: string;
  exercise_name: string;
  exercise_catalog_id: string | null;
  sets: string;
  reps: string;
  rest: string;
  work_type: string;
  note: string;
  sort_order: number;
  created_at: string;
}

export interface ProgramSessionWithExercises extends ProgramSession {
  exercises: ProgramExercise[];
}

export interface ProgramWithSessions extends Program {
  sessions: ProgramSessionWithExercises[];
}

/* ── Programs CRUD ── */

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

export async function getMyPrograms(): Promise<Program[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Return programs where user is the athlete OR where user is both coach and athlete (self-coaching)
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .or(`athlete_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  if (error) { console.error("getMyPrograms:", error); return []; }
  return data ?? [];
}

export async function createProgram(athleteId: string, title: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("programs")
    .insert({ coach_id: user.id, athlete_id: athleteId, title, content: [] })
    .select()
    .single();
  if (error) throw error;
  return data as Program;
}

export async function updateProgramTitle(programId: string, title: string) {
  const { error } = await supabase
    .from("programs")
    .update({ title })
    .eq("id", programId);
  if (error) throw error;
}

export async function deleteProgram(programId: string) {
  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId);
  if (error) throw error;
}

/* ── Sessions CRUD ── */

export async function getProgramSessions(programId: string): Promise<ProgramSessionWithExercises[]> {
  const { data: sessions, error: sErr } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order");
  if (sErr) { console.error("getProgramSessions:", sErr); return []; }

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: exercises, error: eErr } = await supabase
    .from("program_exercises")
    .select("*")
    .in("session_id", sessionIds)
    .order("sort_order");
  if (eErr) { console.error("getProgramExercises:", eErr); }

  const exercisesBySession = new Map<string, ProgramExercise[]>();
  (exercises ?? []).forEach((ex) => {
    const list = exercisesBySession.get(ex.session_id) ?? [];
    list.push(ex as ProgramExercise);
    exercisesBySession.set(ex.session_id, list);
  });

  return sessions.map((s) => ({
    ...(s as ProgramSession),
    exercises: exercisesBySession.get(s.id) ?? [],
  }));
}

export async function createSession(programId: string, name: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("program_sessions")
    .insert({ program_id: programId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as ProgramSession;
}

export async function updateSession(sessionId: string, updates: { name?: string; sort_order?: number }) {
  const { error } = await supabase
    .from("program_sessions")
    .update(updates)
    .eq("id", sessionId);
  if (error) throw error;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase
    .from("program_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

export async function reorderSessions(sessions: { id: string; sort_order: number }[]) {
  // Update each session's sort_order
  const promises = sessions.map((s) =>
    supabase.from("program_sessions").update({ sort_order: s.sort_order }).eq("id", s.id)
  );
  await Promise.all(promises);
}

/* ── Exercises CRUD ── */

export async function addExercise(sessionId: string, exercise: Omit<ProgramExercise, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("program_exercises")
    .insert({
      session_id: sessionId,
      exercise_name: exercise.exercise_name,
      exercise_catalog_id: exercise.exercise_catalog_id,
      sets: exercise.sets,
      reps: exercise.reps,
      rest: exercise.rest,
      work_type: exercise.work_type,
      note: exercise.note,
      sort_order: exercise.sort_order,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProgramExercise;
}

export async function updateExercise(exerciseId: string, updates: Partial<ProgramExercise>) {
  const { id, created_at, ...safe } = updates as any;
  const { error } = await supabase
    .from("program_exercises")
    .update(safe)
    .eq("id", exerciseId);
  if (error) throw error;
}

export async function deleteExercise(exerciseId: string) {
  const { error } = await supabase
    .from("program_exercises")
    .delete()
    .eq("id", exerciseId);
  if (error) throw error;
}
