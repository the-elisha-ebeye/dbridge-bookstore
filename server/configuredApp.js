import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app.js";
import { sendMailgunConfirmation } from "./services/mailgun.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, "..");
const localEnvironment = path.join(projectDirectory, ".env.local");
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

export function createConfiguredApp({ serveStatic = false } = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const authClient = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
  const adminClient = supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

  const app = createApp({
    authClient,
    adminClient,
    sendConfirmationEmail: sendMailgunConfirmation,
    supabaseOrigin: supabaseUrl ? new URL(supabaseUrl).origin : undefined,
    staticDirectory: serveStatic && existsSync(path.join(projectDirectory, "dist", "index.html"))
      ? path.join(projectDirectory, "dist")
      : undefined,
  });

  return { app, authClient, adminClient };
}
