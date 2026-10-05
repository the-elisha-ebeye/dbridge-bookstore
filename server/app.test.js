import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

const userA = { id: "11111111-1111-4111-8111-111111111111", email: "reader@example.com" };
const orderId = "22222222-2222-4222-8222-222222222222";
const order = {
  id: orderId,
  user_id: userA.id,
  customer_name: "A Reader",
  email: userA.email,
  phone: "+234 801 234 5678",
  delivery_address: "12 Book Street",
  city: "Benin City",
  state: "Edo",
  total: 25000,
  status: "pending",
};
const orderItems = [{
  id: "33333333-3333-4333-8333-333333333333",
  product_id: "atomic-habits",
  product_title: "Atomic Habits",
  unit_price: 12500,
  quantity: 2,
  subtotal: 25000,
}];
const validPayload = {
  customerName: "A Reader",
  phone: "+234 801 234 5678",
  deliveryAddress: "12 Book Street",
  city: "Benin City",
  state: "Edo",
  checkoutKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "tampered@example.com",
  total: 1,
  items: [{ productId: "atomic-habits", quantity: 2, price: 0.01 }],
};

function createFakeAdmin({ orderOwner = userA.id, rpcError = null } = {}) {
  const state = {
    rpcCalls: [],
    emailUpdates: [],
    emailRecord: { status: "pending", attempts: 0, recipient: userA.email },
  };

  const client = {
    state,
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      return rpcError
        ? { data: null, error: rpcError }
        : { data: { order, items: orderItems, is_existing: false, email_status: "pending", email_attempts: 0 }, error: null };
    },
    from(table) {
      const query = {
        filters: {},
        select() { return query; },
        update(values) {
          query.updateValues = values;
          return query;
        },
        eq(key, value) {
          query.filters[key] = value;
          return query;
        },
        async maybeSingle() {
          if (table === "orders" && query.filters.id === orderId) {
            return { data: { ...order, user_id: orderOwner, order_items: orderItems }, error: null };
          }
          if (table === "order_emails" && query.filters.order_id === orderId) {
            return { data: state.emailRecord, error: null };
          }
          return { data: null, error: null };
        },
        async then(resolve, reject) {
          if (table === "order_emails" && query.updateValues) {
            state.emailUpdates.push(query.updateValues);
            state.emailRecord = { ...state.emailRecord, ...query.updateValues };
            return resolve({ error: null });
          }
          return resolve({ error: null });
        },
      };
      return query;
    },
  };
  return client;
}

