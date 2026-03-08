import { supabase } from "@/lib/supabaseClient";

export interface CatalogExercise {
  id: string;
  name: string;
  note?: string | null;
  youtube_url?: string | null;
}

export async function listCatalogExercises(): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from("catalog_exercises")
    .select("id, name, note, youtube_url")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CatalogExercise[];
}
