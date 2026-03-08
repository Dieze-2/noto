import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

/** Get a single profile by user id */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) { console.error("getProfile:", error); return null; }
  return data;
}

/** Get multiple profiles by user ids */
export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  if (error) { console.error("getProfiles:", error); return []; }
  return data ?? [];
}

/** Update the current user's profile */
export async function updateProfile(updates: { first_name?: string; last_name?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) throw error;
}

/** Get display name from a profile */
export function displayName(profile: Profile | null, fallback?: string): string {
  if (profile && (profile.first_name || profile.last_name)) {
    return `${profile.first_name} ${profile.last_name}`.trim();
  }
  return fallback ?? "Athlète";
}
