import { supabase } from "@/lib/supabaseClient";

export type CoachRequestStatus = "pending" | "approved" | "rejected";

export interface CoachRequest {
  id: string;
  user_id: string;
  status: CoachRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Submit a request to become a coach */
export async function submitCoachRequest(): Promise<CoachRequest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("coach_requests")
    .insert({ user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get my own coach request (latest) */
export async function getMyCoachRequest(): Promise<CoachRequest | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error("getMyCoachRequest:", error); return null; }
  return data;
}

/** Admin: get all pending coach requests */
export async function getPendingCoachRequests(): Promise<CoachRequest[]> {
  const { data, error } = await supabase
    .from("coach_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) { console.error("getPendingCoachRequests:", error); return []; }
  return data ?? [];
}

/** Admin: approve a coach request (adds coach role) */
export async function approveCoachRequest(requestId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the request to find user_id
  const { data: req } = await supabase
    .from("coach_requests")
    .select("user_id")
    .eq("id", requestId)
    .single();
  if (!req) throw new Error("Request not found");

  // Update the request status
  const { error: updateError } = await supabase
    .from("coach_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", requestId);
  if (updateError) throw updateError;

  // Add coach role
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: req.user_id, role: "coach" });
  if (roleError && !roleError.message.includes("duplicate")) throw roleError;
}

/** Admin: reject a coach request */
export async function rejectCoachRequest(requestId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("coach_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", requestId);
  if (error) throw error;
}
