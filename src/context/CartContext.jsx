import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

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

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, readSavedCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
      addItem: (book) => dispatch({ type: "add", book }),
      setQuantity: (id, quantity) =>
        dispatch({ type: "set-quantity", id, quantity }),
      removeItem: (id) => dispatch({ type: "remove", id }),
      clearCart: () => dispatch({ type: "clear" }),
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
