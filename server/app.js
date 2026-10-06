import express from "express";
import helmet from "helmet";
import { createAdminRouter } from "./adminRoutes.js";
import { validateOrderPayload } from "./services/orderValidation.js";

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function getOrderErrorStatus(error) {
  if (error.status === 400) return 400;
  if (error.message?.includes("PRODUCT_NOT_FOUND")) return 404;
  if (error.message?.includes("PRODUCT_NOT_AVAILABLE")) return 409;
  if (error.message?.includes("INSUFFICIENT_STOCK")) return 409;
  if (
    error.message?.includes("INVALID_ORDER_DETAILS") ||
    error.message?.includes("INVALID_ORDER_ITEMS") ||
    error.message?.includes("DUPLICATE_ORDER_ITEMS")
  ) return 400;
  return 500;
}

function createAuthenticationMiddleware(authClient, logger) {
  return async (request, response, next) => {
    if (!authClient) {
      return response.status(503).json({ message: "Supabase authentication is not configured on the server." });
    }

    const match = /^Bearer\s+(.+)$/i.exec(request.get("authorization") ?? "");
    if (!match) return response.status(401).json({ message: "Sign in before accessing your orders." });

    try {
      const { data, error } = await authClient.auth.getUser(match[1]);
      if (error || !data?.user) {
        return response.status(401).json({ message: "Your sign-in session is invalid or has expired." });
      }
      request.authUser = data.user;
      return next();
    } catch (error) {
      logger.error("Could not verify the Supabase access token:", describeError(error));
      return response.status(503).json({ message: "We could not verify your sign-in. Please try again." });
    }
  };
}

async function getOrCreateCart(adminClient, userId) {
  const { data: cart, error: cartError } = await adminClient
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (cartError) throw cartError;
  if (cart) return cart;

  const { data: createdCart, error: createError } = await adminClient
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (createError) throw createError;
  return createdCart;
}

async function getCartItems(adminClient, cartId) {
  const { data: rows, error: rowsError } = await adminClient
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("cart_id", cartId);

  if (rowsError) throw rowsError;

  const items = [];
  for (const row of rows ?? []) {
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, title, author, category, image_url, price, stock_quantity, is_available")
      .eq("id", row.product_id)
      .maybeSingle();

    if (productError) throw productError;
    if (!product || !product.is_available || product.stock_quantity <= 0) continue;

    items.push({
      id: product.id,
      title: product.title,
      author: product.author,
      category: product.category,
      image_url: product.image_url,
      price: Number(product.price),
      stock_quantity: Number(product.stock_quantity),
      quantity: Number(row.quantity),
      subtotal: Number(product.price) * Number(row.quantity),
    });
  }

  return items;
}

async function getDbProduct(adminClient, productId) {
  const { data: product, error } = await adminClient
    .from("products")
    .select("id, title, author, category, image_url, price, stock_quantity, is_available")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;
  return product;
}

async function sendAndRecordEmail({ adminClient, sendConfirmationEmail, order, items, recipient, attempts = 0, logger }) {
  let status = "sent";
  let lastError = null;

  try {
    await sendConfirmationEmail({ order, items, recipient });
  } catch (error) {
    status = "failed";
    lastError = describeError(error).slice(0, 1000);
    logger.error(`Order confirmation email failed for ${order.id}:`, lastError);
  }

  const now = new Date().toISOString();
  try {
    const { error: recordError } = await adminClient
      .from("order_emails")
      .update({
        status,
        attempts: attempts + 1,
        last_error: lastError,
        last_attempt_at: now,
        sent_at: status === "sent" ? now : null,
        updated_at: now,
      })
      .eq("order_id", order.id);

    if (recordError) throw recordError;
  } catch (recordError) {
    logger.error(`Could not record confirmation email status for ${order.id}:`, describeError(recordError));
    return {
      emailStatus: "failed",
      emailMessage: "Your order is saved, but its email status could not be recorded. Please contact the shop.",
    };
  }

  return status === "sent"
    ? { emailStatus: "sent", emailMessage: "Your confirmation email has been sent." }
    : { emailStatus: "failed", emailMessage: "Your order is saved, but the confirmation email could not be sent. You can retry it from this page." };
}

