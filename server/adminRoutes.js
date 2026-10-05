import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

const productFields = [
  "title",
  "author",
  "description",
  "price",
  "category",
  "image_url",
  "stock_quantity",
  "isbn",
  "featured",
  "tags",
  "is_available",
];
const imageExtensions = new Set(["jpg", "png", "webp"]);
const orderStatuses = new Set(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);
const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateProduct(input, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide product details as an object." };
  }
  const entries = Object.entries(input);
  if (entries.some(([key]) => !productFields.includes(key))) {
    return { error: "The product contains an unsupported field." };
  }
  if (partial && entries.length === 0) return { error: "Provide at least one product field to update." };

  const values = {};
  for (const field of productFields) {
    if (!(field in input)) {
      if (!partial && ["title", "author", "description", "category", "price", "stock_quantity"].includes(field)) {
        return { error: `A valid ${field.replaceAll("_", " ")} is required.` };
      }
      continue;
    }
    const value = input[field];
    if (["title", "author", "description", "category"].includes(field)) {
      const maximum = field === "description" ? 10000 : 160;
      if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > maximum) {
        return { error: `Enter a valid ${field.replaceAll("_", " ")} (maximum ${maximum} characters).` };
      }
      values[field] = value.trim();
    } else if (field === "price") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000000) {
        return { error: "Price must be a valid non-negative amount." };
      }
      values[field] = value;
    } else if (field === "stock_quantity") {
      if (!Number.isInteger(value) || value < 0 || value > 1000000) {
        return { error: "Stock must be a whole number between 0 and 1,000,000." };
      }
      values[field] = value;
    } else if (field === "image_url") {
      if (value !== null && typeof value !== "string") return { error: "Image URL must be a valid HTTPS URL or empty." };
      if (typeof value === "string" && value.trim()) {
        try {
          const imageUrl = new URL(value.trim());
          if (imageUrl.protocol !== "https:") throw new Error("Invalid protocol");
          values[field] = imageUrl.toString();
        } catch {
          return { error: "Image URL must be a valid HTTP or HTTPS URL." };
        }
      } else {
        values[field] = null;
      }
    } else if (field === "isbn") {
      if (value !== null && typeof value !== "string") return { error: "ISBN must be text or empty." };
      values[field] = typeof value === "string" && value.trim() ? value.trim().slice(0, 32) : null;
    } else if (field === "featured" || field === "is_available") {
      if (typeof value !== "boolean") return { error: `${field.replaceAll("_", " ")} must be true or false.` };
      values[field] = value;
    } else if (field === "tags") {
      if (!Array.isArray(value) || value.length > 30 || value.some((tag) => typeof tag !== "string" || tag.trim().length > 50)) {
        return { error: "Tags must be a list of up to 30 short text values." };
      }
      values[field] = [...new Set(value.map((tag) => tag.trim()).filter(Boolean))];
    }
  }
  return { values };
}

function storedCoverKey(imageUrl) {
  if (typeof imageUrl !== "string") return null;
  try {
    const pathname = new URL(imageUrl).pathname;
    const marker = "/storage/v1/object/public/book-covers/";
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const key = decodeURIComponent(pathname.slice(markerIndex + marker.length));
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(key) ? key : null;
  } catch {
    return null;
  }
}

async function removeStoredCover(adminClient, key) {
  if (!key) return null;
  const { error } = await adminClient.storage.from("book-covers").remove([key]);
  return error ?? null;
}

async function getRole(adminClient, userId) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) return { error };
  return { role: data?.role ?? "customer" };
}

