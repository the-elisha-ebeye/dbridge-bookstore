import assert from "node:assert/strict";
import test from "node:test";
import { sendMailgunConfirmation } from "./mailgun.js";

const originalEnvironment = {
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
  MAILGUN_FROM: process.env.MAILGUN_FROM,
};
const originalFetch = globalThis.fetch;

function setMailgunEnvironment() {
  process.env.MAILGUN_API_KEY = "test-key";
  process.env.MAILGUN_DOMAIN = "mg.example.test";
  process.env.MAILGUN_FROM = "D’Bridge Bookshop <orders@mg.example.test>";
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
}

test("Mailgun confirmation includes order date, unit prices, total, and escaped customer data", async () => {
  let request;
  setMailgunEnvironment();
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };

  try {
    await sendMailgunConfirmation({
      order: {
        id: "22222222-2222-4222-8222-222222222222",
        customer_name: "A <Reader>",
        delivery_address: "12 Book Street",
        city: "Benin City",
        state: "Edo",
        total: 25000,
        created_at: "2026-10-01T12:00:00.000Z",
      },
      items: [{
        product_title: "The <Good> Book",
        unit_price: 12500,
        quantity: 2,
        subtotal: 25000,
      }],
      recipient: "reader@example.com",
    });

    const form = request.options.body;
    assert.equal(request.url, "https://api.mailgun.net/v3/mg.example.test/messages");
    assert.equal(form.get("to"), "reader@example.com");
    assert.match(form.get("subject"), /Order Confirmation.*DB-22222222/);
    assert.match(form.get("text"), /Order date:/);
    assert.match(form.get("text"), /12,500.*each/);
    assert.match(form.get("html"), /A &lt;Reader&gt;/);
    assert.match(form.get("html"), /The &lt;Good&gt; Book/);
    assert.match(form.get("html"), /Benin City, Edo/);
  } finally {
    restoreEnvironment();
  }
});

test("Mailgun delivery errors are surfaced to the caller", async () => {
  setMailgunEnvironment();
  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    text: async () => "Domain is not verified",
  });

  try {
    await assert.rejects(
      sendMailgunConfirmation({
        order: { id: "22222222-2222-4222-8222-222222222222", created_at: new Date().toISOString() },
        items: [],
        recipient: "reader@example.com",
      }),
      /Mailgun returned HTTP 403/,
    );
  } finally {
    restoreEnvironment();
  }
});
