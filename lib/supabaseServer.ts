import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

const { supabaseUrl, supabaseServiceKey } = getEnv();

export const supabaseServer = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : undefined;


