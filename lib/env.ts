export const getEnv = () => {
  const env = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    youtubeApiKey: process.env.YT_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_API_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  } as const;

  return env;
};

export type AppEnv = ReturnType<typeof getEnv>;

export const getPublicEnv = () => {
  const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  } as const;
  return env;
};

export type AppPublicEnv = ReturnType<typeof getPublicEnv>;


