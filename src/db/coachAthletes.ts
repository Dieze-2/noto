import { supabase } from "@/lib/supabaseClient";

export interface CoachAthlete {
  id: string;
  coach_id: string;
  athlete_id: string | null;
  invite_email: string | null;
  invite_token: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_at: string | null;
}

/** Coach: get list of athletes (accepted + pending) */
export async function getCoachAthletes(): Promise<CoachAthlete[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("coach_athletes")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });
  if (error) { console.error("getCoachAthletes:", error); return []; }
  return data ?? [];
}

/** Coach: invite an athlete by email */
export async function inviteAthlete(email: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("coach_athletes")
    .insert({ coach_id: user.id, invite_email: email })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Athlete: get pending invitations */
export async function getMyInvitations(): Promise<CoachAthlete[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Match by email from auth user
  const { data, error } = await supabase
    .from("coach_athletes")
    .select("*")
    .eq("invite_email", user.email)
    .eq("status", "pending");
  if (error) { console.error("getMyInvitations:", error); return []; }
  return data ?? [];
}

/** Athlete: accept invitation */
export async function acceptInvitation(invitationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("coach_athletes")
    .update({ athlete_id: user.id, status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) throw error;
}

/** Athlete: reject invitation */
export async function rejectInvitation(invitationId: string) {
  const { error } = await supabase
    .from("coach_athletes")
    .update({ status: "rejected" })
    .eq("id", invitationId);
  if (error) throw error;
}

/** Get athlete profile info (email) by user id */
export async function getAthleteEmail(userId: string): Promise<string | null> {
  // We can't query auth.users from client, so we rely on invite_email
  return null;
}
