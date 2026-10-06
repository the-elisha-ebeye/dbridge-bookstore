import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "dbridge-cart-v1";

function readSavedCart() {
  const saved = localStorage.getItem(CART_STORAGE_KEY);
  if (!saved) return [];

  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (item) =>
      item &&
      typeof item.id === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0,
  );
}

function hydrateCart(items) {
  return items.filter(
    (item) =>
      item &&
      typeof item.id === "string" &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0,
  );
}

function cartReducer(items, action) {
  switch (action.type) {
    case "add": {
      const existing = items.find((item) => item.id === action.book.id);
      if (existing) {
        return items.map((item) =>
          item.id === action.book.id
            ? { ...item, quantity: Math.min(item.quantity + 1, item.stock_quantity) }
            : item,
        );
      }
      return [...items, { ...action.book, quantity: 1 }];
    }
    case "set-quantity":
      return items
        .map((item) =>
          item.id === action.id
            ? {
                ...item,
                quantity: Math.min(action.quantity, item.stock_quantity),
              }
            : item,
        )
        .filter((item) => item.quantity > 0);
    case "remove":
      return items.filter((item) => item.id !== action.id);
    case "clear":
      return [];
    default:
      return items;
  }
}

async function syncGuestCartToServer(accessToken, guestItems) {
  if (!guestItems.length) return [];

  for (const item of guestItems) {
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId: item.id, quantity: item.quantity }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message ?? "Could not sync your existing cart.");
    }
  }

  const response = await fetch("/api/cart", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Could not load your synced cart.");
  }

  return hydrateCart(payload?.items ?? []);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readSavedCart());
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    }).catch((error) => {
      console.error("Could not restore the cart session:", error.message);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setItems(readSavedCart());
      return;
    }

    let isCurrent = true;

    async function syncCart() {
      try {
        const guestItems = readSavedCart();
        if (guestItems.length) {
          const syncedItems = await syncGuestCartToServer(session.access_token, guestItems);
          localStorage.removeItem(CART_STORAGE_KEY);
          if (isCurrent) setItems(syncedItems);
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(syncedItems));
          return;
        }

        const response = await fetch("/api/cart", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message ?? "Could not load your cart.");
        }

        const syncedItems = hydrateCart(payload?.items ?? []);
        if (isCurrent) setItems(syncedItems);
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(syncedItems));
      } catch (error) {
        console.error("Could not sync the authenticated cart:", error.message);
        if (isCurrent) setItems(readSavedCart());
      }
    }

    syncCart();
    return () => {
      isCurrent = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  async function addItem(book) {
    if (session?.access_token) {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId: book.id, quantity: 1 }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Could not add that book to your cart.");
      setItems(hydrateCart(payload.items ?? []));
      return;
    }

    setItems((current) => cartReducer(current, { type: "add", book }));
  }

  async function setQuantity(id, quantity) {
    if (session?.access_token) {
      const nextQuantity = Math.max(0, quantity);
      if (nextQuantity === 0) {
        const response = await fetch(`/api/cart/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? "Could not remove that book from your cart.");
        setItems(hydrateCart(payload.items ?? []));
        return;
      }

      const response = await fetch(`/api/cart/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Could not update that book in your cart.");
      setItems(hydrateCart(payload.items ?? []));
      return;
    }

    setItems((current) => cartReducer(current, { type: "set-quantity", id, quantity }));
  }

  async function removeItem(id) {
    if (session?.access_token) {
      const response = await fetch(`/api/cart/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Could not remove that book from your cart.");
      setItems(hydrateCart(payload.items ?? []));
      return;
    }

    setItems((current) => cartReducer(current, { type: "remove", id }));
  }

  async function clearCart() {
    if (session?.access_token) {
      const response = await fetch("/api/cart", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Could not clear your cart.");
      setItems(hydrateCart(payload.items ?? []));
      return;
    }

    setItems((current) => cartReducer(current, { type: "clear" }));
  }

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, session?.access_token],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
