import { supabase } from "@/lib/supabaseClient";

export type NotificationType = "invitation_accepted" | "invitation_rejected" | "coach_request";

export interface CoachNotification {
  id: string;
  coach_id: string;
  type: NotificationType;
  athlete_email: string | null;
  athlete_id: string | null;
  request_id: string | null;
  read: boolean;
  created_at: string;
}

/** Create a notification for the coach */
export async function createNotification(payload: {
  coach_id: string;
  type: NotificationType;
  athlete_email: string | null;
  athlete_id: string | null;
  request_id?: string | null;
}) {
  const { error } = await supabase
    .from("coach_notifications")
    .insert({
      coach_id: payload.coach_id,
      type: payload.type,
      athlete_email: payload.athlete_email,
      athlete_id: payload.athlete_id,
      request_id: payload.request_id ?? null,
    });

  if (error) console.error("createNotification:", error);
}

/** Get unread notifications for the current coach */
export async function getCoachNotifications(): Promise<CoachNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("coach_notifications")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getCoachNotifications:", error);
    return [];
  }
  return (data ?? []) as CoachNotification[];
}

/** Mark a notification as read */
export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("coach_notifications")
    .update({ read: true })
    .eq("id", id);

  if (error) console.error("markNotificationRead:", error);
}

/** Mark all notifications as read for the current coach */
export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("coach_notifications")
    .update({ read: true })
    .eq("coach_id", user.id)
    .eq("read", false);

  if (error) console.error("markAllNotificationsRead:", error);
}
