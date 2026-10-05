import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

const adminUser = { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.com" };
const product = {
  id: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  description: "A book about habits.",
  price: 12500,
  category: "Habits",
  image_url: null,
  stock_quantity: 4,
  isbn: null,
  featured: false,
  tags: ["habits"],
  is_available: true,
  archived_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
};
const customerOrder = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "33333333-3333-4333-8333-333333333333",
  customer_name: "A Customer",
  email: "customer@example.com",
  phone: "+234 801 234 5678",
  delivery_address: "12 Book Street",
  city: "Benin City",
  state: "Edo",
  total: 25000,
  status: "pending",
  created_at: "2026-01-05T00:00:00.000Z",
};
const customerOrderItem = {
  id: "44444444-4444-4444-8444-444444444444",
  order_id: customerOrder.id,
  product_id: product.id,
  product_title: product.title,
  unit_price: 12500,
  quantity: 2,
  subtotal: 25000,
};
const validProduct = {
  title: "The Power of Habit",
  author: "Charles Duhigg",
  description: "A practical exploration of habits.",
  price: 14000,
  category: "Habits",
  stock_quantity: 8,
};

function createFakeAdmin({ role = "admin" } = {}) {
  const state = {
    profiles: [{ id: adminUser.id, role }],
    products: [{ ...product }],
    orders: [{ ...customerOrder }],
    order_items: [{ ...customerOrderItem }],
    uploads: [],
  };

  const client = {
    state,
    from(table) {
      const query = { table, filters: [], operation: "select", values: null, columns: "*" };
      query.select = (columns = "*") => { query.columns = columns; return query; };
      query.insert = (values) => { query.operation = "insert"; query.values = values; return query; };
      query.update = (values) => { query.operation = "update"; query.values = values; return query; };
      query.eq = (key, value) => { query.filters.push((row) => row[key] === value); return query; };
      query.is = (key, value) => { query.filters.push((row) => row[key] === value); return query; };
      query.not = (key, operator, value) => {
        if (operator === "is" && value === null) query.filters.push((row) => row[key] !== null);
        return query;
      };
      query.order = (key, { ascending }) => {
        query.sort = (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1);
        return query;
      };
      query.execute = () => {
        const rows = state[table] ?? [];
        if (query.operation === "insert") {
          const inserted = { id: `new-${rows.length + 1}`, created_at: new Date().toISOString(), archived_at: null, ...query.values };
          rows.push(inserted);
          return { data: inserted, error: null };
        }
        let selected = rows.filter((row) => query.filters.every((filter) => filter(row)));
        if (query.operation === "update") {
          for (const row of selected) Object.assign(row, query.values);
        }
        if (query.sort) selected = [...selected].sort(query.sort);
        if (query.columns.includes("order_items(")) {
          selected = selected.map((row) => ({
            ...row,
            order_items: state.order_items.filter((item) => item.order_id === row.id),
          }));
        }
        return { data: query.operation === "update" ? selected[0] ?? null : selected, error: null };
      };
      query.maybeSingle = async () => {
        const result = query.execute();
        const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
        return { ...result, data: data && typeof data === "object" ? { ...data } : data };
      };
      query.single = async () => {
        const result = query.execute();
        return { ...result, data: Array.isArray(result.data) ? result.data[0] : result.data };
      };
      query.then = (resolve, reject) => Promise.resolve(query.execute()).then(resolve, reject);
      return query;
    },
    storage: {
      from(bucket) {
        return {
          async upload(key, bytes, options) {
            state.uploads.push({ bucket, key, bytes, options });
            return { error: null };
          },
          async remove(keys) {
            state.uploads = state.uploads.filter((file) => !keys.includes(file.key));
            return { error: null };
          },
          getPublicUrl(key) {
            return { data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${key}` } };
          },
        };
      },
    },
  };
  return client;
}

async function startServer({ role = "admin", adminClient = createFakeAdmin({ role }) } = {}) {
  const authClient = {
    auth: {
      async getUser(token) {
        return token === "good-token"
          ? { data: { user: adminUser }, error: null }
          : { data: { user: null }, error: new Error("Invalid token") };
      },
    },
  };
  const server = createServer(createApp({
    authClient,
    adminClient,
    sendConfirmationEmail: async () => {},
    logger: { error() {} },
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    adminClient,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    url: `http://127.0.0.1:${server.address().port}`,
  };
}

function headers() {
  return { Authorization: "Bearer good-token", "Content-Type": "application/json" };
}

test("admin role endpoint reports the server-verified role", async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.url}/api/admin/me`, { headers: headers() });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { role: "admin" });
  } finally {
    await server.close();
  }
});

test("admin dashboard returns computed metrics and recent inventory", async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.url}/api/admin/dashboard`, { headers: headers() });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.stats.orderCount, 1);
    assert.equal(result.stats.revenue, 25000);
    assert.equal(result.stats.lowStockCount, 1);
    assert.equal(result.recentOrders[0].id, customerOrder.id);
  } finally {
    await server.close();
  }
});