export function createApp({
  authClient,
  adminClient,
  sendConfirmationEmail,
  logger = console,
  staticDirectory,
  supabaseOrigin,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      },
    },
  }));
  app.use(express.json({ limit: "20kb" }));
  app.use((error, _request, response, next) => {
    if (error.type === "entity.parse.failed") {
      return response.status(400).json({ message: "The request body must contain valid JSON." });
    }
    if (error.type === "entity.too.large") {
      return response.status(413).json({ message: "The request is too large." });
    }
    return next(error);
  });

  const authenticate = createAuthenticationMiddleware(authClient, logger);

  app.post("/api/orders", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The order database is not configured on the server." });
    }

    let payload;
    try {
      payload = validateOrderPayload(request.body, request.authUser);
    } catch (error) {
      return response.status(error.status ?? 400).json({ message: error.message });
    }

    const { data, error } = await adminClient.rpc("create_order", {
      p_user_id: request.authUser.id,
      p_checkout_key: payload.checkoutKey,
      p_customer_name: payload.customerName,
      p_email: payload.email,
      p_phone: payload.phone,
      p_delivery_address: payload.deliveryAddress,
      p_city: payload.city,
      p_state: payload.state,
      p_items: payload.items,
    });

    if (error) {
      const status = getOrderErrorStatus(error);
      if (status === 500) logger.error("Order creation failed:", error.message);
      const messages = {
        400: "Review the delivery details and books in your bag, then try again.",
        404: "A book in your bag is no longer available.",
        409: "A book in your bag no longer has enough stock. Please update your bag.",
        500: "We could not place your order right now. Please try again.",
      };
      const message = error.message?.includes("PRODUCT_NOT_AVAILABLE")
        ? "A book in your bag is no longer available to order. Please update your bag."
        : messages[status];
      return response.status(status).json({ message });
    }

    if (!data?.order?.id || !Array.isArray(data.items)) {
      logger.error("Order RPC returned an unexpected response.");
      return response.status(500).json({ message: "We could not confirm your order. Please contact the shop before retrying." });
    }

    const emailResult = data.is_existing && data.email_status === "sent"
      ? { emailStatus: "sent", emailMessage: "This order was already received, and its confirmation email was sent." }
      : await sendAndRecordEmail({
          adminClient,
          sendConfirmationEmail,
          order: data.order,
          items: data.items,
          recipient: payload.email,
          attempts: data.email_attempts ?? 0,
          logger,
        });

    return response.status(data.is_existing ? 200 : 201).json({
      order: data.order,
      emailStatus: emailResult.emailStatus,
      emailMessage: emailResult.emailMessage,
    });
  });

  app.get("/api/cart", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The cart database is not configured on the server." });
    }

    try {
      const cart = await getOrCreateCart(adminClient, request.authUser.id);
      const items = await getCartItems(adminClient, cart.id);
      return response.json({ items });
    } catch (error) {
      logger.error("Could not load a user's cart:", describeError(error));
      return response.status(500).json({ message: "We could not load your cart right now." });
    }
  });

  app.post("/api/cart", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The cart database is not configured on the server." });
    }

    const productId = String(request.body?.productId ?? "").trim();
    const quantity = Number(request.body?.quantity ?? 1);

    if (!productId) {
      return response.status(400).json({ message: "A product is required to add to your cart." });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return response.status(400).json({ message: "Cart quantities must be whole numbers greater than zero." });
    }

    try {
      const product = await getDbProduct(adminClient, productId);
      if (!product) {
        return response.status(404).json({ message: "That book is no longer available." });
      }
      if (!product.is_available) {
        return response.status(409).json({ message: "That book is no longer available to order." });
      }

      const cart = await getOrCreateCart(adminClient, request.authUser.id);
      const { data: existingRow, error: existingError } = await adminClient
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existingError) throw existingError;

      const nextQuantity = (existingRow?.quantity ?? 0) + quantity;
      if (nextQuantity > Number(product.stock_quantity)) {
        return response.status(409).json({ message: "This book is no longer available in the requested quantity." });
      }

      if (existingRow) {
        const { error: updateError } = await adminClient
          .from("cart_items")
          .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
          .eq("id", existingRow.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await adminClient
          .from("cart_items")
          .insert({ cart_id: cart.id, product_id: productId, quantity: nextQuantity });

        if (insertError) throw insertError;
      }

      const items = await getCartItems(adminClient, cart.id);
      return response.status(201).json({ items });
    } catch (error) {
      logger.error("Could not add a product to a user's cart:", describeError(error));
      return response.status(500).json({ message: "We could not update your cart right now." });
    }
  });

  app.put("/api/cart/:productId", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The cart database is not configured on the server." });
    }

    const productId = String(request.params.productId ?? "").trim();
    const quantity = Number(request.body?.quantity ?? 0);

    if (!productId) {
      return response.status(400).json({ message: "A valid product is required." });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return response.status(400).json({ message: "Cart quantities must be whole numbers greater than zero." });
    }

    try {
      const product = await getDbProduct(adminClient, productId);
      if (!product) {
        return response.status(404).json({ message: "That book is no longer available." });
      }
      if (!product.is_available) {
        return response.status(409).json({ message: "That book is no longer available to order." });
      }
      if (quantity > Number(product.stock_quantity)) {
        return response.status(409).json({ message: "This book is no longer available in the requested quantity." });
      }

      const cart = await getOrCreateCart(adminClient, request.authUser.id);
      const { data: existingRow, error: existingError } = await adminClient
        .from("cart_items")
        .select("id")
        .eq("cart_id", cart.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (!existingRow) {
        return response.status(404).json({ message: "That item is not in your cart." });
      }

      const { error: updateError } = await adminClient
        .from("cart_items")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", existingRow.id);

      if (updateError) throw updateError;

      const items = await getCartItems(adminClient, cart.id);
      return response.json({ items });
    } catch (error) {
      logger.error("Could not update a user's cart item:", describeError(error));
      return response.status(500).json({ message: "We could not update your cart right now." });
    }
  });

  app.delete("/api/cart/:productId", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The cart database is not configured on the server." });
    }

    const productId = String(request.params.productId ?? "").trim();
    if (!productId) {
      return response.status(400).json({ message: "A valid product is required." });
    }

    try {
      const cart = await getOrCreateCart(adminClient, request.authUser.id);
      const { error: deleteError } = await adminClient
        .from("cart_items")
        .delete()
        .eq("cart_id", cart.id)
        .eq("product_id", productId);

      if (deleteError) throw deleteError;

      const items = await getCartItems(adminClient, cart.id);
      return response.json({ items });
    } catch (error) {
      logger.error("Could not remove a user's cart item:", describeError(error));
      return response.status(500).json({ message: "We could not update your cart right now." });
    }
  });

  app.delete("/api/cart", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The cart database is not configured on the server." });
    }

    try {
      const cart = await getOrCreateCart(adminClient, request.authUser.id);
      const { error: clearError } = await adminClient
        .from("cart_items")
        .delete()
        .eq("cart_id", cart.id);

      if (clearError) throw clearError;

      return response.json({ items: [] });
    } catch (error) {
      logger.error("Could not clear a user's cart:", describeError(error));
      return response.status(500).json({ message: "We could not clear your cart right now." });
    }
  });

  app.use("/api/admin", authenticate, createAdminRouter({ adminClient, logger }));

  app.post("/api/orders/:id/confirmation-email/retry", authenticate, async (request, response) => {
    if (!adminClient) {
      return response.status(503).json({ message: "The order database is not configured on the server." });
    }
    if (!orderIdPattern.test(request.params.id)) {
      return response.status(400).json({ message: "That order number is not valid." });
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*,order_items(*)")
      .eq("id", request.params.id)
      .maybeSingle();

    if (orderError) {
      logger.error("Could not load order for email retry:", orderError.message);
      return response.status(500).json({ message: "We could not load this order right now." });
    }
    if (!order || order.user_id !== request.authUser.id) {
      return response.status(404).json({ message: "We could not find that order." });
    }

    const { data: emailRecord, error: emailRecordError } = await adminClient
      .from("order_emails")
      .select("status,attempts,recipient")
      .eq("order_id", order.id)
      .maybeSingle();

    if (emailRecordError) {
      logger.error("Could not load email status for order:", emailRecordError.message);
      return response.status(500).json({ message: "We could not check the email status right now." });
    }
    if (!emailRecord) return response.status(404).json({ message: "There is no confirmation email for that order." });
    if (emailRecord.status === "sent") {
      return response.status(200).json({ emailStatus: "sent", emailMessage: "The confirmation email was already sent." });
    }

    const emailResult = await sendAndRecordEmail({
      adminClient,
      sendConfirmationEmail,
      order,
      items: order.order_items ?? [],
      recipient: emailRecord.recipient,
      attempts: emailRecord.attempts,
      logger,
    });

    return response.status(emailResult.emailStatus === "sent" ? 200 : 502).json(emailResult);
  });

  app.use("/api", (_request, response) => response.status(404).json({ message: "API endpoint not found." }));

  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get(/.*/, (_request, response) => response.sendFile(`${staticDirectory}/index.html`));
  }

  app.use((error, _request, response, _next) => {
    logger.error("Unhandled API error:", error.message);
    return response.status(500).json({ message: "Something went wrong. Please try again." });
  });

  return app;
}
