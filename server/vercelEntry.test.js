import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import adminMeHandler from "../api/admin/me.js";
import adminProductsHandler from "../api/admin/products.js";
import handler from "../api/[...path].js";

test("Vercel config excludes API paths from SPA fallback and declares nested admin functions", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  const [spaRewrite] = config.rewrites;

  assert.equal(spaRewrite.source, "/:path((?!api/).*)");
  assert.equal(spaRewrite.destination, "/index.html");
  for (const entry of [
    "../api/admin/me.js",
    "../api/admin/dashboard.js",
    "../api/admin/products.js",
    "../api/admin/products/[id].js",
    "../api/admin/products/[id]/restore.js",
    "../api/admin/images.js",
    "../api/admin/images/[key].js",
    "../api/admin/orders.js",
    "../api/admin/orders/[id].js",
    "../api/admin/orders/[id]/status.js",
    "../api/orders/[id]/confirmation-email/retry.js",
  ]) {
    const routeModule = await import(new URL(entry, import.meta.url));
    assert.equal(typeof routeModule.default, "function", `${entry} should export an Express function`);
  }
});

test("nested admin function entries dispatch through Express without bypassing authentication", async () => {
  for (const [route, functionHandler] of [
    ["/api/admin/me", adminMeHandler],
    ["/api/admin/products", adminProductsHandler],
  ]) {
    const server = createServer(functionHandler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    try {
      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}${route}`);
      assert.equal(response.status, 401);
      assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  }
});

test("Vercel catch-all serves API routes through the existing Express app", async () => {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/orders`, { method: "POST" });
    const body = await response.json();

    assert.ok(
      [401, 503].includes(response.status),
      `Expected an authentication response, received ${response.status}: ${body.message}`,
    );
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.match(body.message, /sign in|authentication is not configured/i);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
