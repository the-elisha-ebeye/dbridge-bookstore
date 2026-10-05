import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import handler from "../api/[...path].js";

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
