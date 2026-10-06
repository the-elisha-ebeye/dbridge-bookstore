import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

const userA = { id: "11111111-1111-4111-8111-111111111111", email: "reader@example.com" };
const productId = "atomic-habits";
const cartId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("cart endpoint requires an authenticated session", async () => {
  const app = createApp({
    authClient: { auth: { getUser: async () => ({ data: { user: null }, error: new Error("Invalid") }) } },
    adminClient: { from() { throw new Error("should not reach database"); } },
    logger: { error() {} },
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/cart`, {
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("cart endpoints create, read, update, and clear the authenticated user's shared cart", async () => {
  const state = {
    cart: { id: cartId, user_id: userA.id },
    items: [],
    products: {
      [productId]: {
        id: productId,
        title: "Atomic Habits",
        author: "James Clear",
        category: "Personal Growth",
        image_url: "https://example.com/atomic-habits.jpg",
        price: 1500,
        stock_quantity: 8,
        is_available: true,
      },
    },
  };

  const adminClient = {
    from(table) {
      const query = {
        filters: {},
        values: null,
        select(columns) {
          query.selectColumns = columns;
          return query;
        },
        eq(key, value) {
          query.filters[key] = value;
          return query;
        },
        insert(values) {
          query.values = values;
          return query;
        },
        update(values) {
          query.values = values;
          return query;
        },
        delete() {
          return query;
        },
        single() {
          if (table === "carts") {
            return { data: state.cart, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle() {
          if (table === "carts" && query.filters.user_id === userA.id) {
            return { data: state.cart, error: null };
          }
          if (table === "products" && query.filters.id) {
            return { data: state.products[query.filters.id] ?? null, error: null };
          }
          if (table === "cart_items") {
            if (query.filters.cart_id && query.filters.product_id) {
              const item = state.items.find((entry) => entry.cart_id === query.filters.cart_id && entry.product_id === query.filters.product_id);
              return { data: item ?? null, error: null };
            }
            if (query.filters.cart_id) {
              return { data: state.items.filter((entry) => entry.cart_id === query.filters.cart_id), error: null };
            }
          }
          return { data: null, error: null };
        },
        async then(resolve) {
          if (table === "cart_items" && query.filters && query.filters.cart_id && !query.filters.product_id && !query.values) {
            return resolve({ data: state.items.filter((entry) => entry.cart_id === query.filters.cart_id), error: null });
          }
          if (table === "cart_items" && query.values && query.filters && query.filters.id && query.values.quantity !== undefined) {
            const item = state.items.find((entry) => entry.id === query.filters.id);
            if (item) {
              item.quantity = query.values.quantity;
            }
            return resolve({ error: null });
          }
          if (table === "cart_items" && query.values && query.filters && query.filters.cart_id && query.filters.product_id && query.values.quantity !== undefined) {
            const existing = state.items.find((entry) => entry.cart_id === query.filters.cart_id && entry.product_id === query.filters.product_id);
            if (existing) {
              existing.quantity = query.values.quantity;
            } else {
              state.items.push({ id: "item-1", cart_id: query.filters.cart_id, product_id: query.filters.product_id, quantity: query.values.quantity });
            }
            return resolve({ error: null });
          }
          if (table === "cart_items" && query.values && query.values.cart_id && query.values.product_id && query.values.quantity) {
            state.items.push({ id: `item-${state.items.length + 1}`, ...query.values });
            return resolve({ error: null });
          }
          if (table === "cart_items" && query.filters && query.filters.cart_id && query.filters.product_id && !query.values) {
            state.items = state.items.filter((entry) => !(entry.cart_id === query.filters.cart_id && entry.product_id === query.filters.product_id));
            return resolve({ error: null });
          }
          if (table === "cart_items" && query.filters && query.filters.cart_id && !query.filters.product_id && query.values) {
            state.items = [];
            return resolve({ error: null });
          }
          return resolve({ error: null });
        },
      };
      return query;
    },
  };

  const authClient = {
    auth: {
      async getUser(token) {
        return token === "valid-token"
          ? { data: { user: userA }, error: null }
          : { data: { user: null }, error: new Error("Invalid token") };
      },
    },
  };

  const app = createApp({ authClient, adminClient, logger: { error() {} } });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const getResponse = await fetch(`http://127.0.0.1:${port}/api/cart`, {
      headers: { Authorization: "Bearer valid-token" },
    });
    assert.equal(getResponse.status, 200);
    assert.deepEqual((await getResponse.json()).items, []);

    const addResponse = await fetch(`http://127.0.0.1:${port}/api/cart`, {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, quantity: 2 }),
    });
    const addResult = await addResponse.json();
    assert.equal(addResponse.status, 201);
    assert.equal(addResult.items[0].id, productId);
    assert.equal(addResult.items[0].quantity, 2);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/cart/${productId}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ quantity: 4 }),
    });
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.items[0].quantity, 4);

    const deleteResponse = await fetch(`http://127.0.0.1:${port}/api/cart`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-token" },
    });
    const cleared = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(cleared.items, []);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
