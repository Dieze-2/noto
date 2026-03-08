import { supabase } from "@/lib/supabaseClient";

export type AppRole = "admin" | "coach" | "athlete";

export async function getUserRoles(): Promise<AppRole[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) { console.error("getUserRoles error:", error); return []; }
  return (data ?? []).map((r: any) => r.role as AppRole);
}

export async function hasRole(role: AppRole): Promise<boolean> {
  const roles = await getUserRoles();
  return roles.includes(role);
}
