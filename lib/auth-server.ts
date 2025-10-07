import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

export async function getAuthenticatedUser(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Create a Supabase client for server-side auth
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
}

export async function getAuthenticatedUserFromSession(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // Create a Supabase client for server-side auth
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    return null;
  }
}
