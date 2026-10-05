import { createConfiguredApp } from "./configuredApp.js";

const { app, authClient, adminClient } = createConfiguredApp({ serveStatic: true });

const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`D’Bridge Bookshop API listening on port ${port}`);
  if (!authClient || !adminClient) {
    console.warn("Supabase server credentials are not configured; checkout and admin APIs will return 503.");
  }
});
