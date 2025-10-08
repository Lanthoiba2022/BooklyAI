import { supabaseServer } from "./supabaseServer";

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any> | null;
};

export type DbUser = {
  id: number;
  public_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function ensureUserProvisioned(authUser: SupabaseAuthUser): Promise<DbUser | null> {
  if (!supabaseServer || !authUser?.id) return null;

  const publicId = authUser.id;
  const email = authUser.email ?? null;
  const displayName = (authUser.user_metadata as any)?.full_name
    ?? (authUser.user_metadata as any)?.name
    ?? null;
  const avatarUrl = (authUser.user_metadata as any)?.avatar_url ?? null;

  // Try to find by public_id first
  const { data: existing, error: selErr } = await supabaseServer
    .from("users")
    .select("id, public_id, email, display_name, avatar_url")
    .eq("public_id", publicId)
    .limit(1)
    .maybeSingle();

  if (selErr) {
    // If selection fails due to RLS, service key should still allow; return null otherwise
    // Do not throw; keep endpoints resilient
  }

  if (existing) {
    // Optionally update stale profile fields
    const shouldUpdate = (existing.email !== email) || (existing.display_name !== displayName) || (existing.avatar_url !== avatarUrl);
    if (shouldUpdate) {
      await supabaseServer
        .from("users")
        .update({ email, display_name: displayName, avatar_url: avatarUrl })
        .eq("id", existing.id);
    }
    return existing as DbUser;
  }

  // Insert new user row
  const { data: inserted, error: insErr } = await supabaseServer
    .from("users")
    .insert({ public_id: publicId, email, display_name: displayName, avatar_url: avatarUrl })
    .select("id, public_id, email, display_name, avatar_url")
    .single();

  if (insErr) {
    return null;
  }

  return inserted as DbUser;
}


