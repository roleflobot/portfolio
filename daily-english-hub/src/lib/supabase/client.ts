import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/** 브라우저(Client Component)에서 사용하는 Supabase 클라이언트. */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
