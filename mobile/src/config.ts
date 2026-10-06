export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://dbridge-bookstore.vercel.app";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env before starting the app.",
  );
}
