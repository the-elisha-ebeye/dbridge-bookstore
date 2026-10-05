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
