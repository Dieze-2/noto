import { supabase } from "@/lib/supabaseClient";

export type CatalogExercise = {
  id: string;
  name: string;
  youtube_url: string | null;
  note: string | null;
  created_at: string;
};

export async function listCatalogExercises(): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from("exercise_catalog")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CatalogExercise[];
}

export async function addCatalogExercise(payload: {
  name: string;
  youtube_url: string | null;
  note: string | null;
}) {
  const { data, error } = await supabase
    .from("exercise_catalog")
    .insert({
      name: payload.name,
      youtube_url: payload.youtube_url,
      note: payload.note,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as CatalogExercise;
}
