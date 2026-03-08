import { supabase } from "@/lib/supabaseClient";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

/** Get a profile by user ID */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) { console.error("getProfile:", error); return null; }
  return data;
}

/** Get multiple profiles by user IDs */
export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  if (error) { console.error("getProfiles:", error); return []; }
  return data ?? [];
}

/** Update current user's profile */
export async function updateMyProfile(fields: { first_name: string; last_name: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id);
  if (error) throw error;
}

/** Format a profile as display name */
export function formatName(profile: Profile | null | undefined): string {
  if (!profile) return "?";
  const name = `${profile.first_name} ${profile.last_name}`.trim();
  return name || "?";
}