async function startTestServer({ adminClient = createFakeAdmin(), sendConfirmationEmail = async () => {} } = {}) {
  const authClient = {
    auth: {
      async getUser(token) {
        return token === "valid-token"
          ? { data: { user: userA }, error: null }
          : { data: { user: null }, error: new Error("Invalid token") };
      },
    },
  };
  const app = createApp({
    authClient,
    adminClient,
    sendConfirmationEmail,
    logger: { error() {} },
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    adminClient,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    url: `http://127.0.0.1:${port}`,
  };
}

function authHeaders() {
  return { Authorization: "Bearer valid-token", "Content-Type": "application/json" };
}

test("order endpoint rejects unauthenticated requests", async () => {
  const app = createApp({
    authClient: { auth: { getUser: async () => ({ data: { user: null }, error: new Error("Invalid") }) } },
    adminClient: createFakeAdmin(),
    sendConfirmationEmail: async () => {},
    logger: { error() {} },
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("order endpoint validates quantities before calling the database", async () => {
  const testServer = await startTestServer();
  try {
    const response = await fetch(`${testServer.url}/api/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...validPayload, items: [{ productId: "atomic-habits", quantity: 21 }] }),
    });
    assert.equal(response.status, 400);
    assert.equal(testServer.adminClient.state.rpcCalls.length, 0);
  } finally {
    await testServer.close();
  }
});

test("order endpoint reports unavailable products, missing products, and stock conflicts appropriately", async () => {
  for (const [rpcError, expectedStatus] of [
    [{ message: "PRODUCT_NOT_FOUND" }, 404],
    [{ message: "INSUFFICIENT_STOCK" }, 409],
    [{ message: "PRODUCT_NOT_AVAILABLE" }, 409],
  ]) {
    const testServer = await startTestServer({ adminClient: createFakeAdmin({ rpcError }) });
    try {
      const response = await fetch(`${testServer.url}/api/orders`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(validPayload),
      });
      assert.equal(response.status, expectedStatus);
      if (rpcError.message === "PRODUCT_NOT_AVAILABLE") {
        assert.match((await response.json()).message, /no longer available/);
      }
    } finally {
      await testServer.close();
    }
  }
});

test("order endpoint uses the authenticated identity and database-calculated totals", async () => {
  const testServer = await startTestServer();
  let sentEmail;
  try {
    const response = await fetch(`${testServer.url}/api/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(validPayload),
    });
    const result = await response.json();
    const call = testServer.adminClient.state.rpcCalls[0];

    assert.equal(response.status, 201);
    assert.equal(call.name, "create_order");
    assert.equal(call.args.p_user_id, userA.id);
    assert.equal(call.args.p_checkout_key, validPayload.checkoutKey);
    assert.equal(call.args.p_email, userA.email);
    assert.deepEqual(call.args.p_items, [{ productId: "atomic-habits", quantity: 2 }]);
    assert.equal(result.order.id, orderId);
    assert.equal(result.emailStatus, "sent");
  } finally {
    await testServer.close();
  }
});

test("an idempotent replay returns the saved order without resending a delivered email", async () => {
  const adminClient = createFakeAdmin();
  adminClient.rpc = async (name, args) => {
    adminClient.state.rpcCalls.push({ name, args });
    return {
      data: { order, items: orderItems, is_existing: true, email_status: "sent", email_attempts: 1 },
      error: null,
    };
  };
  let emailCalls = 0;
  const testServer = await startTestServer({
    adminClient,
    sendConfirmationEmail: async () => { emailCalls += 1; },
  });
  try {
    const response = await fetch(`${testServer.url}/api/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(validPayload),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.order.id, orderId);
    assert.equal(result.emailStatus, "sent");
    assert.equal(emailCalls, 0);
  } finally {
    await testServer.close();
  }
});

test("failed confirmation email does not undo an order and is recorded for retry", async () => {
  const testServer = await startTestServer({
    sendConfirmationEmail: async () => { throw new Error("Mailgun unavailable"); },
  });
  try {
    const response = await fetch(`${testServer.url}/api/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(validPayload),
    });
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.order.id, orderId);
    assert.equal(result.emailStatus, "failed");
    assert.equal(testServer.adminClient.state.emailUpdates[0].status, "failed");
    assert.equal(testServer.adminClient.state.emailUpdates[0].attempts, 1);
  } finally {
    await testServer.close();
  }
});

test("email retry refuses to send another customer's order", async () => {
  let emailCalls = 0;
  const testServer = await startTestServer({
    adminClient: createFakeAdmin({ orderOwner: "44444444-4444-4444-8444-444444444444" }),
    sendConfirmationEmail: async () => { emailCalls += 1; },
  });
  try {
    const response = await fetch(`${testServer.url}/api/orders/${orderId}/confirmation-email/retry`, {
      method: "POST",
      headers: authHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(emailCalls, 0);
  } finally {
    await testServer.close();
  }
});

test("email retry validates order identifiers", async () => {
  const testServer = await startTestServer();
  try {
    const response = await fetch(`${testServer.url}/api/orders/not-an-order/confirmation-email/retry`, {
      method: "POST",
      headers: authHeaders(),
    });
    assert.equal(response.status, 400);
  } finally {
    await testServer.close();
  }
});

test("email retry sends only the owner's persisted order", async () => {
  let sent;
  const testServer = await startTestServer({
    sendConfirmationEmail: async (message) => { sent = message; },
  });
  try {
    const response = await fetch(`${testServer.url}/api/orders/${orderId}/confirmation-email/retry`, {
      method: "POST",
      headers: authHeaders(),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.emailStatus, "sent");
    assert.equal(sent.recipient, userA.email);
    assert.equal(sent.items[0].product_title, "Atomic Habits");
    assert.equal(testServer.adminClient.state.emailUpdates[0].attempts, 1);
  } finally {
    await testServer.close();
  }
});