test("admin product APIs list, validate, create, update, archive, and restore without deleting history", async () => {
  const server = await startServer();
  try {
    const listResponse = await fetch(`${server.url}/api/admin/products`, { headers: headers() });
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).products.length, 1);

    const invalidResponse = await fetch(`${server.url}/api/admin/products`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...validProduct, price: -1 }),
    });
    assert.equal(invalidResponse.status, 400);

    const createResponse = await fetch(`${server.url}/api/admin/products`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(validProduct),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()).product;
    assert.equal(created.title, validProduct.title);

    const updateResponse = await fetch(`${server.url}/api/admin/products/${created.id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ stock_quantity: 3 }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).product.stock_quantity, 3);

    const oldCoverKey = "55555555-5555-4555-8555-555555555555.jpg";
    server.adminClient.state.products[0].image_url = `https://example.supabase.co/storage/v1/object/public/book-covers/${oldCoverKey}`;
    server.adminClient.state.uploads.push({ key: oldCoverKey });
    const replaceCover = await fetch(`${server.url}/api/admin/products/${product.id}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ image_url: "https://images.example.com/new-cover.jpg" }),
    });
    assert.equal(replaceCover.status, 200);
    assert.equal(server.adminClient.state.uploads.length, 0);

    const archiveResponse = await fetch(`${server.url}/api/admin/products/${product.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    assert.equal(archiveResponse.status, 204);
    assert.ok(server.adminClient.state.products[0].archived_at);
    assert.equal(server.adminClient.state.order_items.length, 1);

    const restoreResponse = await fetch(`${server.url}/api/admin/products/${product.id}/restore`, {
      method: "POST",
      headers: headers(),
    });
    assert.equal(restoreResponse.status, 200);
    assert.equal(server.adminClient.state.products[0].archived_at, null);
    assert.equal(server.adminClient.state.products[0].is_available, true);
  } finally {
    await server.close();
  }
});

test("admin image endpoint rejects invalid bytes and uploads validated images", async () => {
  const server = await startServer();
  try {
    const invalidForm = new FormData();
    invalidForm.set("image", new Blob(["not an image"], { type: "image/png" }), "cover.png");
    const invalid = await fetch(`${server.url}/api/admin/images`, {
      method: "POST",
      headers: { Authorization: "Bearer good-token" },
      body: invalidForm,
    });
    assert.equal(invalid.status, 400);

    const oversizedForm = new FormData();
    oversizedForm.set("image", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
    const oversized = await fetch(`${server.url}/api/admin/images`, {
      method: "POST",
      headers: { Authorization: "Bearer good-token" },
      body: oversizedForm,
    });
    assert.equal(oversized.status, 413);

    const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jmtkAAAAASUVORK5CYII=", "base64");
    const validForm = new FormData();
    validForm.set("image", new Blob([pngBytes], { type: "application/octet-stream" }), "cover.bin");
    const valid = await fetch(`${server.url}/api/admin/images`, {
      method: "POST",
      headers: { Authorization: "Bearer good-token" },
      body: validForm,
    });
    assert.equal(valid.status, 201);
    assert.equal(server.adminClient.state.uploads[0].options.contentType, "image/png");
    const uploaded = await valid.json();
    assert.match(uploaded.imageUrl, /book-covers\/.+\.png$/);
    const removed = await fetch(`${server.url}/api/admin/images/${uploaded.storageKey}`, {
      method: "DELETE",
      headers: headers(),
    });
    assert.equal(removed.status, 204);
    assert.equal(server.adminClient.state.uploads.length, 0);
    const invalidKey = await fetch(`${server.url}/api/admin/images/not-a-cover`, {
      method: "DELETE",
      headers: headers(),
    });
    assert.equal(invalidKey.status, 400);
  } finally {
    await server.close();
  }
});

test("admin order endpoints list all orders, show details, and validate status changes", async () => {
  const server = await startServer();
  try {
    const list = await fetch(`${server.url}/api/admin/orders`, { headers: headers() });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).orders[0].email, customerOrder.email);

    const invalidFilter = await fetch(`${server.url}/api/admin/orders?status=refunded`, { headers: headers() });
    assert.equal(invalidFilter.status, 400);

    const detail = await fetch(`${server.url}/api/admin/orders/${customerOrder.id}`, { headers: headers() });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).order.order_items[0].product_title, "Atomic Habits");
    const invalidOrderId = await fetch(`${server.url}/api/admin/orders/not-an-id`, { headers: headers() });
    assert.equal(invalidOrderId.status, 400);

    const invalid = await fetch(`${server.url}/api/admin/orders/${customerOrder.id}/status`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: "refunded" }),
    });
    assert.equal(invalid.status, 400);

    const updated = await fetch(`${server.url}/api/admin/orders/${customerOrder.id}/status`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ status: "shipped" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).order.status, "shipped");
  } finally {
    await server.close();
  }
});

test("all admin data and mutation endpoints reject customer accounts", async () => {
  const server = await startServer({ role: "customer" });
  const checks = [
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/products"],
    ["POST", "/api/admin/products"],
    ["PUT", `/api/admin/products/${product.id}`],
    ["DELETE", `/api/admin/products/${product.id}`],
    ["POST", `/api/admin/products/${product.id}/restore`],
    ["POST", "/api/admin/images"],
    ["DELETE", "/api/admin/images/11111111-1111-4111-8111-111111111111.png"],
    ["GET", "/api/admin/orders"],
    ["GET", `/api/admin/orders/${customerOrder.id}`],
    ["PATCH", `/api/admin/orders/${customerOrder.id}/status`],
  ];
  try {
    for (const [method, path] of checks) {
      const response = await fetch(`${server.url}${path}`, {
        method,
        headers: headers(),
        ...(method === "POST" || method === "PUT" || method === "PATCH" ? { body: JSON.stringify(validProduct) } : {}),
      });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
    const roleResponse = await fetch(`${server.url}/api/admin/me`, { headers: headers() });
    assert.deepEqual(await roleResponse.json(), { role: "customer" });
  } finally {
    await server.close();
  }
});

test("admin endpoints reject missing and invalid bearer tokens", async () => {
  const server = await startServer();
  try {
    for (const authorization of [undefined, "Bearer wrong-token"]) {
      const response = await fetch(`${server.url}/api/admin/dashboard`, {
        headers: authorization ? { Authorization: authorization } : {},
      });
      assert.equal(response.status, 401);
    }
  } finally {
    await server.close();
  }
});
