import { supabase } from "@/lib/supabaseClient";
import { createNotification } from "@/db/notifications";

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

  // Get the invitation to find coach_id
  const { data: inv } = await supabase
    .from("coach_athletes")
    .select("coach_id, invite_email")
    .eq("id", invitationId)
    .single();

  const { error } = await supabase
    .from("coach_athletes")
    .update({ athlete_id: user.id, status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) throw error;

  // Notify the coach
  if (inv) {
    await createNotification({
      coach_id: inv.coach_id,
      type: "invitation_accepted",
      athlete_email: inv.invite_email,
      athlete_id: user.id,
    });
  }
}

/** Athlete: reject invitation */
export async function rejectInvitation(invitationId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the invitation to find coach_id
  const { data: inv } = await supabase
    .from("coach_athletes")
    .select("coach_id, invite_email")
    .eq("id", invitationId)
    .single();

  const { error } = await supabase
    .from("coach_athletes")
    .update({ status: "rejected" })
    .eq("id", invitationId);
  if (error) throw error;

  // Notify the coach
  if (inv) {
    await createNotification({
      coach_id: inv.coach_id,
      type: "invitation_rejected",
      athlete_email: inv.invite_email,
      athlete_id: user?.id ?? null,
    });
  }
}

/** Coach: remove an athlete (delete the coach_athletes row) */
export async function removeAthlete(relationId: string) {
  const { error } = await supabase
    .from("coach_athletes")
    .delete()
    .eq("id", relationId);
  if (error) throw error;
}

/** Get athlete profile info (email) by user id */
export async function getAthleteEmail(userId: string): Promise<string | null> {
  // We can't query auth.users from client, so we rely on invite_email
  return null;
}

/** Athlete: get the coach who accepted this athlete */
export async function getMyCoachId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("coach_athletes")
    .select("coach_id")
    .eq("athlete_id", user.id)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  if (error) { console.error("getMyCoachId:", error); return null; }
  return data?.coach_id ?? null;
}
