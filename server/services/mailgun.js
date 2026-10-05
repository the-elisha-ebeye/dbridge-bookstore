function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function money(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export async function sendMailgunConfirmation({ order, items, recipient }) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM } = process.env;
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !MAILGUN_FROM) {
    throw new Error("Mailgun server configuration is incomplete.");
  }
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(MAILGUN_DOMAIN)) {
    throw new Error("MAILGUN_DOMAIN is not a valid domain name.");
  }

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const orderDate = new Date(order.created_at).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const itemText = items
    .map((item) => `${item.product_title} × ${item.quantity} — ${money(item.unit_price)} each (${money(item.subtotal)})`)
    .join("\n");
  const itemHtml = items.map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eee7e1">
        ${escapeHtml(item.product_title)} <span style="color:#817783">× ${item.quantity} · ${escapeHtml(money(item.unit_price))} each</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #eee7e1;text-align:right">
        ${escapeHtml(money(item.subtotal))}
      </td>
    </tr>
  `).join("");
  const address = [order.delivery_address, order.city, order.state].filter(Boolean).join(", ");
  const text = [
    `Hello ${order.customer_name},`,
    "",
    `Thank you for choosing D’Bridge Bookshop. Your order #DB-${orderNumber} has been received.`,
    `Order date: ${orderDate}`,
    "",
    itemText,
    "",
    `Total: ${money(order.total)}`,
    `Delivery to: ${address}`,
    "",
    "Connecting minds to the right books.",
  ].join("\n");
  const html = `<!doctype html>
    <html lang="en"><body style="margin:0;padding:28px;background:#f8f6f1;font-family:Arial,sans-serif;color:#302a33">
      <div style="max-width:600px;margin:auto;padding:32px;background:#fffefa;border:1px solid #e9e4dc">
        <p style="margin:0;color:#563b62;font-size:12px;font-weight:bold;letter-spacing:2px">D’BRIDGE BOOKSHOP</p>
        <h1 style="margin:22px 0 8px;font-family:Georgia,serif;font-size:30px;font-weight:normal">Your next chapter starts here.</h1>
        <p style="color:#716a72;font-size:14px;line-height:1.7">Hello ${escapeHtml(order.customer_name)}, thank you for choosing us. Your order <strong>#DB-${orderNumber}</strong> has been received.</p>
        <p style="color:#817783;font-size:12px">Order date: ${escapeHtml(orderDate)}</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:13px">${itemHtml}
          <tr><td style="padding-top:18px;font-weight:bold">Total</td><td style="padding-top:18px;text-align:right;font-weight:bold">${escapeHtml(money(order.total))}</td></tr>
        </table>
        <p style="color:#716a72;font-size:12px;line-height:1.7"><strong>Delivery to</strong><br/>${escapeHtml(address)}</p>
        <p style="margin-top:28px;color:#563b62;font-family:Georgia,serif;font-style:italic">Connecting minds to the right books.</p>
      </div>
    </body></html>`;

  const form = new FormData();
  form.set("from", MAILGUN_FROM);
  form.set("to", recipient);
  form.set("subject", `Order Confirmation — D’Bridge Bookshop #DB-${orderNumber}`);
  form.set("text", text);
  form.set("html", html);

  const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
    },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Mailgun returned HTTP ${response.status}: ${details}`);
  }
}