export function createAdminRouter({ adminClient, logger = console }) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  router.get("/me", async (request, response) => {
    if (!adminClient) return response.status(503).json({ message: "The admin database is not configured on the server." });
    const result = await getRole(adminClient, request.authUser.id);
    if (result.error) {
      logger.error("Could not load account role:", result.error.message);
      return response.status(500).json({ message: "We could not verify admin access right now." });
    }
    return response.json({ role: result.role });
  });

  router.use(async (request, response, next) => {
    if (!adminClient) return response.status(503).json({ message: "The admin database is not configured on the server." });
    const result = await getRole(adminClient, request.authUser.id);
    if (result.error) {
      logger.error("Could not verify admin role:", result.error.message);
      return response.status(500).json({ message: "We could not verify admin access right now." });
    }
    if (result.role !== "admin") return response.status(403).json({ message: "Admin access is required." });
    return next();
  });

  router.get("/dashboard", async (_request, response) => {
    const [ordersResult, productsResult] = await Promise.all([
      adminClient.from("orders").select("id,total,status,created_at,customer_name,email").order("created_at", { ascending: false }),
      adminClient.from("products").select("id,title,stock_quantity,is_available,archived_at,price"),
    ]);
    if (ordersResult.error || productsResult.error) {
      logger.error("Could not load admin dashboard:", ordersResult.error?.message ?? productsResult.error?.message);
      return response.status(500).json({ message: "We could not load dashboard data right now." });
    }
    const orders = ordersResult.data ?? [];
    const products = productsResult.data ?? [];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return response.json({
      stats: {
        orderCount: orders.length,
        revenue: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total), 0),
        monthOrderCount: orders.filter((order) => new Date(order.created_at) >= monthStart).length,
        productCount: products.filter((product) => !product.archived_at).length,
        lowStockCount: products.filter((product) => !product.archived_at && product.stock_quantity <= 5).length,
      },
      recentOrders: orders.slice(0, 6),
      lowStockProducts: products.filter((product) => !product.archived_at && product.stock_quantity <= 5)
        .sort((a, b) => a.stock_quantity - b.stock_quantity)
        .slice(0, 8),
    });
  });

  router.get("/products", async (_request, response) => {
    const { data, error } = await adminClient.from("products").select("*").order("created_at", { ascending: false });
    if (error) {
      logger.error("Could not load admin products:", error.message);
      return response.status(500).json({ message: "We could not load products right now." });
    }
    return response.json({ products: data ?? [] });
  });

  router.post("/products", async (request, response) => {
    const validation = validateProduct(request.body);
    if (validation.error) return response.status(400).json({ message: validation.error });
    const { data, error } = await adminClient.from("products").insert(validation.values).select("*").single();
    if (error) {
      logger.error("Could not create product:", error.message);
      return response.status(500).json({ message: "We could not save this book right now." });
    }
    return response.status(201).json({ product: data });
  });

  router.put("/products/:id", async (request, response) => {
    if (!request.params.id || request.params.id.length > 128) return response.status(400).json({ message: "That product ID is not valid." });
    const validation = validateProduct(request.body, true);
    if (validation.error) return response.status(400).json({ message: validation.error });
    const { data: existing, error: lookupError } = await adminClient.from("products")
      .select("image_url")
      .eq("id", request.params.id)
      .is("archived_at", null)
      .maybeSingle();
    if (lookupError) {
      logger.error("Could not load product before update:", lookupError.message);
      return response.status(500).json({ message: "We could not update this book right now." });
    }
    if (!existing) return response.status(404).json({ message: "We could not find that active book." });
    const { data, error } = await adminClient.from("products")
      .update({ ...validation.values, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .is("archived_at", null)
      .select("*")
      .maybeSingle();
    if (error) {
      logger.error("Could not update product:", error.message);
      return response.status(500).json({ message: "We could not update this book right now." });
    }
    if (!data) return response.status(404).json({ message: "We could not find that active book." });
    let cleanupWarning;
    const oldCoverKey = storedCoverKey(existing.image_url);
    if (oldCoverKey && existing.image_url !== data.image_url) {
      const cleanupError = await removeStoredCover(adminClient, oldCoverKey);
      if (cleanupError) {
        logger.error("Book updated, but the replaced cover could not be removed:", cleanupError.message);
        cleanupWarning = "Book saved, but the replaced cover could not be cleaned up.";
      }
    }
    return response.json({ product: data, ...(cleanupWarning ? { cleanupWarning } : {}) });
  });

  router.delete("/products/:id", async (request, response) => {
    if (!request.params.id || request.params.id.length > 128) return response.status(400).json({ message: "That product ID is not valid." });
    const { data, error } = await adminClient.from("products")
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      logger.error("Could not archive product:", error.message);
      return response.status(500).json({ message: "We could not archive this book right now." });
    }
    if (!data) return response.status(404).json({ message: "We could not find that active book." });
    return response.status(204).end();
  });

  router.post("/products/:id/restore", async (request, response) => {
    const { data, error } = await adminClient.from("products")
      .update({ archived_at: null, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .not("archived_at", "is", null)
      .select("*")
      .maybeSingle();
    if (error) {
      logger.error("Could not restore product:", error.message);
      return response.status(500).json({ message: "We could not restore this book right now." });
    }
    if (!data) return response.status(404).json({ message: "We could not find that archived book." });
    return response.json({ product: data });
  });

  router.post("/images", (request, response, next) => {
    upload.single("image")(request, response, (error) => {
      if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return response.status(status).json({ message: status === 413 ? "Book cover must be 5 MB or smaller." : "Upload one image file at a time." });
      }
      if (error) return next(error);
      return next();
    });
  }, async (request, response) => {
    if (!request.file) return response.status(400).json({ message: "Choose a book cover image to upload." });
    const detectedType = await fileTypeFromBuffer(request.file.buffer);
    if (!detectedType || !imageExtensions.has(detectedType.ext) || !["image/jpeg", "image/png", "image/webp"].includes(detectedType.mime)) {
      return response.status(400).json({ message: "Use a valid JPEG, PNG, or WebP image." });
    }
    const key = `${randomUUID()}.${detectedType.ext}`;
    const { error } = await adminClient.storage.from("book-covers").upload(key, request.file.buffer, {
      contentType: detectedType.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      logger.error("Could not upload book cover:", error.message);
      return response.status(502).json({ message: "We could not upload this cover. Please try again." });
    }
    const { data } = adminClient.storage.from("book-covers").getPublicUrl(key);
    return response.status(201).json({ imageUrl: data.publicUrl, storageKey: key });
  });

  router.delete("/images/:key", async (request, response) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(request.params.key)) {
      return response.status(400).json({ message: "That uploaded cover key is not valid." });
    }
    const error = await removeStoredCover(adminClient, request.params.key);
    if (error) {
      logger.error("Could not remove unused book cover:", error.message);
      return response.status(502).json({ message: "We could not remove the unused cover right now." });
    }
    return response.status(204).end();
  });

  router.get("/orders", async (request, response) => {
    let query = adminClient.from("orders")
      .select("id,customer_name,email,phone,total,status,created_at,city,state,order_items(product_title,quantity,unit_price,subtotal)")
      .order("created_at", { ascending: false });
    const status = typeof request.query.status === "string" ? request.query.status : "";
    if (status && !orderStatuses.has(status)) return response.status(400).json({ message: "Choose a valid order status filter." });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      logger.error("Could not load admin orders:", error.message);
      return response.status(500).json({ message: "We could not load orders right now." });
    }
    return response.json({ orders: data ?? [] });
  });

  router.get("/orders/:id", async (request, response) => {
    if (!orderIdPattern.test(request.params.id)) return response.status(400).json({ message: "That order number is not valid." });
    const { data, error } = await adminClient.from("orders").select("*,order_items(*)").eq("id", request.params.id).maybeSingle();
    if (error) {
      logger.error("Could not load admin order:", error.message);
      return response.status(500).json({ message: "We could not load this order right now." });
    }
    if (!data) return response.status(404).json({ message: "We could not find that order." });
    return response.json({ order: data });
  });

  router.patch("/orders/:id/status", async (request, response) => {
    if (!orderIdPattern.test(request.params.id)) return response.status(400).json({ message: "That order number is not valid." });
    const { status } = request.body ?? {};
    if (typeof status !== "string" || !orderStatuses.has(status)) {
      return response.status(400).json({ message: "Choose a valid order status." });
    }
    const { data, error } = await adminClient.from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", request.params.id)
      .select("*")
      .maybeSingle();
    if (error) {
      logger.error("Could not update order status:", error.message);
      return response.status(500).json({ message: "We could not update this order right now." });
    }
    if (!data) return response.status(404).json({ message: "We could not find that order." });
    return response.json({ order: data });
  });

  return router;
}
