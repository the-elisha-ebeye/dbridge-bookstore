function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

const checkoutKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value, field, minLength, maxLength) {
  if (typeof value !== "string") throw invalid(`${field} is required.`);
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) {
    throw invalid(`${field} must be between ${minLength} and ${maxLength} characters.`);
  }
  return text;
}

export function validateOrderPayload(body, user) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw invalid("Provide the delivery details and items for your order.");
  }

  const customerName = requiredText(body.customerName, "Customer name", 2, 120);
  const phone = requiredText(body.phone, "Phone number", 7, 25);
  const digits = phone.replace(/\D/g, "");
  if (!/^[0-9+().\s-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw invalid("Enter a valid phone number.");
  }

  const deliveryAddress = requiredText(body.deliveryAddress, "Delivery address", 5, 300);
  const city = requiredText(body.city, "City", 2, 100);
  const state = requiredText(body.state, "State", 2, 100);
  const checkoutKey = typeof body.checkoutKey === "string" ? body.checkoutKey.trim() : "";
  if (!checkoutKeyPattern.test(checkoutKey)) {
    throw invalid("Your checkout session expired. Refresh your bag and try again.");
  }
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw invalid("Your signed-in account needs a valid email address to place an order.");
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
    throw invalid("Your order must contain between 1 and 30 different books.");
  }

  const seenProductIds = new Set();
  const items = body.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw invalid("One or more books in your bag are invalid.");
    }

    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    if (!productId || productId.length > 100 || seenProductIds.has(productId)) {
      throw invalid("One or more books in your bag are invalid.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw invalid("Book quantities must be between 1 and 20.");
    }

    seenProductIds.add(productId);
    return { productId, quantity: item.quantity };
  });

  return {
    customerName,
    email,
    phone,
    deliveryAddress,
    city,
    state,
    checkoutKey,
    items,
  };
}
